/**
 * Job Spawner Script
 *
 * Polls SQS for scheduled workflow triggers and creates K8s Jobs to execute them.
 * Replaces the previous executor that called the KeeperHub API directly.
 *
 * Usage:
 *   tsx scripts/job-spawner.ts
 *
 * Environment variables:
 *   DATABASE_URL - PostgreSQL connection string
 *   AWS_ENDPOINT_URL - LocalStack endpoint (default: http://localhost:4566)
 *   SQS_QUEUE_URL - SQS queue URL
 *   RUNNER_IMAGE - Docker image for workflow runner (default: keeperhub-runner:latest)
 *   K8S_NAMESPACE - Kubernetes namespace (default: local)
 *   JOB_TTL_SECONDS - Time to keep completed jobs (default: 3600)
 *   JOB_ACTIVE_DEADLINE - Max execution time in seconds (default: 300)
 */

import {
  DeleteMessageCommand,
  type Message,
  ReceiveMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";
import { BatchV1Api, KubeConfig, type V1Job } from "@kubernetes/client-node";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  workflowExecutions,
  workflowSchedules,
  workflows,
} from "../lib/db/schema";
import { generateId } from "../lib/utils/id";

// Configuration
const CONFIG = {
  // Database
  databaseUrl: process.env.DATABASE_URL || "postgres://localhost:5432/workflow",

  // SQS
  awsRegion: process.env.AWS_REGION || "us-east-1",
  awsEndpoint: process.env.AWS_ENDPOINT_URL, // Only set for local dev (LocalStack)
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test",
  sqsQueueUrl:
    process.env.SQS_QUEUE_URL ||
    "http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/keeperhub-workflow-queue",

  // K8s Job settings
  runnerImage: process.env.RUNNER_IMAGE || "keeperhub-runner:latest",
  namespace: process.env.K8S_NAMESPACE || "local",
  jobTtlSeconds: Number(process.env.JOB_TTL_SECONDS) || 3600,
  jobActiveDeadline: Number(process.env.JOB_ACTIVE_DEADLINE) || 300,

  // Polling settings
  visibilityTimeout: 300, // 5 minutes
  waitTimeSeconds: 20, // Long polling
  maxMessages: 10,
};

// Database connection
const queryClient = postgres(CONFIG.databaseUrl);
const db = drizzle(queryClient, {
  schema: { workflows, workflowExecutions, workflowSchedules },
});

// SQS client - only use custom endpoint/credentials for local development
const sqsConfig: ConstructorParameters<typeof SQSClient>[0] = {
  region: CONFIG.awsRegion,
};

// Only set endpoint for local development (LocalStack)
if (CONFIG.awsEndpoint) {
  sqsConfig.endpoint = CONFIG.awsEndpoint;
  sqsConfig.credentials = {
    accessKeyId: CONFIG.awsAccessKeyId,
    secretAccessKey: CONFIG.awsSecretAccessKey,
  };
}

const sqs = new SQSClient(sqsConfig);

// K8s client
const kc = new KubeConfig();
kc.loadFromDefault(); // Uses in-cluster config when running in K8s, or ~/.kube/config locally
const batchApi = kc.makeApiClient(BatchV1Api);

type ScheduleMessage = {
  workflowId: string;
  scheduleId: string;
  triggerTime: string;
  triggerType: "schedule";
};

/**
 * Create a K8s Job to execute a workflow
 */
async function createWorkflowJob(
  workflowId: string,
  executionId: string,
  scheduleId: string,
  input: Record<string, unknown>
): Promise<V1Job> {
  const jobName = `workflow-${executionId.substring(0, 8)}-${Date.now()}`;

  const job: V1Job = {
    apiVersion: "batch/v1",
    kind: "Job",
    metadata: {
      name: jobName,
      namespace: CONFIG.namespace,
      labels: {
        app: "workflow-runner",
        "workflow-id": workflowId,
        "execution-id": executionId,
        "schedule-id": scheduleId,
      },
    },
    spec: {
      ttlSecondsAfterFinished: CONFIG.jobTtlSeconds,
      backoffLimit: 0, // No retries - handle at application level
      activeDeadlineSeconds: CONFIG.jobActiveDeadline,
      template: {
        metadata: {
          labels: {
            app: "workflow-runner",
            "workflow-id": workflowId,
            "execution-id": executionId,
          },
        },
        spec: {
          restartPolicy: "Never",
          containers: [
            {
              name: "runner",
              image: CONFIG.runnerImage,
              imagePullPolicy: "Never", // Local dev - image loaded via minikube
              env: [
                { name: "WORKFLOW_ID", value: workflowId },
                { name: "EXECUTION_ID", value: executionId },
                { name: "SCHEDULE_ID", value: scheduleId },
                { name: "WORKFLOW_INPUT", value: JSON.stringify(input) },
                // Database and secrets from ConfigMap/Secret
                {
                  name: "DATABASE_URL",
                  valueFrom: {
                    configMapKeyRef: {
                      name: "scheduler-env",
                      key: "DATABASE_URL",
                    },
                  },
                },
                {
                  name: "INTEGRATION_ENCRYPTION_KEY",
                  valueFrom: {
                    secretKeyRef: {
                      name: "keeperhub-secrets",
                      key: "integration-encryption-key",
                      optional: true,
                    },
                  },
                },
              ],
              resources: {
                requests: {
                  memory: "128Mi",
                  cpu: "100m",
                },
                limits: {
                  memory: "512Mi",
                  cpu: "500m",
                },
              },
            },
          ],
        },
      },
    },
  };

  const response = await batchApi.createNamespacedJob({
    namespace: CONFIG.namespace,
    body: job,
  });

  return response;
}

