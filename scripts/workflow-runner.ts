/**
 * Workflow Runner Script
 *
 * Executes a single workflow in an isolated K8s Job container.
 * Receives workflow context via environment variables, executes the workflow,
 * updates the database, and exits.
 *
 * Usage (via bootstrap script that patches 'server-only'):
 *   node scripts/workflow-runner-bootstrap.cjs
 *
 * Usage (in Docker container where 'server-only' is already shimmed):
 *   tsx scripts/workflow-runner.ts
 *
 * Environment variables (required):
 *   WORKFLOW_ID - ID of the workflow to execute
 *   EXECUTION_ID - ID of the execution record (pre-created by job spawner)
 *   DATABASE_URL - PostgreSQL connection string
 *   INTEGRATION_ENCRYPTION_KEY - Key for decrypting integration credentials
 *
 * Environment variables (optional):
 *   WORKFLOW_INPUT - JSON string of trigger input (default: {})
 *   SCHEDULE_ID - ID of the schedule (for scheduled executions)
 */

import { CronExpressionParser } from "cron-parser";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { validateWorkflowIntegrations } from "../lib/db/integrations";
import { SHUTDOWN_TIMEOUT_MS } from "../lib/workflow-runner/constants";
import {
  workflowExecutions,
  workflowSchedules,
  workflows,
} from "../lib/db/schema";
import { executeWorkflow } from "../lib/workflow-executor.workflow";
import { calculateTotalSteps } from "../lib/workflow-progress";
import type { WorkflowEdge, WorkflowNode } from "../lib/workflow-store";

// Validate required environment variables
function validateEnv(): {
  workflowId: string;
  executionId: string;
  input: Record<string, unknown>;
  scheduleId?: string;
} {
  const workflowId = process.env.WORKFLOW_ID;
  const executionId = process.env.EXECUTION_ID;

  if (!workflowId) {
    console.error("[Runner] WORKFLOW_ID environment variable is required");
    process.exit(1);
  }

  if (!executionId) {
    console.error("[Runner] EXECUTION_ID environment variable is required");
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error("[Runner] DATABASE_URL environment variable is required");
    process.exit(1);
  }

  let input: Record<string, unknown> = {};
  if (process.env.WORKFLOW_INPUT) {
    try {
      input = JSON.parse(process.env.WORKFLOW_INPUT);
    } catch (error) {
      console.error("[Runner] Failed to parse WORKFLOW_INPUT:", error);
      process.exit(1);
    }
  }

  return {
    workflowId,
    executionId,
    input,
    scheduleId: process.env.SCHEDULE_ID,
  };
}

// Database connection with timeout configuration
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}
const queryClient = postgres(connectionString, {
  connect_timeout: 10, // 10s connection timeout
  idle_timeout: 30, // Close idle connections after 30s
  max_lifetime: 60 * 5, // Max connection lifetime 5 minutes
  connection: {
    statement_timeout: 30_000, // 30s query timeout
  },
});
const db = drizzle(queryClient, {
  schema: { workflows, workflowExecutions, workflowSchedules },
});

// Graceful shutdown state tracking
let isShuttingDown = false;
let currentExecutionId: string | null = null;
let currentScheduleId: string | null = null;

/**
 * Handle graceful shutdown on SIGTERM/SIGINT
 * Updates execution status and closes database connection before exit
 */
