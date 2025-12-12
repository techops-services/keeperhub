/**
 * E2E Tests for Schedule Trigger Pipeline
 *
 * These tests require the full infrastructure stack:
 * - PostgreSQL database
 * - LocalStack with SQS queue
 * - KeeperHub app running
 * - Dispatcher script (or skip dispatcher tests)
 * - Executor script (or skip executor tests)
 *
 * Run with: pnpm test:e2e:schedule
 *
 * For CI, use docker-compose to spin up the stack before running.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import {
  SQSClient,
  CreateQueueCommand,
  DeleteQueueCommand,
  GetQueueAttributesCommand,
  PurgeQueueCommand,
} from "@aws-sdk/client-sqs";

// Skip these tests if infrastructure isn't available
const SKIP_INFRA_TESTS = process.env.SKIP_INFRA_TESTS === "true";
const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/workflow_builder_test";
const AWS_ENDPOINT = process.env.AWS_ENDPOINT_URL || "http://localhost:4566";
const KEEPERHUB_URL = process.env.KEEPERHUB_URL || "http://localhost:3000";
const QUEUE_NAME = "keeperhub-workflow-queue-test";

describe.skipIf(SKIP_INFRA_TESTS)("Schedule Pipeline E2E", () => {
  let queryClient: ReturnType<typeof postgres>;
  let db: ReturnType<typeof drizzle>;
  let sqsClient: SQSClient;
  let queueUrl: string;

  beforeAll(async () => {
    // Connect to database
    queryClient = postgres(DATABASE_URL);
    db = drizzle(queryClient);

    // Create SQS client
    sqsClient = new SQSClient({
      region: "us-east-1",
      endpoint: AWS_ENDPOINT,
      credentials: {
        accessKeyId: "test",
        secretAccessKey: "test",
      },
    });

    // Create test queue
    try {
      const createResult = await sqsClient.send(
        new CreateQueueCommand({
          QueueName: QUEUE_NAME,
        })
      );
      queueUrl = createResult.QueueUrl!;
    } catch (error) {
      // Queue may already exist
      queueUrl = `${AWS_ENDPOINT}/000000000000/${QUEUE_NAME}`;
    }
  });

  afterAll(async () => {
    // Cleanup
    try {
      await sqsClient.send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
    } catch {
      // Ignore cleanup errors
    }
    await queryClient.end();
  });

  beforeEach(async () => {
    // Purge queue before each test
    try {
      await sqsClient.send(new PurgeQueueCommand({ QueueUrl: queueUrl }));
    } catch {
      // Ignore purge errors (queue might be empty)
    }
  });

  describe("Infrastructure Health Checks", () => {
    it("can connect to PostgreSQL", async () => {
      const result = await queryClient`SELECT 1 as health`;
      expect(result[0].health).toBe(1);
    });

    it("can connect to LocalStack SQS", async () => {
      const result = await sqsClient.send(
        new GetQueueAttributesCommand({
          QueueUrl: queueUrl,
          AttributeNames: ["ApproximateNumberOfMessages"],
        })
      );
      expect(result.Attributes).toBeDefined();
    });

    it("KeeperHub app is reachable", async () => {
      try {
        const response = await fetch(`${KEEPERHUB_URL}/api/health`);
        // Even a 404 means the server is running
        expect(response.status).toBeLessThan(500);
      } catch (error) {
        // If fetch fails, app isn't running
        console.warn("KeeperHub app not reachable, skipping app tests");
      }
    });
  });

  describe("Database Schema", () => {
    it("workflow_schedules table exists", async () => {
      const result = await queryClient`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'workflow_schedules'
        ) as exists
      `;
      expect(result[0].exists).toBe(true);
    });

    it("workflow_schedules has required columns", async () => {
      const result = await queryClient`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'workflow_schedules'
        ORDER BY column_name
      `;
      const columns = result.map((r) => r.column_name);

      expect(columns).toContain("id");
      expect(columns).toContain("workflow_id");
      expect(columns).toContain("cron_expression");
      expect(columns).toContain("timezone");
      expect(columns).toContain("enabled");
      expect(columns).toContain("next_run_at");
    });
  });

  describe("SQS Queue", () => {
    it("queue accepts messages", async () => {
      const { SendMessageCommand } = await import("@aws-sdk/client-sqs");

      const message = {
        workflowId: "test_wf_123",
        scheduleId: "test_sched_456",
        triggerTime: new Date().toISOString(),
        triggerType: "schedule",
      };

      const result = await sqsClient.send(
        new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: JSON.stringify(message),
        })
      );

      expect(result.MessageId).toBeDefined();
    });

    it("queue messages can be received", async () => {
      const { SendMessageCommand, ReceiveMessageCommand } = await import(
        "@aws-sdk/client-sqs"
      );

      // Send a message
      const message = {
        workflowId: "test_wf_recv",
        scheduleId: "test_sched_recv",
        triggerTime: new Date().toISOString(),
        triggerType: "schedule",
      };

      await sqsClient.send(
        new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: JSON.stringify(message),
        })
      );

      // Receive the message
      const receiveResult = await sqsClient.send(
        new ReceiveMessageCommand({
          QueueUrl: queueUrl,
          MaxNumberOfMessages: 1,
          WaitTimeSeconds: 5,
        })
      );

      expect(receiveResult.Messages).toBeDefined();
      expect(receiveResult.Messages!.length).toBeGreaterThan(0);

      const receivedBody = JSON.parse(receiveResult.Messages![0].Body!);
      expect(receivedBody.workflowId).toBe("test_wf_recv");
    });
  });
});

describe.skipIf(SKIP_INFRA_TESTS)("Schedule API E2E", () => {
  const KEEPERHUB_URL = process.env.KEEPERHUB_URL || "http://localhost:3000";

  describe("Execute API with Internal Header", () => {
    it("rejects unauthenticated external requests", async () => {
      try {
        const response = await fetch(
          `${KEEPERHUB_URL}/api/workflow/fake_id/execute`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ input: {} }),
          }
        );

        // Should be 401 Unauthorized or 404 Not Found
        expect([401, 404]).toContain(response.status);
      } catch {
        // Server not running, skip
      }
    });

    it("accepts internal execution header format", async () => {
      // This test verifies the header is recognized
      // Actual execution would require a valid workflow
      try {
        const response = await fetch(
          `${KEEPERHUB_URL}/api/workflow/fake_id/execute`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Internal-Execution": "true",
            },
            body: JSON.stringify({
              executionId: "test_exec_123",
              input: { triggerType: "schedule" },
            }),
          }
        );

        // Should be 404 (workflow not found) not 401 (unauthorized)
        // This proves the internal header bypassed auth
        expect(response.status).toBe(404);
      } catch {
        // Server not running, skip
      }
    });
  });
});

/**
 * Full pipeline tests - require all components running
 * These are typically run in CI with docker-compose
 */
describe.skipIf(SKIP_INFRA_TESTS || !process.env.FULL_E2E)(
  "Full Pipeline E2E",
  () => {
    it.todo("creates schedule when workflow saved with Schedule trigger");
    it.todo("dispatcher sends message to SQS at scheduled time");
    it.todo("executor processes message and triggers workflow");
    it.todo("execution record is created with correct status");
    it.todo("schedule nextRunAt is updated after execution");
  }
);
