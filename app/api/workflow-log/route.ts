import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { workflowExecutionLogs, workflowExecutions } from "@/lib/db/schema";

async function handleStartAction(
  session: { user: { id: string } },
  data: {
    executionId: string;
    nodeId: string;
    nodeName: string;
    nodeType: string;
    input: unknown;
  }
) {
  const { executionId, nodeId, nodeName, nodeType, input } = data;

  // Verify the execution belongs to the user
  const execution = await db.query.workflowExecutions.findFirst({
    where: eq(workflowExecutions.id, executionId),
    with: {
      workflow: true,
    },
  });

  if (!execution) {
    return NextResponse.json({ error: "Execution not found" }, { status: 404 });
  }

  if (execution.workflow.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [log] = await db
    .insert(workflowExecutionLogs)
    .values({
      executionId,
      nodeId,
      nodeName,
      nodeType,
      status: "running",
      input,
      startedAt: new Date(),
    })
    .returning();

  return NextResponse.json({
    logId: log.id,
    startTime: Date.now(),
  });
}

async function handleWorkflowCompletion(
  session: { user: { id: string } },
  data: {
    executionId: string;
    status: "pending" | "running" | "success" | "error" | "cancelled";
    output: unknown;
    error: string;
    startTime: number;
  }
) {
  const {
    executionId: execId,
    status: execStatus,
    output: execOutput,
    error: execError,
    startTime: execStartTime,
  } = data;

  // Verify the execution belongs to the user
  const execution = await db.query.workflowExecutions.findFirst({
    where: eq(workflowExecutions.id, execId),
    with: {
      workflow: true,
    },
  });

  if (!execution) {
    return NextResponse.json({ error: "Execution not found" }, { status: 404 });
  }

  if (execution.workflow.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const duration = Date.now() - execStartTime;

  await db
    .update(workflowExecutions)
    .set({
      status: execStatus,
      output: execOutput,
      error: execError,
      completedAt: new Date(),
      duration: duration.toString(),
    })
    .where(eq(workflowExecutions.id, execId));

  return NextResponse.json({ success: true });
}

async function handleNodeCompletion(
  session: { user: { id: string } },
  data: {
    logId: string;
    startTime: number;
    status: "pending" | "running" | "success" | "error";
    output: unknown;
    error: string;
  }
) {
  const {
    logId,
    startTime: nodeStartTime,
    status: nodeStatus,
    output: nodeOutput,
    error: nodeError,
  } = data;

  if (!logId) {
    return NextResponse.json({ success: true });
  }

  // Verify the log belongs to the user
  const log = await db.query.workflowExecutionLogs.findFirst({
    where: eq(workflowExecutionLogs.id, logId),
  });

  if (!log) {
    return NextResponse.json({ error: "Log not found" }, { status: 404 });
  }

  // Get the execution to verify ownership
  const execution = await db.query.workflowExecutions.findFirst({
    where: eq(workflowExecutions.id, log.executionId),
    with: {
      workflow: true,
    },
  });

  if (!execution) {
    return NextResponse.json({ error: "Execution not found" }, { status: 404 });
  }

  if (execution.workflow.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const duration = Date.now() - nodeStartTime;

  await db
    .update(workflowExecutionLogs)
    .set({
      status: nodeStatus,
      output: nodeOutput,
      error: nodeError,
      completedAt: new Date(),
      duration: duration.toString(),
    })
    .where(eq(workflowExecutionLogs.id, logId));

  return NextResponse.json({ success: true });
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, data } = body;

    if (action === "start") {
      return handleStartAction(session, data);
    }

    if (action === "complete") {
      // Check if this is a workflow execution completion or node execution completion
      if (data.executionId && !data.logId) {
        return handleWorkflowCompletion(session, data);
      }

      return handleNodeCompletion(session, data);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Failed to log node execution:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to log",
      },
      { status: 500 }
    );
  }
}
