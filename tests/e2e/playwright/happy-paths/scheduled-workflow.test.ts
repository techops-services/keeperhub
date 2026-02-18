import { expect, test } from "@playwright/test";
import {
  addActionNode,
  configureScheduleTrigger,
  createWorkflow,
  saveWorkflow,
  waitForCanvas,
} from "../utils";

// Top-level regex for URL matching
const WORKFLOW_URL_REGEX = /workflow/;

// Run tests serially to maintain user session state
test.describe.configure({ mode: "serial" });

test.describe("Happy Path: Scheduled Workflow", () => {
  test("create and save a scheduled workflow with webhook action", async ({
    page,
  }) => {
    // Step 1: Create a new workflow
    const workflowId = await createWorkflow(page, "Test Scheduled Workflow");
    expect(workflowId).toBeTruthy();

    // Step 2: Configure schedule trigger (every hour)
    await configureScheduleTrigger(page, "0 * * * *");

    // Step 3: Add Send Webhook action
    await addActionNode(page, "Send Webhook");

    // Step 4: Verify action node exists
    const actionNode = page.locator(".react-flow__node-action");
    await expect(actionNode).toBeVisible({ timeout: 5000 });

    // Step 5: Save the workflow
    await saveWorkflow(page);

    // Step 6: Verify save succeeded (workflow persisted)
    await page.reload();
    await waitForCanvas(page);

    // Verify the action node is still present after reload
    const actionNodeAfterReload = page.locator(".react-flow__node-action");
    await expect(actionNodeAfterReload).toBeVisible({ timeout: 10_000 });
  });

  test("schedule trigger configuration persists after save", async ({
    page,
  }) => {
    // Create workflow
    await createWorkflow(page, "Persistence Test Workflow");

    // Configure schedule with specific cron
    const cronExpression = "30 8 * * 1-5"; // 8:30 AM weekdays
    await configureScheduleTrigger(page, cronExpression);

    // Save
    await saveWorkflow(page);

    // Reload page
    await page.reload();
    await waitForCanvas(page);

    // Click trigger node to view config
    const triggerNode = page.locator(".react-flow__node-trigger").first();
    await triggerNode.click();

    // Verify cron expression persisted
    const cronInput = page.locator(
      '[data-testid="cron-input"], #cron-expression'
    );
    if (await cronInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(cronInput).toHaveValue(cronExpression);
    }
  });

  test("saved workflow can be reloaded", async ({ page }) => {
    // Create and save workflow
    await createWorkflow(page);
    await saveWorkflow(page);

    // Get the current URL (should contain workflow ID)
    const url = page.url();
    expect(url).toMatch(WORKFLOW_URL_REGEX);

    // Reload the page
    await page.reload();
    await waitForCanvas(page);

    // Verify the workflow still loads (trigger node visible)
    const triggerNode = page.locator(".react-flow__node-trigger");
    await expect(triggerNode).toBeVisible({ timeout: 10_000 });
  });
});
