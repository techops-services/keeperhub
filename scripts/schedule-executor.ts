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
const SERVICE_API_KEY = process.env.SCHEDULER_SERVICE_API_KEY || "";

const VISIBILITY_TIMEOUT = 300; // 5 minutes
const WAIT_TIME_SECONDS = 20; // Long polling
const MAX_MESSAGES = 10;

type ScheduleMessage = {
  workflowId: string;
  scheduleId: string;
  triggerTime: string;
  triggerType: "schedule";
};

// Type definitions for API responses
type Workflow = {
  id: string;
  enabled: boolean;
  userId: string;
  nodes: unknown;
  edges: unknown;
};

type Schedule = {
  id: string;
  workflowId: string;
  cronExpression: string;
  timezone: string;
  enabled: boolean;
};

// HTTP helper for authenticated requests
async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${KEEPERHUB_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Service-Key": SERVICE_API_KEY,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${options.method || "GET"} ${path} failed: ${response.status} ${text}`);
  }

  return response.json();
}

// Fetch workflow by ID
async function fetchWorkflow(workflowId: string): Promise<Workflow | null> {
  try {
    const result = await apiRequest<{ workflow: Workflow }>(`/api/internal/workflows/${workflowId}`);
    return result.workflow;
  } catch (error) {
    if (error instanceof Error && error.message.includes("404")) {
      return null;
    }
    throw error;
  }
}

// Fetch schedule by ID
async function fetchSchedule(scheduleId: string): Promise<Schedule | null> {
  try {
    const result = await apiRequest<{ schedule: Schedule }>(`/api/internal/schedules/${scheduleId}`);
    return result.schedule;
  } catch (error) {
    if (error instanceof Error && error.message.includes("404")) {
      return null;
    }
    throw error;
  }
}

// Create execution record
async function createExecution(
  workflowId: string,
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const result = await apiRequest<{ executionId: string }>(
    "/api/internal/executions",
    {
      method: "POST",
      body: JSON.stringify({ workflowId, userId, input }),
    }
  );
  return result.executionId;
}

// Update execution status
async function updateExecution(
  executionId: string,
  status: "running" | "success" | "error",
  error?: string
): Promise<void> {
  await apiRequest(`/api/internal/executions/${executionId}`, {
    method: "PATCH",
    body: JSON.stringify({ status, error }),
  });
}

// Update schedule status after execution
async function updateScheduleStatus(
  scheduleId: string,
  status: "success" | "error",
  error?: string
): Promise<void> {
  await apiRequest(`/api/internal/schedules/${scheduleId}`, {
    method: "PATCH",
    body: JSON.stringify({ status, error }),
  });
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
 * Process a single scheduled workflow message
 */
async function processScheduledWorkflow(
  message: ScheduleMessage
): Promise<void> {
  const { workflowId, scheduleId, triggerTime } = message;

  console.log(`[Executor] Processing workflow ${workflowId}`);

  // Get workflow
  const workflow = await fetchWorkflow(workflowId);

  if (!workflow) {
    console.error(`[Executor] Workflow not found: ${workflowId}`);
    await updateScheduleStatus(scheduleId, "error", "Workflow not found");
    return;
  }

  if (!workflow.enabled) {
    console.log(`[Executor] Workflow disabled, skipping: ${workflowId}`);
    return;
  }

  // Verify schedule exists and is enabled
  const schedule = await fetchSchedule(scheduleId);

  if (!schedule) {
    console.error(`[Executor] Schedule not found: ${scheduleId}`);
    return;
  }

  if (!schedule.enabled) {
    console.log(`[Executor] Schedule disabled, skipping: ${scheduleId}`);
    return;
  }

  // Create execution record
  const executionId = await createExecution(
    workflowId,
    workflow.userId,
    {
      triggerType: "schedule",
      scheduleId,
      triggerTime,
    }
  );

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
    await updateExecution(
      executionId,
      "error",
      error instanceof Error ? error.message : "Unknown error"
    );

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
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n[Executor] Shutting down...");
  process.exit(0);
});

// Start listener
listen();
