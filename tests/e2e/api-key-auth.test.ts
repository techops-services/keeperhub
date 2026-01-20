import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Unmock db to use real database for integration tests
vi.unmock("@/lib/db");

import { db } from "@/lib/db";
import {
  organizationApiKeys,
  workflows as workflowsTable,
} from "@/lib/db/schema";

// Check if we can connect to the database
async function canConnectToDatabase(): Promise<boolean> {
  try {
    // Simple query to test connection
    await db.select().from(workflowsTable).limit(1);
    return true;
  } catch {
    return false;
  }
}

// Check if the server is running
async function isServerRunning(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Integration tests for API Key Authentication
 *
 * Tests the authenticateApiKey middleware across all API endpoints:
 * - GET /api/workflows (list workflows)
 * - POST /api/workflows/create (create workflow)
 * - GET /api/workflows/:id (get workflow)
 * - PATCH /api/workflows/:id (update workflow)
 * - DELETE /api/workflows/:id (delete workflow)
 * - POST /api/workflow/:id/execute (execute workflow)
 * - POST /api/ai/generate (AI workflow generation)
 */

describe("API Key Authentication", () => {
  let testApiKey: string;
  let testApiKeyId: string;
  let testOrgId: string;
  let testWorkflowId: string;
  let shouldSkip = false;
  const testUserId = "test-user-123";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  beforeAll(async () => {
    // Check prerequisites
    const dbAvailable = await canConnectToDatabase();
    const serverRunning = await isServerRunning(baseUrl);

    if (!(dbAvailable && serverRunning)) {
      console.log(
        `Skipping API Key Auth tests - DB: ${dbAvailable}, Server: ${serverRunning}`
      );
      shouldSkip = true;
      return;
    }

    // Create a test organization and API key
    testOrgId = `test-org-${Date.now()}`;
    testApiKey = `kh_test_${Date.now()}_${Math.random().toString(36)}`;
    const keyHash = createHash("sha256").update(testApiKey).digest("hex");

    const apiKeys = await db
      .insert(organizationApiKeys)
      .values({
        organizationId: testOrgId,
        name: "Test API Key",
        keyHash,
        keyPrefix: testApiKey.slice(0, 8),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      })
      .returning();

    testApiKeyId = apiKeys[0].id;

    // Create a test workflow for this organization
    const workflows = await db
      .insert(workflowsTable)
      .values({
        name: "Test Workflow",
        description: "Test workflow for API key auth",
        organizationId: testOrgId,
        userId: testUserId,
        isAnonymous: false,
        nodes: [
          {
            id: "trigger-1",
            type: "trigger",
            position: { x: 0, y: 0 },
            data: {
              label: "Manual Trigger",
              type: "trigger",
              config: { triggerType: "Manual" },
              status: "idle",
            },
          },
        ],
        edges: [],
      })
      .returning();

    testWorkflowId = workflows[0].id;
  });

  afterAll(async () => {
    if (shouldSkip) {
      return;
    }
    // Clean up test data
    if (testWorkflowId) {
      await db
        .delete(workflowsTable)
        .where(eq(workflowsTable.id, testWorkflowId));
    }
    if (testApiKeyId) {
      await db
        .delete(organizationApiKeys)
        .where(eq(organizationApiKeys.id, testApiKeyId));
    }
  });

  describe("GET /api/workflows", () => {
    it("should authenticate with valid API key", async () => {
      const response = await fetch(`${baseUrl}/api/workflows`, {
        headers: {
          Authorization: `Bearer ${testApiKey}`,
        },
      });

      expect(response.status).toBe(200);
      const workflows = await response.json();
      expect(Array.isArray(workflows)).toBe(true);
      expect(
        workflows.some((w: { id: string }) => w.id === testWorkflowId)
      ).toBe(true);
    });

    it("should reject invalid API key", async () => {
      const response = await fetch(`${baseUrl}/api/workflows`, {
        headers: {
          Authorization: "Bearer kh_invalid_key",
        },
      });

      // Should return empty array for invalid auth (current behavior)
      expect(response.status).toBe(200);
      const workflows = await response.json();
      expect(Array.isArray(workflows)).toBe(true);
      expect(workflows.length).toBe(0);
    });

    it("should reject malformed API key", async () => {
      const response = await fetch(`${baseUrl}/api/workflows`, {
        headers: {
          Authorization: "Bearer invalid_prefix_key",
        },
      });

      expect(response.status).toBe(200);
      const workflows = await response.json();
      expect(Array.isArray(workflows)).toBe(true);
    });
  });

  describe("POST /api/workflows/create", () => {
    it("should create workflow with valid API key", async () => {
      const response = await fetch(`${baseUrl}/api/workflows/create`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${testApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "API Created Workflow",
          description: "Created via API key",
          nodes: [
            {
              id: "trigger-1",
              type: "trigger",
              position: { x: 0, y: 0 },
              data: {
                label: "Manual Trigger",
                type: "trigger",
                config: { triggerType: "Manual" },
                status: "idle",
              },
            },
          ],
          edges: [],
        }),
      });

      expect(response.status).toBe(200);
      const workflow = await response.json();
      expect(workflow.name).toBe("API Created Workflow");
      expect(workflow.organizationId).toBe(testOrgId);

      // Clean up
      await db.delete(workflowsTable).where(eq(workflowsTable.id, workflow.id));
    });

    it("should reject invalid API key", async () => {
      const response = await fetch(`${baseUrl}/api/workflows/create`, {
        method: "POST",
        headers: {
          Authorization: "Bearer kh_invalid_key",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Should Fail",
          nodes: [],
          edges: [],
        }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/workflows/:id", () => {
    it("should get workflow with valid API key", async () => {
      const response = await fetch(
        `${baseUrl}/api/workflows/${testWorkflowId}`,
        {
          headers: {
            Authorization: `Bearer ${testApiKey}`,
          },
        }
      );

      expect(response.status).toBe(200);
      const workflow = await response.json();
      expect(workflow.id).toBe(testWorkflowId);
    });

    it("should reject access to workflow from different org", async () => {
      // Create another org's API key
      const otherApiKey = `kh_other_${Date.now()}`;
      const otherKeyHash = createHash("sha256")
        .update(otherApiKey)
        .digest("hex");
      const otherKeys = await db
        .insert(organizationApiKeys)
        .values({
          organizationId: "other-org-123",
          name: "Other Org Key",
          keyHash: otherKeyHash,
          keyPrefix: otherApiKey.slice(0, 8),
        })
        .returning();

      const response = await fetch(
        `${baseUrl}/api/workflows/${testWorkflowId}`,
        {
          headers: {
            Authorization: `Bearer ${otherApiKey}`,
          },
        }
      );

      expect(response.status).toBe(404);

      // Clean up
      await db
        .delete(organizationApiKeys)
        .where(eq(organizationApiKeys.id, otherKeys[0].id));
    });
  });

  describe("PATCH /api/workflows/:id", () => {
    it("should update workflow with valid API key", async () => {
      const response = await fetch(
        `${baseUrl}/api/workflows/${testWorkflowId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${testApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: "Updated via API Key",
          }),
        }
      );

      expect(response.status).toBe(200);
      const workflow = await response.json();
      expect(workflow.name).toBe("Updated via API Key");
    });
  });

  describe("POST /api/workflow/:id/execute", () => {
    it("should execute workflow with valid API key", async () => {
      const response = await fetch(
        `${baseUrl}/api/workflow/${testWorkflowId}/execute`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${testApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            input: { test: "data" },
          }),
        }
      );

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.executionId).toBeDefined();
      expect(result.status).toBe("running");
    });

    it("should reject execution from different org", async () => {
      const otherApiKey = `kh_other_exec_${Date.now()}`;
      const otherKeyHash = createHash("sha256")
        .update(otherApiKey)
        .digest("hex");
      const otherKeys = await db
        .insert(organizationApiKeys)
        .values({
          organizationId: "other-org-exec-123",
          name: "Other Org Execute Key",
          keyHash: otherKeyHash,
          keyPrefix: otherApiKey.slice(0, 8),
        })
        .returning();

      const response = await fetch(
        `${baseUrl}/api/workflow/${testWorkflowId}/execute`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${otherApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            input: { test: "data" },
          }),
        }
      );

      expect(response.status).toBe(403);

      // Clean up
      await db
        .delete(organizationApiKeys)
        .where(eq(organizationApiKeys.id, otherKeys[0].id));
    });
  });

  describe("POST /api/ai/generate", () => {
    it("should generate workflow with valid API key", async () => {
      const response = await fetch(`${baseUrl}/api/ai/generate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${testApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: "Create a simple workflow that sends an email",
        }),
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(
        "application/x-ndjson"
      );
    });

    it("should reject without authentication", async () => {
      const response = await fetch(`${baseUrl}/api/ai/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: "Create a workflow",
        }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe("Expired API Keys", () => {
    it("should reject expired API key", async () => {
      const expiredKey = `kh_expired_${Date.now()}`;
      const expiredKeyHash = createHash("sha256")
        .update(expiredKey)
        .digest("hex");
      const [key] = await db
        .insert(organizationApiKeys)
        .values({
          organizationId: testOrgId,
          name: "Expired Key",
          keyHash: expiredKeyHash,
          keyPrefix: expiredKey.slice(0, 8),
          expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        })
        .returning();

      const response = await fetch(`${baseUrl}/api/workflows`, {
        headers: {
          Authorization: `Bearer ${expiredKey}`,
        },
      });

      // Should return empty array (invalid auth)
      expect(response.status).toBe(200);
      const workflows = await response.json();
      expect(workflows.length).toBe(0);

      // Clean up
      await db
        .delete(organizationApiKeys)
        .where(eq(organizationApiKeys.id, key.id));
    });
  });

  describe("Revoked API Keys", () => {
    it("should reject revoked API key", async () => {
      const revokedKey = `kh_revoked_${Date.now()}`;
      const revokedKeyHash = createHash("sha256")
        .update(revokedKey)
        .digest("hex");
      const [key] = await db
        .insert(organizationApiKeys)
        .values({
          organizationId: testOrgId,
          name: "Revoked Key",
          keyHash: revokedKeyHash,
          keyPrefix: revokedKey.slice(0, 8),
          revokedAt: new Date(), // Revoked now
        })
        .returning();

      const response = await fetch(`${baseUrl}/api/workflows`, {
        headers: {
          Authorization: `Bearer ${revokedKey}`,
        },
      });

      // Should return empty array (invalid auth)
      expect(response.status).toBe(200);
      const workflows = await response.json();
      expect(workflows.length).toBe(0);

      // Clean up
      await db
        .delete(organizationApiKeys)
        .where(eq(organizationApiKeys.id, key.id));
    });
  });
});
