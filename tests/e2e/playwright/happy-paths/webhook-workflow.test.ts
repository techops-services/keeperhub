import { expect, test } from "@playwright/test";
import {
  addActionNode,
  createWorkflow,
  getWebhookUrl,
  saveWorkflow,
  signUpAndVerify,
  waitForCanvas,
} from "../utils";

// Top-level regex for URL validation
const URL_REGEX = /^https?:\/\//;

// Run tests serially to maintain user session state
test.describe.configure({ mode: "serial" });

test.describe("Happy Path: Webhook Workflow", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("create webhook workflow and get webhook URL", async ({ page }) => {
    // Step 1: Sign up and verify
    await signUpAndVerify(page);

    // Step 2: Create a new workflow
    const workflowId = await createWorkflow(page, "Webhook Test Workflow");
    expect(workflowId).toBeTruthy();

    // Step 3: Add HTTP Request action
    await addActionNode(page, "http-request");

    // Step 4: Verify action node exists
    const actionNode = page.locator(".react-flow__node-action");
    await expect(actionNode).toBeVisible({ timeout: 5000 });

    // Step 5: Save the workflow
    await saveWorkflow(page);

    // Step 6: Get webhook URL
    const webhookUrl = await getWebhookUrl(page);
    expect(webhookUrl).toMatch(URL_REGEX);
    expect(webhookUrl).toContain(workflowId);
  });

  test("trigger webhook and verify execution", async ({ page, request }) => {
    // Sign up and verify
    await signUpAndVerify(page);

    // Create workflow
    const workflowId = await createWorkflow(page, "Webhook Trigger Test");

    // Add action
    await addActionNode(page, "http-request");

    // Save workflow
    await saveWorkflow(page);

    // Get webhook URL
    const webhookUrl = await getWebhookUrl(page);

    // Trigger webhook via API
    const response = await request.post(webhookUrl, {
      data: { test: true },
      headers: { "Content-Type": "application/json" },
    });

    expect(response.status()).toBeLessThan(500);

    // Navigate to execution history
    await page.goto(`/workflow/${workflowId}/history`, {
      waitUntil: "domcontentloaded",
    });

    // Wait for execution to appear
    const executionRow = page.locator('[data-testid="execution-row"]').first();
    await expect(executionRow).toBeVisible({ timeout: 30_000 });
  });

  test("webhook URL is unique per workflow", async ({ page }) => {
    // Sign up and verify
    await signUpAndVerify(page);

    // Create first workflow
    await createWorkflow(page, "Webhook Workflow 1");
    await addActionNode(page, "http-request");
    await saveWorkflow(page);
    const webhookUrl1 = await getWebhookUrl(page);

    // Create second workflow
    await createWorkflow(page, "Webhook Workflow 2");
    await addActionNode(page, "http-request");
    await saveWorkflow(page);
    const webhookUrl2 = await getWebhookUrl(page);

    // Verify URLs are different
    expect(webhookUrl1).not.toBe(webhookUrl2);
  });

  test("webhook URL persists after page reload", async ({ page }) => {
    // Sign up and verify
    await signUpAndVerify(page);

    // Create workflow
    await createWorkflow(page, "Webhook Persistence Test");

    // Add action and save
    await addActionNode(page, "http-request");
    await saveWorkflow(page);

    // Get webhook URL
    const webhookUrlBefore = await getWebhookUrl(page);

    // Reload page
    await page.reload();
    await waitForCanvas(page);

    // Get webhook URL again
    const webhookUrlAfter = await getWebhookUrl(page);

    // Verify URL is the same
    expect(webhookUrlAfter).toBe(webhookUrlBefore);
  });
});
