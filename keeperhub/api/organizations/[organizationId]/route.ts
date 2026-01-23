import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { member, organization } from "@/lib/db/schema";

type UpdateOrganizationNameRequest = {
  name?: string;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ organizationId: string }> }
) {
  try {
    const { organizationId } = await context.params;

    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as UpdateOrganizationNameRequest;
    const nextName =
      typeof body.name === "string" ? body.name.trim() : undefined;

    if (!nextName) {
      return NextResponse.json(
        { error: "Organization name is required" },
        { status: 400 }
      );
    }

    if (nextName.length > 120) {
      return NextResponse.json(
        { error: "Organization name is too long" },
        { status: 400 }
      );
    }

    const ownerMembership = await db
      .select({ id: member.id })
      .from(member)
      .where(
        and(
          eq(member.organizationId, organizationId),
          eq(member.userId, session.user.id),
          eq(member.role, "owner")
        )
      )
      .limit(1);

    if (ownerMembership.length === 0) {
      return NextResponse.json(
        { error: "Only organization owners can update the organization" },
        { status: 403 }
      );
    }

    const [updated] = await db
      .update(organization)
      .set({ name: nextName })
      .where(eq(organization.id, organizationId))
      .returning({ id: organization.id, name: organization.name });

    if (!updated) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ organization: updated }, { status: 200 });
  } catch (error) {
    console.error("Failed to update organization:", error);
    return NextResponse.json(
      { error: "Failed to update organization" },
      { status: 500 }
    );
  }
}
