// start custom keeperhub code //
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { workflowExecutionLogs, workflowExecutions } from "@/lib/db/schema";
import { analyzeWorkflowFailure } from "@/lib/vigil-service";

export async function POST(
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

    // Verify the workflow belongs to the user
    if (execution.workflow.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Only analyze failed executions
    if (execution.status !== "error") {
      return NextResponse.json(
        { error: "Analysis is only available for failed executions" },
        { status: 400 }
      );
    }

    // Fetch execution logs
    const logs = await db.query.workflowExecutionLogs.findMany({
      where: eq(workflowExecutionLogs.executionId, executionId),
    });

    // Perform Vigil analysis
    const analysis = await analyzeWorkflowFailure({
      executionId,
      workflowId: execution.workflowId,
      status: execution.status,
      error: execution.error,
      input: execution.input as Record<string, unknown> | null,
      output: execution.output,
      executionLogs: logs.map((log) => ({
        nodeId: log.nodeId,
        nodeName: log.nodeName,
        nodeType: log.nodeType,
        status: log.status,
        error: log.error,
        input: log.input,
        output: log.output,
      })),
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      duration: execution.duration,
    });

    if (!analysis) {
      return NextResponse.json(
        { error: "Analysis failed or is disabled" },
        { status: 500 }
      );
    }

    // Update execution record with analysis
    await db
      .update(workflowExecutions)
      .set({ vigilAnalysis: analysis })
      .where(eq(workflowExecutions.id, executionId));

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("Failed to analyze execution:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to analyze execution",
      },
      { status: 500 }
    );
  }
}
// end keeperhub code //
