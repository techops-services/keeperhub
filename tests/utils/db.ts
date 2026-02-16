/**
 * Shared database utilities for E2E testing
 *
 * These utilities can be used by both:
 * - Vitest E2E tests (tests/e2e/*.test.ts)
 * - Playwright tests (tests/e2e/playwright/*.test.ts)
 *
 * They provide database operations for test setup/teardown:
 * - Creating test workflows with properly connected nodes
 * - Creating API keys for webhook authentication
 * - Waiting for workflow executions to complete
 * - Cleanup functions
 */

import { createHash, randomBytes } from "node:crypto";
import postgres from "postgres";
import {
  createScheduledWorkflow,
  createWebhookWorkflow,
} from "../fixtures/workflows";

// ============================================================================
// Persistent test account constants (seeded by scripts/seed/seed-test-wallet.ts)
// ============================================================================

export const PERSISTENT_TEST_USER_EMAIL = "e2e-test@keeperhub.test";
export const PERSISTENT_TEST_ORG_SLUG = "e2e-test-org";

/**
 * Look up the persistent test user seeded by `pnpm db:seed-test-wallet`.
 * Throws if the user does not exist.
 */
export async function getPersistentTestUserId(): Promise<string> {
  const sql = getDbConnection();
  try {
    const result = await sql`
      SELECT id FROM users WHERE email = ${PERSISTENT_TEST_USER_EMAIL}
    `;
    if (result.length === 0) {
      throw new Error(
        `Persistent test user "${PERSISTENT_TEST_USER_EMAIL}" not found. Run pnpm db:seed-test-wallet first.`
      );
    }
    return result[0].id as string;
  } finally {
    await sql.end();
  }
}

// ============================================================================
// Types
// ============================================================================

export type WorkflowTriggerType = "webhook" | "schedule" | "manual";

export type CreateTestWorkflowOptions = {
  name?: string;
  description?: string;
  enabled?: boolean;
  triggerType?: WorkflowTriggerType;
  cronExpression?: string;
  timezone?: string;
};

export type TestWorkflow = {
  id: string;
  name: string;
  userId: string;
  organizationId: string | null;
};

export type ExecutionResult = {
  status: "success" | "error" | "pending" | "running" | "cancelled";
  executionId: string;
  error?: string;
};

// ============================================================================
// Internal helpers
// ============================================================================

function generateId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getDbConnection(): ReturnType<typeof postgres> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }
  return postgres(databaseUrl, { max: 1 });
}

// ============================================================================
// User queries
// ============================================================================

/**
 * Get user ID from email
 */
export async function getUserIdByEmail(email: string): Promise<string | null> {
  const sql = getDbConnection();
  try {
    const result = await sql`
      SELECT id FROM users WHERE email = ${email}
    `;
    return result.length > 0 ? (result[0].id as string) : null;
  } finally {
    await sql.end();
  }
}

/**
 * Get user's organization ID
 */
export async function getUserOrganizationId(
  userId: string
): Promise<string | null> {
  const sql = getDbConnection();
  try {
    const result = await sql`
      SELECT organization_id FROM member WHERE user_id = ${userId} LIMIT 1
    `;
    return result.length > 0 ? (result[0].organization_id as string) : null;
  } finally {
    await sql.end();
  }
}

// ============================================================================
// Workflow operations
// ============================================================================

/**
 * Create a test workflow directly in the database with properly connected nodes
 */
