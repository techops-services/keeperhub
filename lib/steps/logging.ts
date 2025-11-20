/**
 * Logging step for workflow execution tracking
 */
import "server-only";

import { eq } from "drizzle-orm";
import { db } from "../db";
import { workflowExecutionLogs } from "../db/schema";

export type LogNodeStartInput = {
  executionId: string;
  nodeId: string;
  nodeName: string;
  nodeType: string;
  input?: unknown;
};

export type LogNodeCompleteInput = {
  logId: string;
  startTime: number;
  status: "success" | "error";
  output?: unknown;
  error?: string;
};

export async function logNodeStartStep(
  input: LogNodeStartInput
): Promise<{ logId: string; startTime: number }> {
  "use step";

  try {
    const [log] = await db
      .insert(workflowExecutionLogs)
      .values({
        executionId: input.executionId,
        nodeId: input.nodeId,
        nodeName: input.nodeName,
        nodeType: input.nodeType,
        status: "running",
        input: input.input,
        startedAt: new Date(),
      })
      .returning();

    return {
      logId: log.id,
      startTime: Date.now(),
    };
  } catch (error) {
    console.error("Failed to log node start:", error);
    return {
      logId: "",
      startTime: Date.now(),
    };
  }
}

export async function logNodeCompleteStep(
  input: LogNodeCompleteInput
): Promise<void> {
  "use step";

  if (!input.logId) {
    return;
  }

  try {
    const duration = Date.now() - input.startTime;

    await db
      .update(workflowExecutionLogs)
      .set({
        status: input.status,
        output: input.output,
        error: input.error,
        completedAt: new Date(),
        duration: duration.toString(),
      })
      .where(eq(workflowExecutionLogs.id, input.logId));
  } catch (error) {
    console.error("Failed to log node completion:", error);
  }
}
