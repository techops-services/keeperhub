import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
// start custom keeperhub code //
import { getOrgContext } from "@/keeperhub/lib/middleware/org-context";
// end keeperhub code //
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { workflows } from "@/lib/db/schema";
import { generateWorkflowSDKCode } from "@/lib/workflow-codegen-sdk";

export async function GET(
  request: Request,
  context: { params: Promise<{ workflowId: string }> }
) {
  try {
    const { workflowId } = await context.params;
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // start custom keeperhub code //
    // Verify workflow access (owner or org member)
    const workflow = await db.query.workflows.findFirst({
      where: eq(workflows.id, workflowId),
    });

    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    const isOwner = session.user.id === workflow.userId;
    const orgContext = await getOrgContext();
    const isSameOrg =
      !workflow.isAnonymous &&
      workflow.organizationId &&
      orgContext.organization?.id === workflow.organizationId;

    if (!isOwner && !isSameOrg) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }
    // end keeperhub code //

    // Generate code
    const code = generateWorkflowSDKCode(
      workflow.name,
      workflow.nodes,
      workflow.edges
    );

    return NextResponse.json({
      code,
      workflowName: workflow.name,
    });
  } catch (error) {
    console.error("Failed to get workflow code:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to get workflow code",
      },
      { status: 500 }
    );
  }
}