export async function createTestWorkflow(
  userEmail: string,
  options: CreateTestWorkflowOptions = {}
): Promise<TestWorkflow> {
  const sql = getDbConnection();

  try {
    // Get user ID
    const userResult = await sql`
      SELECT id FROM users WHERE email = ${userEmail}
    `;
    if (userResult.length === 0) {
      throw new Error(`User not found with email: ${userEmail}`);
    }
    const userId = userResult[0].id as string;

    // Get organization ID
    const orgResult = await sql`
      SELECT organization_id FROM member WHERE user_id = ${userId} LIMIT 1
    `;
    const organizationId =
      orgResult.length > 0 ? (orgResult[0].organization_id as string) : null;

    const {
      name = `Test Workflow ${Date.now()}`,
      description = "Test workflow created via database injection",
      enabled = true,
      triggerType = "webhook",
      cronExpression = "0 9 * * *",
      timezone = "UTC",
    } = options;

    // Get workflow structure based on trigger type
    const workflow =
      triggerType === "schedule"
        ? createScheduledWorkflow(cronExpression, timezone)
        : createWebhookWorkflow();

    const workflowId = generateId();
    const now = new Date();
    const isAnonymous = !organizationId;

    // Insert workflow with JSONB casting for nodes and edges
    const nodesStr = JSON.stringify(workflow.nodes);
    const edgesStr = JSON.stringify(workflow.edges);

    await sql.unsafe(
      `INSERT INTO workflows (
        id, name, description, user_id, organization_id, is_anonymous,
        nodes, edges, visibility, enabled, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, 'private', $9, $10, $11
      )`,
      [
        workflowId,
        name,
        description,
        userId,
        organizationId,
        isAnonymous,
        nodesStr,
        edgesStr,
        enabled,
        now,
        now,
      ]
    );

    // If schedule trigger, also create the schedule record
    if (triggerType === "schedule") {
      const scheduleId = generateId();
      await sql`
        INSERT INTO workflow_schedules (
          id, workflow_id, cron_expression, timezone, enabled, created_at, updated_at
        ) VALUES (
          ${scheduleId},
          ${workflowId},
          ${cronExpression},
          ${timezone},
          ${enabled},
          ${now},
          ${now}
        )
      `;
    }

    return {
      id: workflowId,
      name,
      userId,
      organizationId,
    };
  } finally {
    await sql.end();
  }
}

/**
 * Delete a test workflow from the database
 */
export async function deleteTestWorkflow(workflowId: string): Promise<void> {
  const sql = getDbConnection();
  try {
    // Delete execution logs first (foreign key constraint)
    await sql`
      DELETE FROM workflow_execution_logs
      WHERE execution_id IN (
        SELECT id FROM workflow_executions WHERE workflow_id = ${workflowId}
      )
    `;

    // Delete executions
    await sql`
      DELETE FROM workflow_executions WHERE workflow_id = ${workflowId}
    `;

    // Delete schedule if exists
    await sql`
      DELETE FROM workflow_schedules WHERE workflow_id = ${workflowId}
    `;

    // Delete workflow
    await sql`
      DELETE FROM workflows WHERE id = ${workflowId}
    `;
  } finally {
    await sql.end();
  }
}

/**
 * Get the webhook URL for a workflow
 */
export function getWorkflowWebhookUrl(
  workflowId: string,
  baseUrl = "http://localhost:3000"
): string {
  return `${baseUrl}/api/workflows/${workflowId}/webhook`;
}

/**
 * Wait for workflow execution to complete
 */
export async function waitForWorkflowExecution(
  workflowId: string,
  timeoutMs = 60_000
): Promise<ExecutionResult | null> {
  const startTime = Date.now();
  const pollInterval = 1000;

  while (Date.now() - startTime < timeoutMs) {
    const sql = getDbConnection();
    try {
      const result = await sql`
        SELECT id, status, error FROM workflow_executions
        WHERE workflow_id = ${workflowId}
        ORDER BY started_at DESC
        LIMIT 1
      `;

      if (result.length > 0) {
        const execution = result[0];
        const status = execution.status as string;

        if (status === "success" || status === "error") {
          return {
            status: status as "success" | "error",
            executionId: execution.id as string,
            error: execution.error as string | undefined,
          };
        }
      }
    } finally {
      await sql.end();
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  return null;
}

// ============================================================================
// API Key operations
// ============================================================================

/**
 * Create an API key for a user (required for webhook authentication)
 */
export async function createApiKey(userEmail: string): Promise<string> {
  const sql = getDbConnection();

  try {
    // Get user ID
    const userResult = await sql`
      SELECT id FROM users WHERE email = ${userEmail}
    `;
    if (userResult.length === 0) {
      throw new Error(`User not found with email: ${userEmail}`);
    }
    const userId = userResult[0].id as string;

    // Generate API key
    const keyId = generateId();
    const rawKey = `wfb_${randomBytes(16).toString("hex")}`;
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const keyPrefix = rawKey.slice(0, 12);
    const now = new Date();

    // Insert API key
    await sql`
      INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix, created_at)
      VALUES (${keyId}, ${userId}, 'Test API Key', ${keyHash}, ${keyPrefix}, ${now})
    `;

    return rawKey;
  } finally {
    await sql.end();
  }
}

/**
 * Delete an API key
 */
export async function deleteApiKey(apiKey: string): Promise<void> {
  const sql = getDbConnection();
  try {
    const keyHash = createHash("sha256").update(apiKey).digest("hex");
    await sql`DELETE FROM api_keys WHERE key_hash = ${keyHash}`;
  } finally {
    await sql.end();
  }
}
