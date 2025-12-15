/**
 * E2E Tests for Workflow Runner (K8s Job Runtime)
 *
 * These tests verify that the workflow-runner.ts script can execute workflows
 * in an isolated environment, simulating the K8s Job container runtime.
 *
 * Tests cover:
 * - Workflow runner can connect to database
 * - Workflow runner can fetch and execute workflows
 * - Workflow runner properly updates execution status
 * - Workflow runner handles errors gracefully
 *
 * Run with: pnpm test -- --run tests/e2e/workflow-runner.test.ts
 *
 * Prerequisites:
 * - PostgreSQL database running
 * - DATABASE_URL environment variable set
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { spawn } from "node:child_process";
import { join } from "node:path";
import {
  users,
  workflows,
  workflowExecutions,
  workflowSchedules,
} from "../../lib/db/schema";
import { generateId } from "../../lib/utils/id";

// Skip these tests if infrastructure isn't available
const SKIP_INFRA_TESTS = process.env.SKIP_INFRA_TESTS === "true";
const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5433/keeperhub";

// Test data IDs (use consistent IDs for cleanup)
const TEST_USER_ID = "test_user_runner_e2e";
const TEST_WORKFLOW_PREFIX = "test_wf_runner_";
const TEST_EXECUTION_PREFIX = "test_exec_runner_";

describe.skipIf(SKIP_INFRA_TESTS)("Workflow Runner E2E", () => {
  let queryClient: ReturnType<typeof postgres>;
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    // Connect to database
    queryClient = postgres(DATABASE_URL);
    db = drizzle(queryClient, {
      schema: { users, workflows, workflowExecutions, workflowSchedules },
    });

    // Create test user if not exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.id, TEST_USER_ID))
      .limit(1);

    if (existingUser.length === 0) {
      await db.insert(users).values({
        id: TEST_USER_ID,
        name: "Test Runner User",
        email: `test-runner-${Date.now()}@example.com`,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  });

  // Clean up before each test to handle leftover data from previous runs
  beforeEach(async () => {
    try {
      // Delete in FK order
      await queryClient`DELETE FROM workflow_execution_logs WHERE execution_id LIKE ${TEST_EXECUTION_PREFIX + "%"}`;
      await queryClient`DELETE FROM workflow_executions WHERE id LIKE ${TEST_EXECUTION_PREFIX + "%"}`;
      await queryClient`DELETE FROM workflow_schedules WHERE workflow_id LIKE ${TEST_WORKFLOW_PREFIX + "%"}`;
      await queryClient`DELETE FROM workflows WHERE id LIKE ${TEST_WORKFLOW_PREFIX + "%"}`;
    } catch {
      // Ignore cleanup errors
    }
  });

  afterAll(async () => {
    // Final cleanup
    try {
      await queryClient`DELETE FROM workflow_execution_logs WHERE execution_id LIKE ${TEST_EXECUTION_PREFIX + "%"}`;
      await queryClient`DELETE FROM workflow_executions WHERE id LIKE ${TEST_EXECUTION_PREFIX + "%"}`;
      await queryClient`DELETE FROM workflow_schedules WHERE workflow_id LIKE ${TEST_WORKFLOW_PREFIX + "%"}`;
      await queryClient`DELETE FROM workflows WHERE id LIKE ${TEST_WORKFLOW_PREFIX + "%"}`;
    } catch (error) {
      console.warn("Cleanup warning:", error);
    }

    await queryClient.end();
  });

  /**
   * Helper to run the workflow-runner script
   * Uses the bootstrap script which patches 'server-only' for non-Next.js environments
   */
  async function runWorkflowRunner(
    workflowId: string,
    executionId: string,
    options: {
      scheduleId?: string;
      input?: Record<string, unknown>;
      timeout?: number;
    } = {}
  ): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const env = {
        ...process.env,
        WORKFLOW_ID: workflowId,
        EXECUTION_ID: executionId,
        DATABASE_URL: DATABASE_URL,
        WORKFLOW_INPUT: JSON.stringify(options.input || {}),
        ...(options.scheduleId && { SCHEDULE_ID: options.scheduleId }),
      };

      // Use the bootstrap script which handles 'server-only' patching
      const scriptPath = join(__dirname, "../../scripts/workflow-runner-bootstrap.cjs");
      const child = spawn("node", [scriptPath], {
        env,
        cwd: join(__dirname, "../.."),
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      const timeout = options.timeout || 30000;
      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        resolve({ exitCode: null, stdout, stderr: stderr + "\nTimeout" });
      }, timeout);

      child.on("close", (code) => {
        clearTimeout(timer);
        resolve({ exitCode: code, stdout, stderr });
      });
    });
  }

  /**
   * Helper to create a simple test workflow
   */
  async function createTestWorkflow(
    id: string,
    nodes: unknown[],
    edges: unknown[] = []
  ): Promise<string> {
    await db.insert(workflows).values({
      id,
      name: `Test Workflow ${id}`,
      userId: TEST_USER_ID,
      nodes,
      edges,
      visibility: "private",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return id;
  }

  /**
   * Helper to create an execution record
   */
  async function createTestExecution(
    id: string,
    workflowId: string,
    status: "pending" | "running" | "success" | "error" = "pending"
  ): Promise<string> {
    await db.insert(workflowExecutions).values({
      id,
      workflowId,
      userId: TEST_USER_ID,
      status,
      input: { triggerType: "test" },
      startedAt: new Date(),
    });
    return id;
  }

  /**
   * Helper to get execution status
   */
  async function getExecutionStatus(
    executionId: string
  ): Promise<{ status: string; error?: string | null } | null> {
    const result = await db
      .select({ status: workflowExecutions.status, error: workflowExecutions.error })
      .from(workflowExecutions)
      .where(eq(workflowExecutions.id, executionId))
      .limit(1);
    return result[0] || null;
  }

  describe("Environment Validation", () => {
    it("fails without WORKFLOW_ID", async () => {
      const result = await runWorkflowRunner("", "test_exec", { timeout: 10000 });
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("WORKFLOW_ID");
    });

    it("fails without EXECUTION_ID", async () => {
      const env = {
        ...process.env,
        WORKFLOW_ID: "test_wf",
        DATABASE_URL: DATABASE_URL,
      };

      // Use the bootstrap script which handles 'server-only' patching
      const scriptPath = join(__dirname, "../../scripts/workflow-runner-bootstrap.cjs");
      const result = await new Promise<{ exitCode: number | null; stderr: string }>((resolve) => {
        const child = spawn("node", [scriptPath], {
          env,
          cwd: join(__dirname, "../.."),
        });

        let stderr = "";
        child.stderr.on("data", (data) => {
          stderr += data.toString();
        });

        const timer = setTimeout(() => {
          child.kill();
          resolve({ exitCode: null, stderr });
        }, 10000);

        child.on("close", (code) => {
          clearTimeout(timer);
          resolve({ exitCode: code, stderr });
        });
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("EXECUTION_ID");
    });
  });

  describe("Workflow Execution", () => {
    // These tests spawn child processes to run workflows, need longer timeout
    const WORKFLOW_TEST_TIMEOUT = 60000;

    it("executes a simple trigger-only workflow", async () => {
      const workflowId = `${TEST_WORKFLOW_PREFIX}simple_trigger`;
      const executionId = `${TEST_EXECUTION_PREFIX}simple_trigger`;

      // Create a workflow with just a trigger node
      const triggerNode = {
        id: "trigger_1",
        type: "custom",
        position: { x: 0, y: 0 },
        data: {
          type: "trigger",
          label: "Manual Trigger",
          config: {
            triggerType: "Manual",
          },
        },
      };

      await createTestWorkflow(workflowId, [triggerNode]);
      await createTestExecution(executionId, workflowId);

      // Run the workflow runner
      const result = await runWorkflowRunner(workflowId, executionId, {
        input: { test: true },
      });

      // Check execution completed
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("[Runner] Starting workflow execution");
      expect(result.stdout).toContain("[Runner] Execution completed successfully");

      // Verify database status was updated
      const status = await getExecutionStatus(executionId);
      expect(status?.status).toBe("success");
    }, WORKFLOW_TEST_TIMEOUT);

    it("executes a workflow with HTTP Request action", async () => {
      const workflowId = `${TEST_WORKFLOW_PREFIX}http_request`;
      const executionId = `${TEST_EXECUTION_PREFIX}http_request`;

      // Create a workflow with trigger -> HTTP Request
      const triggerNode = {
        id: "trigger_1",
        type: "custom",
        position: { x: 0, y: 0 },
        data: {
          type: "trigger",
          label: "Manual Trigger",
          config: { triggerType: "Manual" },
        },
      };

      const httpNode = {
        id: "http_1",
        type: "custom",
        position: { x: 0, y: 100 },
        data: {
          type: "action",
          label: "HTTP Request",
          config: {
            actionType: "HTTP Request",
            endpoint: "https://httpbin.org/get",
            httpMethod: "GET",
          },
        },
      };

      const edges = [
        { id: "e1", source: "trigger_1", target: "http_1" },
      ];

      await createTestWorkflow(workflowId, [triggerNode, httpNode], edges);
      await createTestExecution(executionId, workflowId);

      // Run the workflow runner
      const result = await runWorkflowRunner(workflowId, executionId, {
        timeout: 60000, // HTTP requests can be slow
      });

      // Check execution completed
      expect(result.exitCode).toBe(0);

      // Verify database status was updated
      const status = await getExecutionStatus(executionId);
      expect(status?.status).toBe("success");
    }, WORKFLOW_TEST_TIMEOUT);

    it("handles workflow not found error", async () => {
      const workflowId = `${TEST_WORKFLOW_PREFIX}nonexistent`;
      const executionId = `${TEST_EXECUTION_PREFIX}nonexistent`;

      // Create only the execution record, not the workflow
      await createTestExecution(executionId, workflowId).catch(() => {
        // This might fail due to FK constraint, which is expected
      });

      // For this test, we'll just verify the runner handles missing workflow
      const result = await runWorkflowRunner(workflowId, executionId);

      // Should fail gracefully
      expect(result.exitCode).toBe(1);
      expect(result.stderr + result.stdout).toContain("not found");
    });

    it("executes a workflow with condition node", async () => {
      const workflowId = `${TEST_WORKFLOW_PREFIX}condition`;
      const executionId = `${TEST_EXECUTION_PREFIX}condition`;

      const triggerNode = {
        id: "trigger_1",
        type: "custom",
        position: { x: 0, y: 0 },
        data: {
          type: "trigger",
          label: "Manual Trigger",
          config: { triggerType: "Manual" },
        },
      };

      const conditionNode = {
        id: "condition_1",
        type: "custom",
        position: { x: 0, y: 100 },
        data: {
          type: "action",
          label: "Condition",
          config: {
            actionType: "Condition",
            condition: true, // Simple true condition
          },
        },
      };

      const edges = [
        { id: "e1", source: "trigger_1", target: "condition_1" },
      ];

      await createTestWorkflow(workflowId, [triggerNode, conditionNode], edges);
      await createTestExecution(executionId, workflowId);

      const result = await runWorkflowRunner(workflowId, executionId);

      expect(result.exitCode).toBe(0);

      const status = await getExecutionStatus(executionId);
      expect(status?.status).toBe("success");
    }, WORKFLOW_TEST_TIMEOUT);

    it("handles disabled nodes correctly", async () => {
      const workflowId = `${TEST_WORKFLOW_PREFIX}disabled_node`;
      const executionId = `${TEST_EXECUTION_PREFIX}disabled_node`;

      const triggerNode = {
        id: "trigger_1",
        type: "custom",
        position: { x: 0, y: 0 },
        data: {
          type: "trigger",
          label: "Manual Trigger",
          config: { triggerType: "Manual" },
        },
      };

      // This node is disabled and should be skipped
      const disabledNode = {
        id: "disabled_1",
        type: "custom",
        position: { x: 0, y: 100 },
        data: {
          type: "action",
          label: "Disabled Action",
          enabled: false, // Disabled
          config: {
            actionType: "HTTP Request",
            endpoint: "https://should-not-be-called.example.com",
            httpMethod: "GET",
          },
        },
      };

      const edges = [
        { id: "e1", source: "trigger_1", target: "disabled_1" },
      ];

      await createTestWorkflow(workflowId, [triggerNode, disabledNode], edges);
      await createTestExecution(executionId, workflowId);

      const result = await runWorkflowRunner(workflowId, executionId);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Skipping disabled node");

      const status = await getExecutionStatus(executionId);
      expect(status?.status).toBe("success");
    }, WORKFLOW_TEST_TIMEOUT);
  });

  describe("Schedule Integration", () => {
    const WORKFLOW_TEST_TIMEOUT = 60000;
    it("updates schedule status after successful execution", async () => {
      const workflowId = `${TEST_WORKFLOW_PREFIX}schedule_success`;
      const executionId = `${TEST_EXECUTION_PREFIX}schedule_success`;
      const scheduleId = `${TEST_WORKFLOW_PREFIX}sched_success`;

      // Create workflow
      const triggerNode = {
        id: "trigger_1",
        type: "custom",
        position: { x: 0, y: 0 },
        data: {
          type: "trigger",
          label: "Schedule Trigger",
          config: { triggerType: "Schedule" },
        },
      };

      await createTestWorkflow(workflowId, [triggerNode]);

      // Create schedule
      await db.insert(workflowSchedules).values({
        id: scheduleId,
        workflowId,
        cronExpression: "0 * * * *",
        timezone: "UTC",
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create execution
      await createTestExecution(executionId, workflowId);

      // Run with schedule ID
      const result = await runWorkflowRunner(workflowId, executionId, {
        scheduleId,
        input: { triggerType: "schedule" },
      });

      expect(result.exitCode).toBe(0);

      // Verify schedule was updated
      const schedule = await db
        .select()
        .from(workflowSchedules)
        .where(eq(workflowSchedules.id, scheduleId))
        .limit(1);

      expect(schedule[0]?.lastStatus).toBe("success");
      expect(schedule[0]?.lastRunAt).toBeDefined();
    }, WORKFLOW_TEST_TIMEOUT);

    it("updates schedule status after failed execution", async () => {
      const workflowId = `${TEST_WORKFLOW_PREFIX}schedule_error`;
      const executionId = `${TEST_EXECUTION_PREFIX}schedule_error`;
      const scheduleId = `${TEST_WORKFLOW_PREFIX}sched_error`;

      // Create workflow with a node that will fail
      const triggerNode = {
        id: "trigger_1",
        type: "custom",
        position: { x: 0, y: 0 },
        data: {
          type: "trigger",
          label: "Schedule Trigger",
          config: { triggerType: "Schedule" },
        },
      };

      // Action with invalid/missing action type
      const badNode = {
        id: "bad_1",
        type: "custom",
        position: { x: 0, y: 100 },
        data: {
          type: "action",
          label: "Bad Action",
          config: {
            actionType: "NonExistentAction",
          },
        },
      };

      const edges = [{ id: "e1", source: "trigger_1", target: "bad_1" }];

      await createTestWorkflow(workflowId, [triggerNode, badNode], edges);

      // Create schedule
      await db.insert(workflowSchedules).values({
        id: scheduleId,
        workflowId,
        cronExpression: "0 * * * *",
        timezone: "UTC",
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create execution
      await createTestExecution(executionId, workflowId);

      // Run with schedule ID
      const result = await runWorkflowRunner(workflowId, executionId, {
        scheduleId,
      });

      // Execution should have errors
      expect(result.exitCode).toBe(1);

      // Verify schedule was updated with error
      const schedule = await db
        .select()
        .from(workflowSchedules)
        .where(eq(workflowSchedules.id, scheduleId))
        .limit(1);

      expect(schedule[0]?.lastStatus).toBe("error");
      expect(schedule[0]?.lastError).toBeDefined();
    }, WORKFLOW_TEST_TIMEOUT);
  });

  describe("Error Handling", () => {
    const WORKFLOW_TEST_TIMEOUT = 60000;
    it("handles action step errors gracefully", async () => {
      const workflowId = `${TEST_WORKFLOW_PREFIX}step_error`;
      const executionId = `${TEST_EXECUTION_PREFIX}step_error`;

      const triggerNode = {
        id: "trigger_1",
        type: "custom",
        position: { x: 0, y: 0 },
        data: {
          type: "trigger",
          label: "Manual Trigger",
          config: { triggerType: "Manual" },
        },
      };

      // HTTP request to a URL that will fail
      const failingNode = {
        id: "fail_1",
        type: "custom",
        position: { x: 0, y: 100 },
        data: {
          type: "action",
          label: "Failing HTTP",
          config: {
            actionType: "HTTP Request",
            endpoint: "https://this-domain-definitely-does-not-exist-12345.com",
            httpMethod: "GET",
          },
        },
      };

      const edges = [{ id: "e1", source: "trigger_1", target: "fail_1" }];

      await createTestWorkflow(workflowId, [triggerNode, failingNode], edges);
      await createTestExecution(executionId, workflowId);

      const result = await runWorkflowRunner(workflowId, executionId, {
        timeout: 30000,
      });

      // Should fail but exit gracefully
      expect(result.exitCode).toBe(1);

      // Verify execution status shows error
      const status = await getExecutionStatus(executionId);
      expect(status?.status).toBe("error");
      expect(status?.error).toBeDefined();
    }, WORKFLOW_TEST_TIMEOUT);

    it("records error details in execution record", async () => {
      const workflowId = `${TEST_WORKFLOW_PREFIX}error_details`;
      const executionId = `${TEST_EXECUTION_PREFIX}error_details`;

      const triggerNode = {
        id: "trigger_1",
        type: "custom",
        position: { x: 0, y: 0 },
        data: {
          type: "trigger",
          label: "Manual Trigger",
          config: { triggerType: "Manual" },
        },
      };

      // Node with missing action type
      const incompleteNode = {
        id: "incomplete_1",
        type: "custom",
        position: { x: 0, y: 100 },
        data: {
          type: "action",
          label: "Incomplete Action",
          config: {}, // No actionType
        },
      };

      const edges = [{ id: "e1", source: "trigger_1", target: "incomplete_1" }];

      await createTestWorkflow(workflowId, [triggerNode, incompleteNode], edges);
      await createTestExecution(executionId, workflowId);

      const result = await runWorkflowRunner(workflowId, executionId);

      expect(result.exitCode).toBe(1);

      const status = await getExecutionStatus(executionId);
      expect(status?.status).toBe("error");
      expect(status?.error).toContain("no action type");
    }, WORKFLOW_TEST_TIMEOUT);
  });
});

/**
 * Docker-based test that simulates running in a K8s Job container
 * Requires Docker to be available
 */
describe.skipIf(SKIP_INFRA_TESTS || !process.env.DOCKER_TESTS)(
  "Workflow Runner Docker E2E",
  () => {
    it.todo("runs workflow-runner in keeperhub-runner Docker image");
    it.todo("connects to host database from container");
    it.todo("handles missing environment variables in container");
  }
);