async function handleGracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    console.log(`[Runner] Already shutting down, ignoring ${signal}`);
    return;
  }

  isShuttingDown = true;
  console.log(`[Runner] Received ${signal}, initiating graceful shutdown...`);

  const shutdownTimeout = setTimeout(() => {
    console.error("[Runner] Graceful shutdown timeout, forcing exit");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  try {
    // Update execution status if we have an active execution
    if (currentExecutionId) {
      console.log(
        `[Runner] Updating execution ${currentExecutionId} status to error`
      );
      await updateExecutionStatus(currentExecutionId, "error", {
        error: `Workflow terminated by ${signal} signal`,
      });

      // Update schedule status if this was a scheduled execution
      if (currentScheduleId) {
        await updateScheduleStatus(
          currentScheduleId,
          "error",
          `Workflow terminated by ${signal} signal`
        );
      }
    }

    // Close database connection
    await queryClient.end();
    console.log("[Runner] Database connection closed");
  } catch (error) {
    console.error("[Runner] Error during graceful shutdown:", error);
  } finally {
    clearTimeout(shutdownTimeout);
    console.log("[Runner] Graceful shutdown complete");
    process.exit(1);
  }
}

// Register signal handlers for graceful shutdown
process.on("SIGTERM", () => handleGracefulShutdown("SIGTERM"));
process.on("SIGINT", () => handleGracefulShutdown("SIGINT"));

/**
 * Update execution status in database
 */
async function updateExecutionStatus(
  executionId: string,
  status: "running" | "success" | "error",
  result?: {
    output?: unknown;
    error?: string;
  }
): Promise<void> {
  const updateData: Record<string, unknown> = {
    status,
    updatedAt: new Date(),
  };

  if (status === "success" || status === "error") {
    updateData.completedAt = new Date();
  }

  if (result?.output !== undefined) {
    updateData.output = result.output;
  }

  if (result?.error) {
    updateData.error = result.error;
  }

  await db
    .update(workflowExecutions)
    .set(updateData)
    .where(eq(workflowExecutions.id, executionId));
}

/**
 * Compute next run time for a cron expression
 */
function computeNextRunTime(
  cronExpression: string,
  timezone: string
): Date | null {
  try {
    const interval = CronExpressionParser.parse(cronExpression, {
      currentDate: new Date(),
      tz: timezone,
    });
    return interval.next().toDate();
  } catch {
    return null;
  }
}

/**
 * Initialize progress tracking for an execution
 */
async function initializeExecutionProgress(
  executionId: string,
  totalSteps: number
): Promise<void> {
  await db
    .update(workflowExecutions)
    .set({
      totalSteps: totalSteps.toString(),
      completedSteps: "0",
      executionTrace: [],
      currentNodeId: null,
      currentNodeName: null,
      lastSuccessfulNodeId: null,
      lastSuccessfulNodeName: null,
    })
    .where(eq(workflowExecutions.id, executionId));
}

/**
 * Update schedule status after execution
 */
async function updateScheduleStatus(
  scheduleId: string,
  status: "success" | "error",
  error?: string
): Promise<void> {
  const schedule = await db.query.workflowSchedules.findFirst({
    where: eq(workflowSchedules.id, scheduleId),
  });

  if (!schedule) {
    return;
  }

  const nextRunAt = computeNextRunTime(
    schedule.cronExpression,
    schedule.timezone
  );

  const runCount =
    status === "success"
      ? String(Number(schedule.runCount || "0") + 1)
      : schedule.runCount;

  await db
    .update(workflowSchedules)
    .set({
      lastRunAt: new Date(),
      lastStatus: status,
      lastError: status === "error" ? error : null,
      nextRunAt,
      runCount,
      updatedAt: new Date(),
    })
    .where(eq(workflowSchedules.id, scheduleId));
}

/**
 * Main execution function
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Main runner orchestrates multiple phases of workflow execution
async function main(): Promise<void> {
  const startTime = Date.now();
  const { workflowId, executionId, input, scheduleId } = validateEnv();

  // Track execution IDs for graceful shutdown handler
  currentExecutionId = executionId;
  currentScheduleId = scheduleId ?? null;

  console.log("[Runner] Starting workflow execution");
  console.log(`[Runner] Workflow ID: ${workflowId}`);
  console.log(`[Runner] Execution ID: ${executionId}`);
  console.log(`[Runner] Schedule ID: ${scheduleId || "none"}`);

  try {
    // Check if we're already shutting down
    if (isShuttingDown) {
      console.log("[Runner] Shutdown in progress, aborting execution");
      return;
    }

    // Update execution status to running
    await updateExecutionStatus(executionId, "running");

    // Fetch workflow from database
    const workflow = await db.query.workflows.findFirst({
      where: eq(workflows.id, workflowId),
    });

    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    console.log(`[Runner] Loaded workflow: ${workflow.name || workflowId}`);

    // Validate integration ownership
    const nodes = workflow.nodes as WorkflowNode[];
    const edges = workflow.edges as WorkflowEdge[];
    const validation = await validateWorkflowIntegrations(
      nodes,
      workflow.userId
    );

    if (!validation.valid) {
      throw new Error(
        `Workflow contains invalid integration references: ${validation.invalidIds?.join(", ")}`
      );
    }

    // Initialize progress tracking
    const totalSteps = calculateTotalSteps(nodes, edges);
    console.log(`[Runner] Total steps: ${totalSteps}`);
    await initializeExecutionProgress(executionId, totalSteps);

    // Check if shutdown was requested before starting long-running execution
    if (isShuttingDown) {
      console.log("[Runner] Shutdown requested, aborting before execution");
      return;
    }

    // Execute the workflow
    console.log("[Runner] Executing workflow...");
    const result = await executeWorkflow({
      nodes,
      edges: workflow.edges as WorkflowEdge[],
      triggerInput: input,
      executionId,
      workflowId,
    });

    const duration = Date.now() - startTime;
    console.log(`[Runner] Workflow completed in ${duration}ms`);
    console.log(`[Runner] Success: ${result.success}`);

    // Update execution status
    if (result.success) {
      await updateExecutionStatus(executionId, "success", {
        output: result.outputs,
      });

      // Update schedule status if this was a scheduled execution
      if (scheduleId) {
        await updateScheduleStatus(scheduleId, "success");
      }

      // Clear execution ID so signal handler doesn't update completed execution
      currentExecutionId = null;
      console.log("[Runner] Execution completed successfully");
    } else {
      const errorMessage =
        result.error ||
        Object.values(result.results || {}).find((r) => !r.success)?.error ||
        "Unknown error";

      await updateExecutionStatus(executionId, "error", {
        error: errorMessage,
        output: result.outputs,
      });

      // Update schedule status if this was a scheduled execution
      if (scheduleId) {
        await updateScheduleStatus(scheduleId, "error", errorMessage);
      }

      // Clear execution ID so signal handler doesn't update already-handled execution
      currentExecutionId = null;
      // Workflow failure is a business logic outcome, not a system error
      // Exit 0 because we successfully executed and recorded the result
      console.error("[Runner] Workflow execution failed:", errorMessage);
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    console.error(`[Runner] Fatal error after ${duration}ms:`, errorMessage);

    // Update execution status with error
    // Only exit 1 if we fail to record the error (system failure)
    let dbUpdateSucceeded = false;
    try {
      await updateExecutionStatus(executionId, "error", {
        error: errorMessage,
      });

      // Update schedule status if this was a scheduled execution
      if (scheduleId) {
        await updateScheduleStatus(scheduleId, "error", errorMessage);
      }
      dbUpdateSucceeded = true;
    } catch (updateError) {
      console.error("[Runner] Failed to update execution status:", updateError);
      // System error: couldn't record the failure to database
      process.exitCode = 1;
    }

    // Clear execution ID so signal handler doesn't update already-handled execution
    currentExecutionId = null;

    if (dbUpdateSucceeded) {
      // We recorded the error successfully - this is a normal completion
      console.log("[Runner] Error recorded to database, exiting normally");
    }
  } finally {
    // Clean up database connection (skip if shutdown handler already closed it)
    if (!isShuttingDown) {
      await queryClient.end();
      console.log("[Runner] Database connection closed");
    }
  }
}

// Run main function
// Exit codes:
//   0 = Container completed successfully (workflow ran and result recorded, even if workflow failed)
//   1 = System/runtime error (DB unreachable, signal termination, unhandled exception)
main()
  .then(() => {
    process.exit(process.exitCode ?? 0);
  })
  .catch((error) => {
    // Unhandled exception is a system error
    console.error("[Runner] Unhandled error:", error);
    process.exit(1);
  });
