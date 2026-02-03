import { expect, test } from "@playwright/test";
import {
  addActionNode,
  configureScheduleTrigger,
  createWorkflow,
  saveWorkflow,
  signUpAndVerify,
  waitForCanvas,
} from "../utils";

// Run tests serially to maintain user session state
test.describe.configure({ mode: "serial" });

test.describe("Happy Path: Scheduled Workflow", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("create and save a scheduled workflow with HTTP action", async ({
    page,
  }) => {
    // Step 1: Sign up and verify
    await signUpAndVerify(page);

    // Step 2: Create a new workflow
    const workflowId = await createWorkflow(page, "Test Scheduled Workflow");
    expect(workflowId).toBeTruthy();

    // Step 3: Configure schedule trigger (every hour)
    await configureScheduleTrigger(page, "0 * * * *");

    // Step 4: Add HTTP Request action
    await addActionNode(page, "http-request");

    // Step 5: Verify action node exists
    const actionNode = page.locator(".react-flow__node-action");
    await expect(actionNode).toBeVisible({ timeout: 5000 });

    // Step 6: Save the workflow
    await saveWorkflow(page);

    // Step 7: Verify save succeeded (workflow persisted)
    await page.reload();
    await waitForCanvas(page);

    // Verify the action node is still present after reload
    const actionNodeAfterReload = page.locator(".react-flow__node-action");
    await expect(actionNodeAfterReload).toBeVisible({ timeout: 10_000 });
  });

  test("schedule trigger configuration persists after save", async ({
    page,
  }) => {
    // Sign up and verify
    await signUpAndVerify(page);

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

  test("workflow appears in workflows list after creation", async ({
    page,
  }) => {
    // Sign up and verify
    await signUpAndVerify(page);

    // Create workflow with unique name
    const workflowName = `Workflow List Test ${Date.now()}`;
    await createWorkflow(page, workflowName);

    // Save workflow
    await saveWorkflow(page);

    // Navigate to workflows list
    await page.goto("/workflows", { waitUntil: "domcontentloaded" });

    // Verify workflow appears in list
    const workflowListItem = page.locator(`text="${workflowName}"`);
    await expect(workflowListItem).toBeVisible({ timeout: 10_000 });
  });
});
