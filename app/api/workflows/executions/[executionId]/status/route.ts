import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
// start custom keeperhub code //
import { getOrgContext } from "@/keeperhub/lib/middleware/org-context";
// end keeperhub code //
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { workflowExecutionLogs, workflowExecutions } from "@/lib/db/schema";

// start custom keeperhub code //
import { recordStatusPollMetrics } from "@/keeperhub/lib/metrics/instrumentation/api";
import { createTimer } from "@/keeperhub/lib/metrics";
// end keeperhub code //

type NodeStatus = {
  nodeId: string;
  status: "pending" | "running" | "success" | "error";
};

export async function GET(
  request: Request,
  context: { params: Promise<{ executionId: string }> }
) {
  // start custom keeperhub code //
  const timer = createTimer();
  // end keeperhub code //

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

    if (!(isOwner || isSameOrg)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // end keeperhub code //

    // Get logs for all nodes
    const logs = await db.query.workflowExecutionLogs.findMany({
      where: eq(workflowExecutionLogs.executionId, executionId),
    });

    // Map logs to node statuses
    const nodeStatuses: NodeStatus[] = logs.map((log) => ({
      nodeId: log.nodeId,
      status: log.status,
    }));

    // Calculate running count for parallel execution visibility
    const runningCount = nodeStatuses.filter(
      (n) => n.status === "running"
    ).length;
    const totalSteps = Number.parseInt(execution.totalSteps || "0", 10);
    const completedSteps = Number.parseInt(execution.completedSteps || "0", 10);

    // Build progress data
    const progress = {
      totalSteps,
      completedSteps,
      runningSteps: runningCount,
      currentNodeId: execution.currentNodeId,
      currentNodeName: execution.currentNodeName,
      percentage:
        totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
    };

    // Build error context (only when failed)
    const errorContext =
      execution.status === "error"
        ? {
            failedNodeId: execution.currentNodeId,
            lastSuccessfulNodeId: execution.lastSuccessfulNodeId,
            lastSuccessfulNodeName: execution.lastSuccessfulNodeName,
            executionTrace: execution.executionTrace,
            error: execution.error,
          }
        : null;

    // start custom keeperhub code //
    recordStatusPollMetrics({
      executionId,
      durationMs: timer(),
      statusCode: 200,
      executionStatus: execution.status,
    });
    // end keeperhub code //

    return NextResponse.json({
      status: execution.status,
      nodeStatuses,
      progress,
      errorContext,
    });
  } catch (error) {
    console.error("Failed to get execution status:", error);

    // start custom keeperhub code //
    const { executionId } = await context.params;
    recordStatusPollMetrics({
      executionId,
      durationMs: timer(),
      statusCode: 500,
    });
    // end keeperhub code //

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to get execution status",
      },
      { status: 500 }
    );
  }
}