/**
 * Process a single scheduled workflow message
 */
async function processScheduledWorkflow(
  message: ScheduleMessage
): Promise<void> {
  const { workflowId, scheduleId, triggerTime } = message;

  console.log(`[JobSpawner] Processing workflow ${workflowId}`);

  // Get workflow to validate it exists and get userId
  const workflow = await db.query.workflows.findFirst({
    where: eq(workflows.id, workflowId),
  });

  if (!workflow) {
    console.error(`[JobSpawner] Workflow not found: ${workflowId}`);
    return;
  }

  // Verify schedule exists and is enabled
  const schedule = await db.query.workflowSchedules.findFirst({
    where: eq(workflowSchedules.id, scheduleId),
  });

  if (!schedule) {
    console.error(`[JobSpawner] Schedule not found: ${scheduleId}`);
    return;
  }

  if (!schedule.enabled) {
    console.log(`[JobSpawner] Schedule disabled, skipping: ${scheduleId}`);
    return;
  }

  // Create execution record with 'pending' status
  const executionId = generateId();
  await db.insert(workflowExecutions).values({
    id: executionId,
    workflowId,
    userId: workflow.userId,
    status: "pending", // Will be updated to 'running' by the job
    input: {
      triggerType: "schedule",
      scheduleId,
      triggerTime,
    },
  });

  console.log(`[JobSpawner] Created execution record: ${executionId}`);

  // Create K8s Job
  try {
    const job = await createWorkflowJob(workflowId, executionId, scheduleId, {
      triggerType: "schedule",
      scheduleId,
      triggerTime,
    });

    console.log(
      `[JobSpawner] Created K8s Job: ${job.metadata?.name} for execution ${executionId}`
    );
  } catch (error) {
    console.error("[JobSpawner] Failed to create K8s Job:", error);

    // Update execution record with error
    await db
      .update(workflowExecutions)
      .set({
        status: "error",
        error:
          error instanceof Error
            ? `Failed to create job: ${error.message}`
            : "Failed to create job",
        completedAt: new Date(),
      })
      .where(eq(workflowExecutions.id, executionId));

    throw error;
  }
}

/**
 * Process a single SQS message
 */
async function processMessage(message: Message): Promise<void> {
  if (!(message.Body && message.ReceiptHandle)) {
    console.error("[JobSpawner] Invalid message:", message);
    return;
  }

  const body: ScheduleMessage = JSON.parse(message.Body);

  try {
    await processScheduledWorkflow(body);

    // Delete message on success
    await sqs.send(
      new DeleteMessageCommand({
        QueueUrl: CONFIG.sqsQueueUrl,
        ReceiptHandle: message.ReceiptHandle,
      })
    );

    console.log(`[JobSpawner] Message deleted for workflow ${body.workflowId}`);
  } catch (error) {
    console.error(
      `[JobSpawner] Failed to process workflow ${body.workflowId}:`,
      error
    );
    // Don't delete message - it will become visible again after timeout
  }
}

/**
 * Main listener loop
 */
async function listen(): Promise<void> {
  console.log("[JobSpawner] Starting SQS listener...");
  console.log(`[JobSpawner] Queue URL: ${CONFIG.sqsQueueUrl}`);
  console.log(`[JobSpawner] Runner image: ${CONFIG.runnerImage}`);
  console.log(`[JobSpawner] K8s namespace: ${CONFIG.namespace}`);

  while (true) {
    try {
      const response = await sqs.send(
        new ReceiveMessageCommand({
          QueueUrl: CONFIG.sqsQueueUrl,
          MaxNumberOfMessages: CONFIG.maxMessages,
          WaitTimeSeconds: CONFIG.waitTimeSeconds,
          VisibilityTimeout: CONFIG.visibilityTimeout,
          MessageAttributeNames: ["All"],
        })
      );

      const messages = response.Messages || [];

      if (messages.length > 0) {
        console.log(`[JobSpawner] Received ${messages.length} messages`);

        // Process messages sequentially to avoid overwhelming K8s API
        for (const msg of messages) {
          await processMessage(msg);
        }
      }
    } catch (error) {
      console.error("[JobSpawner] Error receiving messages:", error);
      // Back off on error
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n[JobSpawner] Shutting down...");
  await queryClient.end();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n[JobSpawner] Shutting down...");
  await queryClient.end();
  process.exit(0);
});

// Start listener
listen();
