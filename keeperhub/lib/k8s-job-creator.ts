/**
 * Shared utility for creating Kubernetes Jobs to execute workflows
 * Used by both the API route (manual executions) and job-spawner (scheduled executions)
 */

import { BatchV1Api, KubeConfig, type V1Job } from "@kubernetes/client-node";

// Initialize K8s client
const kc = new KubeConfig();
kc.loadFromDefault();

const batchApi = kc.makeApiClient(BatchV1Api);

export interface CreateWorkflowJobOptions {
  workflowId: string;
  executionId: string;
  input: Record<string, unknown>;
  scheduleId?: string; // Optional - only for scheduled executions
  namespace?: string;
  runnerImage?: string;
  imagePullPolicy?: "Always" | "IfNotPresent" | "Never";
  databaseUrl?: string;
  integrationEncryptionKey?: string;
  vigilApiUrl?: string;
  vigilApiKey?: string;
  vigilApiModel?: string;
  sendgridApiKey?: string;
  fromAddress?: string;
  jobTtlSeconds?: number;
  jobActiveDeadline?: number;
}

/**
 * Create a K8s Job to execute a workflow
 */
export async function createWorkflowJob(
  options: CreateWorkflowJobOptions
): Promise<V1Job> {
  const {
    workflowId,
    executionId,
    input,
    scheduleId = "",
    namespace = process.env.K8S_NAMESPACE || "local",
    runnerImage = process.env.RUNNER_IMAGE || "keeperhub-runner:latest",
    imagePullPolicy = (process.env.IMAGE_PULL_POLICY as
      | "Always"
      | "Never"
      | "IfNotPresent") || "Never",
    databaseUrl = process.env.DATABASE_URL || "",
    integrationEncryptionKey = process.env.INTEGRATION_ENCRYPTION_KEY || "",
    vigilApiUrl = process.env.VIGIL_API_URL || "",
    vigilApiKey = process.env.VIGIL_API_KEY || "",
    vigilApiModel = process.env.VIGIL_API_MODEL || "",
    sendgridApiKey = process.env.SENDGRID_API_KEY || "",
    fromAddress = process.env.FROM_ADDRESS || "",
    jobTtlSeconds = Number.parseInt(process.env.JOB_TTL_SECONDS || "3600", 10),
    jobActiveDeadline = Number.parseInt(
      process.env.JOB_ACTIVE_DEADLINE || "300",
      10
    ),
  } = options;

  const jobName = `workflow-${executionId.substring(0, 8)}-${Date.now()}`;

  const job: V1Job = {
    apiVersion: "batch/v1",
    kind: "Job",
    metadata: {
      name: jobName,
      namespace,
      labels: {
        app: "workflow-runner",
        "workflow-id": workflowId,
        "execution-id": executionId,
        ...(scheduleId ? { "schedule-id": scheduleId } : {}),
      },
    },
    spec: {
      ttlSecondsAfterFinished: jobTtlSeconds,
      backoffLimit: 0, // No retries - handle at application level
      activeDeadlineSeconds: jobActiveDeadline,
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
              image: runnerImage,
              imagePullPolicy,
              env: [
                { name: "WORKFLOW_ID", value: workflowId },
                { name: "EXECUTION_ID", value: executionId },
                ...(scheduleId
                  ? [{ name: "SCHEDULE_ID", value: scheduleId }]
                  : []),
                { name: "WORKFLOW_INPUT", value: JSON.stringify(input) },
                { name: "DATABASE_URL", value: databaseUrl },
                {
                  name: "INTEGRATION_ENCRYPTION_KEY",
                  value: integrationEncryptionKey,
                },
                ...(vigilApiUrl
                  ? [{ name: "VIGIL_API_URL", value: vigilApiUrl }]
                  : []),
                ...(vigilApiKey
                  ? [{ name: "VIGIL_API_KEY", value: vigilApiKey }]
                  : []),
                ...(vigilApiModel
                  ? [{ name: "VIGIL_API_MODEL", value: vigilApiModel }]
                  : []),
                ...(sendgridApiKey
                  ? [{ name: "SENDGRID_API_KEY", value: sendgridApiKey }]
                  : []),
                ...(fromAddress
                  ? [{ name: "FROM_ADDRESS", value: fromAddress }]
                  : []),
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
    namespace,
    body: job,
  });

  return response;
}
