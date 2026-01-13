import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
// start custom keeperhub code //
import { getOrgContext } from "@/keeperhub/lib/middleware/org-context";
// end keeperhub code //
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { workflowExecutionLogs, workflowExecutions } from "@/lib/db/schema";
import { redactSensitiveData } from "@/lib/utils/redact";

export async function GET(
  request: Request,
  context: { params: Promise<{ executionId: string }> }
) {
  try {
    const { executionId } = await context.params;
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the execution and verify ownership
    const execution = await db.query.workflowExecutions.findFirst({
      where: eq(workflowExecutions.id, executionId),
      with: {
        workflow: true,
      },
    });

    if (!execution) {
      return NextResponse.json(
        { error: "Execution not found" },
        { status: 404 }
      );
    }

    // start custom keeperhub code //
    // Verify access: owner or org member
    const isOwner = execution.workflow.userId === session.user.id;
    const orgContext = await getOrgContext();
    const isSameOrg =
      !execution.workflow.isAnonymous &&
      execution.workflow.organizationId &&
      orgContext.organization?.id === execution.workflow.organizationId;

    if (!isOwner && !isSameOrg) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // end keeperhub code //

    // Get logs
    const logs = await db.query.workflowExecutionLogs.findMany({
      where: eq(workflowExecutionLogs.executionId, executionId),
      orderBy: [desc(workflowExecutionLogs.timestamp)],
    });

    // Apply an additional layer of redaction to ensure no sensitive data is exposed
    // Even though data should already be redacted when stored, this provides defense in depth
    const redactedLogs = logs.map((log) => ({
      ...log,
      input: redactSensitiveData(log.input),
      output: redactSensitiveData(log.output),
    }));

    return NextResponse.json({
      execution,
      logs: redactedLogs,
    });
  } catch (error) {
    console.error("Failed to get execution logs:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to get execution logs",
      },
      { status: 500 }
    );
  }
}
