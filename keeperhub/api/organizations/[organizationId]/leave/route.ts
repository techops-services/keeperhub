import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { member, sessions } from "@/lib/db/schema";

type LeaveRequestBody = {
  /**
   * Required when caller is the sole owner: member id to promote to owner.
   * Must be an accepted member (row in member table), not a pending invitation.
   */
  newOwnerMemberId?: string;
};

type LeaveError =
  | "NOT_MEMBER"
  | "NEW_OWNER_REQUIRED"
  | "NEW_OWNER_NOT_ACCEPTED_MEMBER"
  | "NEW_OWNER_SAME_AS_CURRENT";

type LeaveResult = { success: true } | { success: false; error: LeaveError };

/**
 * POST /api/organizations/:organizationId/leave
 *
 * Leave the organization. When the caller is the sole owner, newOwnerMemberId
 * must be provided and must refer to an accepted member (in member table).
 * Ownership is transferred and membership removed in a single transaction.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> }
) {
  try {
    const { organizationId } = await context.params;

    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as LeaveRequestBody;
    const newOwnerMemberId =
      typeof body.newOwnerMemberId === "string"
        ? body.newOwnerMemberId.trim()
        : "";

    const sessionToken = session.session?.token;
    if (!sessionToken) {
      return NextResponse.json(
        { error: "Session token not found" },
        { status: 401 }
      );
    }

    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: linear validation steps within transaction
    const result = await db.transaction(async (tx): Promise<LeaveResult> => {
      const [currentMember] = await tx
        .select({ id: member.id, role: member.role })
        .from(member)
        .where(
          and(
            eq(member.organizationId, organizationId),
            eq(member.userId, session.user.id)
          )
        )
        .limit(1);

      if (!currentMember) {
        return { success: false, error: "NOT_MEMBER" };
      }

      const ownerCount = await tx
        .select({ id: member.id })
        .from(member)
        .where(
          and(
            eq(member.organizationId, organizationId),
            eq(member.role, "owner")
          )
        );

      const isOnlyOwner =
        currentMember.role === "owner" && ownerCount.length === 1;

      if (isOnlyOwner) {
        if (!newOwnerMemberId) {
          return { success: false, error: "NEW_OWNER_REQUIRED" };
        }

        const [newOwner] = await tx
          .select({ id: member.id })
          .from(member)
          .where(
            and(
              eq(member.id, newOwnerMemberId),
              eq(member.organizationId, organizationId)
            )
          )
          .limit(1);

        if (!newOwner) {
          return { success: false, error: "NEW_OWNER_NOT_ACCEPTED_MEMBER" };
        }

        if (newOwner.id === currentMember.id) {
          return { success: false, error: "NEW_OWNER_SAME_AS_CURRENT" };
        }

        await tx
          .update(member)
          .set({ role: "owner" })
          .where(eq(member.id, newOwnerMemberId));
      }

      await tx.delete(member).where(eq(member.id, currentMember.id));

      if (session.session?.activeOrganizationId === organizationId) {
        await tx
          .update(sessions)
          .set({ activeOrganizationId: null })
          .where(eq(sessions.token, sessionToken));
      }

      return { success: true };
    });

    if (!result.success) {
      const errorMessages: Record<
        LeaveError,
        { message: string; status: number }
      > = {
        NOT_MEMBER: {
          message: "You are not a member of this organization",
          status: 403,
        },
        NEW_OWNER_REQUIRED: {
          message:
            "You must assign a new owner before leaving. Provide newOwnerMemberId.",
          status: 400,
        },
        NEW_OWNER_NOT_ACCEPTED_MEMBER: {
          message:
            "Selected user is not an accepted member of this organization. Only members who have accepted their invitation can be assigned as owner.",
          status: 400,
        },
        NEW_OWNER_SAME_AS_CURRENT: {
          message: "Cannot assign yourself as the new owner",
          status: 400,
        },
      };

      const { message, status } = errorMessages[result.error];
      return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("Leave organization failed:", err);
    return NextResponse.json(
      { error: "Failed to leave organization" },
      { status: 500 }
    );
  }
}
