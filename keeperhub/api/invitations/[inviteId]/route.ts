import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invitation, organization, users } from "@/lib/db/schema";

type RouteParams = {
  params: Promise<{ inviteId: string }>;
};

/**
 * GET /api/invitations/[inviteId]
 * Fetch invitation details by ID (public endpoint for accept-invite page)
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { inviteId } = await params;

    if (!inviteId) {
      return NextResponse.json(
        { error: "Invitation ID is required" },
        { status: 400 }
      );
    }

    // Fetch invitation with organization and inviter details
    const result = await db
      .select({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        organizationId: invitation.organizationId,
        organizationName: organization.name,
        inviterName: users.name,
        inviterEmail: users.email,
      })
      .from(invitation)
      .leftJoin(organization, eq(invitation.organizationId, organization.id))
      .leftJoin(users, eq(invitation.inviterId, users.id))
      .where(eq(invitation.id, inviteId))
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    const inv = result[0];

    // Check if invitation has expired
    if (inv.expiresAt && new Date(inv.expiresAt) < new Date()) {
      return NextResponse.json(
        {
          error: "Invitation has expired",
          expired: true,
          invitation: {
            email: inv.email,
            organizationName: inv.organizationName,
          },
        },
        { status: 410 }
      );
    }

    // Check if already accepted
    if (inv.status === "accepted") {
      return NextResponse.json(
        {
          error: "Invitation has already been accepted",
          alreadyAccepted: true,
          invitation: {
            email: inv.email,
            organizationName: inv.organizationName,
          },
        },
        { status: 410 }
      );
    }

    // Check if rejected
    if (inv.status === "rejected") {
      return NextResponse.json(
        {
          error: "Invitation has been rejected",
          rejected: true,
          invitation: {
            email: inv.email,
            organizationName: inv.organizationName,
          },
        },
        { status: 410 }
      );
    }

    // Return invitation details
    return NextResponse.json({
      invitation: {
        id: inv.id,
        email: inv.email,
        role: inv.role,
        status: inv.status,
        expiresAt: inv.expiresAt,
        organizationName: inv.organizationName,
        inviterName: inv.inviterName || "A team member",
      },
    });
  } catch (error) {
    console.error("[Invitation] Failed to fetch invitation:", error);
    return NextResponse.json(
      { error: "Failed to fetch invitation" },
      { status: 500 }
    );
  }
}
