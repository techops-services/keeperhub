import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
// start custom keeperhub code //
import { getOrgContext } from "@/keeperhub/lib/middleware/org-context";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { workflows } from "@/lib/db/schema";
// end keeperhub code //

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json([], { status: 200 });
    }

    // start custom keeperhub code //
    const context = await getOrgContext();

    const userWorkflows =
      context.isAnonymous || !context.organization
        ? // Anonymous users or users without org: show trial workflows
          await db
            .select()
            .from(workflows)
            .where(
              and(
                eq(workflows.userId, session.user.id),
                eq(workflows.isAnonymous, true)
              )
            )
            .orderBy(desc(workflows.updatedAt))
        : // Authenticated users with org: show org workflows
          await db
            .select()
            .from(workflows)
            .where(
              and(
                eq(workflows.organizationId, context.organization.id),
                eq(workflows.isAnonymous, false)
              )
            )
            .orderBy(desc(workflows.updatedAt));
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
