import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workflowExecutionLogs, workflowExecutions } from "@/lib/db/schema";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, data } = body;

    if (action === "start") {
      // Start node execution log
      const { executionId, nodeId, nodeName, nodeType, input } = data;

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

    if (action === "complete") {
      // Check if this is a workflow execution completion or node execution completion
      if (data.executionId && !data.logId) {
        // This is the overall workflow execution completion
        const {
          executionId: execId,
          status: execStatus,
          output: execOutput,
          error: execError,
          startTime: execStartTime,
        } = data;
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

      // Complete node execution log
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
