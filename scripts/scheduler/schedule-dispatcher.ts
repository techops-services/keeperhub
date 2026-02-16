/**
 * Schedule Dispatcher Script
 *
 * Queries enabled workflow schedules and dispatches matching crons to SQS.
 * Run this every minute via cron or `watch -n 60`.
 *
 * Usage:
 *   npx tsx scripts/scheduler/schedule-dispatcher.ts
 *
 * Environment variables:
 *   DATABASE_URL - PostgreSQL connection string
 *   AWS_ENDPOINT_URL - LocalStack endpoint (default: http://localhost:4566)
 *   SQS_QUEUE_URL - SQS queue URL (default: LocalStack queue)
 */

import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { CronExpressionParser } from "cron-parser";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getDatabaseUrl } from "../../lib/db/connection-utils";
import { workflowSchedules, workflows } from "../../lib/db/schema";

// Database connection
const connectionString = getDatabaseUrl();
const queryClient = postgres(connectionString);
const db = drizzle(queryClient, { schema: { workflowSchedules, workflows } });

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

type ScheduleMessage = {
  workflowId: string;
  scheduleId: string;
  triggerTime: string;
  triggerType: "schedule";
};

/**
 * Check if a cron expression should trigger at the given time
 */
function shouldTriggerNow(
  cronExpression: string,
  timezone: string,
  now: Date
): boolean {
  try {
    const interval = CronExpressionParser.parse(cronExpression, {
      currentDate: now,
      tz: timezone,
    });

    // Get the previous occurrence
    const prev = interval.prev().toDate();

    // Check if the previous occurrence is within the current minute
    const diffMs = now.getTime() - prev.getTime();

    // Within current minute (0-59 seconds)
    return diffMs >= 0 && diffMs < 60_000;
  } catch (error) {
    console.error(`Invalid cron expression: ${cronExpression}`, error);
    return false;
  }
}

/**
 * Send message to SQS queue
 */
async function sendToQueue(message: ScheduleMessage): Promise<void> {
  const command = new SendMessageCommand({
    QueueUrl: QUEUE_URL,
    MessageBody: JSON.stringify(message),
    MessageAttributes: {
      TriggerType: {
        DataType: "String",
        StringValue: "schedule",
      },
      WorkflowId: {
        DataType: "String",
        StringValue: message.workflowId,
      },
    },
  });

  await sqs.send(command);
}

/**
 * Main dispatch function
 */
async function dispatch(): Promise<{
  evaluated: number;
  triggered: number;
  errors: number;
}> {
  const runId = crypto.randomUUID().slice(0, 8);
  console.log(
    `[${runId}] Starting dispatch run at ${new Date().toISOString()}`
  );

  // Query all enabled schedules for enabled workflows
  const schedules = await db
    .select({
      id: workflowSchedules.id,
      workflowId: workflowSchedules.workflowId,
      cronExpression: workflowSchedules.cronExpression,
      timezone: workflowSchedules.timezone,
    })
    .from(workflowSchedules)
    .innerJoin(workflows, eq(workflowSchedules.workflowId, workflows.id))
    .where(
      and(eq(workflowSchedules.enabled, true), eq(workflows.enabled, true))
    );

  console.log(`[${runId}] Found ${schedules.length} enabled schedules`);

  const now = new Date();
  let triggered = 0;
  let errors = 0;

  for (const schedule of schedules) {
    try {
      const shouldTrigger = shouldTriggerNow(
        schedule.cronExpression,
        schedule.timezone,
        now
      );

      if (shouldTrigger) {
        console.log(
          `[${runId}] Triggering workflow ${schedule.workflowId} ` +
            `(cron: ${schedule.cronExpression}, tz: ${schedule.timezone})`
        );

        await sendToQueue({
          workflowId: schedule.workflowId,
          scheduleId: schedule.id,
          triggerTime: now.toISOString(),
          triggerType: "schedule",
        });

        triggered += 1;
      }
    } catch (error) {
      console.error(
        `[${runId}] Error processing schedule ${schedule.id}:`,
        error
      );
      errors += 1;
    }
  }

  console.log(
    `[${runId}] Dispatch complete: evaluated=${schedules.length}, triggered=${triggered}, errors=${errors}`
  );

  return {
    evaluated: schedules.length,
    triggered,
    errors,
  };
}

// Main entry point
async function main() {
  try {
    const result = await dispatch();

    // Close database connection
    await queryClient.end();

    process.exit(result.errors > 0 ? 1 : 0);
  } catch (error) {
    console.error("Fatal error:", error);
    await queryClient.end();
    process.exit(1);
  }
}

main();
