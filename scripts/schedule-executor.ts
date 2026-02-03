/**
 * Schedule Executor Script
 *
 * Polls SQS for scheduled workflow triggers and executes them.
 * Runs continuously as a long-polling listener.
 *
 * Usage:
 *   npx tsx scripts/schedule-executor.ts
 *
 * Environment variables:
 *   DATABASE_URL - PostgreSQL connection string
 *   AWS_ENDPOINT_URL - LocalStack endpoint (default: http://localhost:4566)
 *   SQS_QUEUE_URL - SQS queue URL (default: LocalStack queue)
 *   KEEPERHUB_URL - KeeperHub API URL (default: http://localhost:3000)
 */

import {
  DeleteMessageCommand,
  type Message,
  ReceiveMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";
import { CronExpressionParser } from "cron-parser";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getDatabaseUrl } from "../lib/db/connection-utils";
import {
  workflowExecutions,
  workflowSchedules,
  workflows,
} from "../lib/db/schema";
import { generateId } from "../lib/utils/id";

// Database connection
const connectionString = getDatabaseUrl();
const queryClient = postgres(connectionString);
const db = drizzle(queryClient, {
  schema: { workflows, workflowExecutions, workflowSchedules },
});

// SQS client - only use custom endpoint/credentials for local development
const sqsConfig: ConstructorParameters<typeof SQSClient>[0] = {
  region: process.env.AWS_REGION || "us-east-1",
};

// Only set endpoint for local development (LocalStack)
if (process.env.AWS_ENDPOINT_URL) {
  sqsConfig.endpoint = process.env.AWS_ENDPOINT_URL;
  sqsConfig.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test",
  };
}

const sqs = new SQSClient(sqsConfig);

const QUEUE_URL =
  process.env.SQS_QUEUE_URL ||
  "http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/keeperhub-workflow-queue";

const KEEPERHUB_URL = process.env.KEEPERHUB_URL || "http://localhost:3000";

const VISIBILITY_TIMEOUT = 300; // 5 minutes
const WAIT_TIME_SECONDS = 20; // Long polling
const MAX_MESSAGES = 10;

type ScheduleMessage = {
  workflowId: string;
  scheduleId: string;
  triggerTime: string;
  triggerType: "schedule";
};

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
 * Update schedule after execution
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
 * Process a single scheduled workflow message
 */
async function processScheduledWorkflow(
  message: ScheduleMessage
): Promise<void> {
  const { workflowId, scheduleId, triggerTime } = message;

  console.log(`[Executor] Processing workflow ${workflowId}`);

  // Get workflow
  const workflow = await db.query.workflows.findFirst({
    where: eq(workflows.id, workflowId),
  });

  if (!workflow) {
    console.error(`[Executor] Workflow not found: ${workflowId}`);
    await updateScheduleStatus(scheduleId, "error", "Workflow not found");
    return;
  }

  // Verify workflow is enabled (double-check in case it was disabled after dispatch)
  if (!workflow.enabled) {
    console.log(`[Executor] Workflow disabled, skipping: ${workflowId}`);
    return;
  }

  // Verify schedule exists and is enabled
  const schedule = await db.query.workflowSchedules.findFirst({
    where: eq(workflowSchedules.id, scheduleId),
  });

  if (!schedule) {
    console.error(`[Executor] Schedule not found: ${scheduleId}`);
    return;
  }

  if (!schedule.enabled) {
    console.log(`[Executor] Schedule disabled, skipping: ${scheduleId}`);
    return;
  }

  // Create execution record
  const executionId = generateId();
  await db.insert(workflowExecutions).values({
    id: executionId,
    workflowId,
    userId: workflow.userId,
    status: "running",
    input: {
      triggerType: "schedule",
      scheduleId,
      triggerTime,
    },
  });

  console.log(`[Executor] Created execution ${executionId}`);

  try {
    // Call KeeperHub API to execute workflow
    const response = await fetch(
      `${KEEPERHUB_URL}/api/workflow/${workflowId}/execute`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Service-Key": process.env.SCHEDULER_SERVICE_API_KEY || "",
        },
        body: JSON.stringify({
          executionId,
          input: {
            triggerType: "schedule",
            scheduleId,
            triggerTime,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API call failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`[Executor] Execution started: ${result.executionId}`);

    // Update schedule status
    await updateScheduleStatus(scheduleId, "success");
  } catch (error) {
    console.error(`[Executor] Execution failed for ${workflowId}:`, error);

    // Update execution record with error
    await db
      .update(workflowExecutions)
      .set({
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        completedAt: new Date(),
      })
      .where(eq(workflowExecutions.id, executionId));

    // Update schedule status
    await updateScheduleStatus(
      scheduleId,
      "error",
      error instanceof Error ? error.message : "Unknown error"
    );

    throw error;
  }
}

/**
 * Process a single SQS message
 */
async function processMessage(message: Message): Promise<void> {
  if (!(message.Body && message.ReceiptHandle)) {
    console.error("[Executor] Invalid message:", message);
    return;
  }

  const body: ScheduleMessage = JSON.parse(message.Body);

  try {
    await processScheduledWorkflow(body);

    // Delete message on success
    await sqs.send(
      new DeleteMessageCommand({
        QueueUrl: QUEUE_URL,
        ReceiptHandle: message.ReceiptHandle,
      })
    );

    console.log(`[Executor] Message deleted for workflow ${body.workflowId}`);
  } catch (error) {
    console.error(
      `[Executor] Failed to process workflow ${body.workflowId}:`,
      error
    );
    // Don't delete message - it will become visible again after timeout
  }
}

/**
 * Main listener loop
 */
async function listen(): Promise<void> {
  console.log("[Executor] Starting SQS listener...");
  console.log(`[Executor] Queue URL: ${QUEUE_URL}`);
  console.log(`[Executor] KeeperHub URL: ${KEEPERHUB_URL}`);

  while (true) {
    try {
      const response = await sqs.send(
        new ReceiveMessageCommand({
          QueueUrl: QUEUE_URL,
          MaxNumberOfMessages: MAX_MESSAGES,
          WaitTimeSeconds: WAIT_TIME_SECONDS,
          VisibilityTimeout: VISIBILITY_TIMEOUT,
          MessageAttributeNames: ["All"],
        })
      );

      const messages = response.Messages || [];

      if (messages.length > 0) {
        console.log(`[Executor] Received ${messages.length} messages`);

        // Process messages concurrently
        const results = await Promise.allSettled(
          messages.map((msg) => processMessage(msg))
        );

        // Log any failures
        results.forEach((result, idx) => {
          if (result.status === "rejected") {
            console.error(`[Executor] Message ${idx} failed:`, result.reason);
          }
        });
      }
    } catch (error) {
      console.error("[Executor] Error receiving messages:", error);
      // Back off on error
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n[Executor] Shutting down...");
  await queryClient.end();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n[Executor] Shutting down...");
  await queryClient.end();
  process.exit(0);
});

// Start listener
listen();
