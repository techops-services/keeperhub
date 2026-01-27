import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
// start custom keeperhub code //
import { authenticateApiKey } from "@/keeperhub/lib/api-key-auth";
import { getOrgContext } from "@/keeperhub/lib/middleware/org-context";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { workflows } from "@/lib/db/schema";
// end keeperhub code //

export async function GET(request: Request) {
  try {
    // start custom keeperhub code //
    // Try API key authentication first
    const apiKeyAuth = await authenticateApiKey(request);
    let organizationId: string | null;
    let userId: string | null = null;

    if (apiKeyAuth.authenticated) {
      // API key authentication successful
      organizationId = apiKeyAuth.organizationId || null;
    } else {
      // Fall back to session authentication
      const session = await auth.api.getSession({
        headers: request.headers,
      });

      if (!session?.user) {
        return NextResponse.json([], { status: 200 });
      }

      userId = session.user.id;

      // Get organization context from session
      const context = await getOrgContext();
      organizationId = context.organization?.id || null;
    }

    const userWorkflows =
      !organizationId && userId
        ? // Anonymous users or users without org: show trial workflows
          await db
            .select()
            .from(workflows)
            .where(
              and(eq(workflows.userId, userId), eq(workflows.isAnonymous, true))
            )
            .orderBy(asc(workflows.createdAt))
        : // Authenticated users with org or API key: show org workflows
          await db
            .select()
            .from(workflows)
            .where(
              and(
                eq(workflows.organizationId, organizationId ?? ""),
                eq(workflows.isAnonymous, false)
              )
            )
            .orderBy(asc(workflows.createdAt));
    // end keeperhub code //

    const mappedWorkflows = userWorkflows.map((workflow) => ({
      ...workflow,
      createdAt: workflow.createdAt.toISOString(),
      updatedAt: workflow.updatedAt.toISOString(),
    }));

    return NextResponse.json(mappedWorkflows);
  } catch (error) {
    console.error("Failed to get workflows:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to get workflows",
      },
      { status: 500 }
    );
  }
}
