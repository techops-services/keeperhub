import { expect, test } from "@playwright/test";
import {
  addActionNode,
  configureWebhookTrigger,
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

    // Step 3: Configure trigger as webhook type
    await configureWebhookTrigger(page);

    // Step 4: Add Send Webhook action
    await addActionNode(page, "Send Webhook");

    // Step 5: Verify action node exists
    const actionNode = page.locator(".react-flow__node-action");
    await expect(actionNode).toBeVisible({ timeout: 5000 });

    // Step 6: Save the workflow
    await saveWorkflow(page);

    // Step 7: Get webhook URL from trigger
    const webhookUrl = await getWebhookUrl(page);
    expect(webhookUrl).toMatch(URL_REGEX);
    expect(webhookUrl).toContain(workflowId);
  });

  test("trigger webhook and verify execution", async ({ page, request }) => {
    // Sign up and verify
    await signUpAndVerify(page);

    // Create workflow
    const workflowId = await createWorkflow(page, "Webhook Trigger Test");

    // Configure trigger as webhook type
    await configureWebhookTrigger(page);

    // Add action
    await addActionNode(page, "Send Webhook");

    // Save workflow
    await saveWorkflow(page);

    // Get webhook URL from trigger
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

    // Create first workflow with webhook trigger
    await createWorkflow(page, "Webhook Workflow 1");
    await configureWebhookTrigger(page);
    await addActionNode(page, "Send Webhook");
    await saveWorkflow(page);
    const webhookUrl1 = await getWebhookUrl(page);

    // Create second workflow with webhook trigger
    await createWorkflow(page, "Webhook Workflow 2");
    await configureWebhookTrigger(page);
    await addActionNode(page, "Send Webhook");
    await saveWorkflow(page);
    const webhookUrl2 = await getWebhookUrl(page);

    // Verify URLs are different
    expect(webhookUrl1).not.toBe(webhookUrl2);
  });

  test("webhook URL persists after page reload", async ({ page }) => {
    // Sign up and verify
    await signUpAndVerify(page);

    // Create workflow with webhook trigger
    await createWorkflow(page, "Webhook Persistence Test");
    await configureWebhookTrigger(page);

    // Add action and save
    await addActionNode(page, "Send Webhook");
    await saveWorkflow(page);

    // Get webhook URL from trigger
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
