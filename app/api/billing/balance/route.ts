import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { member, organization } from "@/lib/db/schema";

export async function GET(req: Request) {
  try {
    // Authenticate user
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get orgId from query params
    const url = new URL(req.url);
    const orgId = url.searchParams.get("orgId");

    if (!orgId) {
      return Response.json({ error: "Missing orgId" }, { status: 400 });
    }

    // Verify user has access to organization
    const membership = await db
      .select()
      .from(member)
      .where(
        and(
          eq(member.organizationId, orgId),
          eq(member.userId, session.user.id)
        )
      )
      .limit(1);

    if (membership.length === 0) {
      return Response.json(
        { error: "You don't have access to this organization" },
        { status: 403 }
      );
    }

    // Get organization with balance
    const [org] = await db
      .select({
        creditBalance: organization.creditBalance,
        tier: organization.tier,
        tierExpiresAt: organization.tierExpiresAt,
        tierIsLifetime: organization.tierIsLifetime,
      })
      .from(organization)
      .where(eq(organization.id, orgId))
      .limit(1);

    if (!org) {
      return Response.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    return Response.json({
      creditBalance: org.creditBalance ?? 0,
      tier: org.tier ?? "developer",
      tierExpiresAt: org.tierExpiresAt,
      tierIsLifetime: org.tierIsLifetime ?? false,
    });
  } catch (error) {
    console.error("Error fetching balance:", error);
    return Response.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
