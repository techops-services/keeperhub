import { expect, test } from "@playwright/test";
import {
  createApiKey,
  createTestWorkflow,
  deleteApiKey,
  deleteTestWorkflow,
  getWorkflowWebhookUrl,
  PERSISTENT_TEST_USER_EMAIL,
  waitForWorkflowExecution,
} from "../utils";

// Run tests serially to maintain user session state
test.describe.configure({ mode: "serial" });

test.describe("Happy Path: Webhook Workflow", () => {
  // Track resources to clean up after tests
  const createdWorkflows: string[] = [];
  const createdApiKeys: string[] = [];

  test.afterAll(async () => {
    // Cleanup workflows
    for (const workflowId of createdWorkflows) {
      try {
        await deleteTestWorkflow(workflowId);
      } catch {
        // Ignore cleanup errors
      }
    }
    // Cleanup API keys
    for (const apiKey of createdApiKeys) {
      try {
        await deleteApiKey(apiKey);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  test("trigger webhook and verify execution completes successfully", async ({
    request,
    baseURL,
  }) => {
    // Step 1: Create API key for webhook authentication
    const apiKey = await createApiKey(PERSISTENT_TEST_USER_EMAIL);
    createdApiKeys.push(apiKey);

    // Step 2: Create workflow directly in database with connected nodes
    const workflow = await createTestWorkflow(PERSISTENT_TEST_USER_EMAIL, {
      name: "Webhook Execution Test",
      triggerType: "webhook",
      enabled: true,
    });
    createdWorkflows.push(workflow.id);

    // Step 3: Get webhook URL
    const webhookUrl = getWorkflowWebhookUrl(workflow.id, baseURL);

    // Verify URL format
    expect(webhookUrl).toContain("/api/workflows/");
    expect(webhookUrl).toContain("/webhook");

    // Step 4: Trigger webhook via API with API key
    const response = await request.post(webhookUrl, {
      data: { test: true, timestamp: Date.now() },
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    });

    // Log response for debugging
    if (!response.ok()) {
      const body = await response.text();
      console.log(`Webhook response: ${response.status()} - ${body}`);
    }
    expect(response.ok()).toBe(true);

    // Step 5: Wait for execution to complete via database polling
    const execution = await waitForWorkflowExecution(workflow.id, 60_000);
    expect(execution).not.toBeNull();
    if (execution?.status === "error") {
      console.log(`Workflow execution error: ${execution.error}`);
    }
    expect(execution?.status).toBe("success");
  });

  test("webhook URL is unique per workflow", async ({ baseURL }) => {
    // Create first workflow
    const workflow1 = await createTestWorkflow(PERSISTENT_TEST_USER_EMAIL, {
      name: "Webhook Workflow 1",
      triggerType: "webhook",
    });
    createdWorkflows.push(workflow1.id);

    // Create second workflow
    const workflow2 = await createTestWorkflow(PERSISTENT_TEST_USER_EMAIL, {
      name: "Webhook Workflow 2",
      triggerType: "webhook",
    });
    createdWorkflows.push(workflow2.id);

    // Get webhook URLs
    const webhookUrl1 = getWorkflowWebhookUrl(workflow1.id, baseURL);
    const webhookUrl2 = getWorkflowWebhookUrl(workflow2.id, baseURL);

    // Verify URLs are different
    expect(webhookUrl1).not.toBe(webhookUrl2);

    // Verify both contain the correct workflow IDs
    expect(webhookUrl1).toContain(workflow1.id);
    expect(webhookUrl2).toContain(workflow2.id);
  });

  test("webhook can be triggered multiple times", async ({
    page,
    request,
    baseURL,
  }) => {
    // Create API key
    const apiKey = await createApiKey(PERSISTENT_TEST_USER_EMAIL);
    createdApiKeys.push(apiKey);

    // Create workflow
    const workflow = await createTestWorkflow(PERSISTENT_TEST_USER_EMAIL, {
      name: "Multi-trigger Test",
      triggerType: "webhook",
      enabled: true,
    });
    createdWorkflows.push(workflow.id);

    const webhookUrl = getWorkflowWebhookUrl(workflow.id, baseURL);

    // Trigger webhook 3 times
    for (let i = 0; i < 3; i++) {
      const response = await request.post(webhookUrl, {
        data: { run: i + 1 },
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      });
      expect(response.ok()).toBe(true);

      // Wait a bit between triggers
      await page.waitForTimeout(500);
    }

    // All triggers should succeed - check the last execution
    const execution = await waitForWorkflowExecution(workflow.id, 60_000);
    expect(execution).not.toBeNull();
    expect(execution?.status).toBe("success");
  });
});
