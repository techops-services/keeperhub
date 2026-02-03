import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

// Top-level regex for workflow ID extraction
const WORKFLOW_ID_REGEX = /\/workflows?\/([a-zA-Z0-9_-]+)/;

/**
 * Wait for workflow canvas to be ready.
 */
export async function waitForCanvas(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="workflow-canvas"]', {
    state: "visible",
    timeout: 60_000,
  });
}

/**
 * Create a new workflow by navigating to the new workflow page.
 * Returns the workflow ID from the URL.
 */
export async function createWorkflow(
  page: Page,
  name?: string
): Promise<string> {
  // Navigate to workflows page
  await page.goto("/workflows", { waitUntil: "domcontentloaded" });

  // Click create new workflow button
  const createButton = page.locator('button:has-text("New Workflow")');
  await expect(createButton).toBeVisible({ timeout: 10_000 });
  await createButton.click();

  // Wait for canvas to load
  await waitForCanvas(page);

  // Extract workflow ID from URL
  const url = page.url();
  const match = url.match(WORKFLOW_ID_REGEX);
  if (!match) {
    throw new Error(`Could not extract workflow ID from URL: ${url}`);
  }

  const workflowId = match[1];

  // Set workflow name if provided
  if (name) {
    const nameInput = page.locator('[data-testid="workflow-name-input"]');
    if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nameInput.fill(name);
    }
  }

  return workflowId;
}

/**
 * Open an existing workflow by ID.
 */
export async function openWorkflow(
  page: Page,
  workflowId: string
): Promise<void> {
  await page.goto(`/workflow/${workflowId}`, { waitUntil: "domcontentloaded" });
  await waitForCanvas(page);
}

/**
 * Add an action node to the workflow canvas by dragging from trigger.
 */
export async function addActionNode(
  page: Page,
  actionSlug: string
): Promise<void> {
  // Find the trigger node's source handle
  const triggerHandle = page.locator(
    ".react-flow__node-trigger .react-flow__handle-source"
  );

  await expect(triggerHandle).toBeVisible({ timeout: 5000 });

  const handleBox = await triggerHandle.boundingBox();
  if (!handleBox) {
    throw new Error("Could not get trigger handle bounding box");
  }

  // Drag from handle to create new node
  await page.mouse.move(
    handleBox.x + handleBox.width / 2,
    handleBox.y + handleBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(handleBox.x + 300, handleBox.y);
  await page.mouse.up();

  // Wait for action grid to appear
  const actionGrid = page.locator('[data-testid="action-grid"]');
  await expect(actionGrid).toBeVisible({ timeout: 5000 });

  // Select the specified action
  const actionOption = page.locator(
    `[data-testid="action-option-${actionSlug}"]`
  );
  await expect(actionOption).toBeVisible({ timeout: 5000 });
  await actionOption.click();

  // Wait for action grid to close (action selected)
  await expect(actionGrid).not.toBeVisible({ timeout: 5000 });
}

/**
 * Configure an action node with the given values.
 * Expects the action node to be selected.
 */
export async function configureAction(
  page: Page,
  config: Record<string, string>
): Promise<void> {
  for (const [fieldName, value] of Object.entries(config)) {
    const input = page.locator(
      `[data-testid="config-${fieldName}"], #${fieldName}`
    );
    if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
      await input.fill(value);
    }
  }
}

/**
 * Save the current workflow.
 */
export async function saveWorkflow(page: Page): Promise<void> {
  const saveButton = page.locator(
    'button:has-text("Save"), [data-testid="save-workflow"]'
  );
  await expect(saveButton).toBeVisible({ timeout: 5000 });
  await saveButton.click();

  // Wait for save confirmation (toast or button state change)
  const toast = page.locator("[data-sonner-toast]").first();
  await expect(toast).toBeVisible({ timeout: 10_000 });
}

/**
 * Trigger a workflow manually via the UI.
 */
export async function triggerWorkflowManually(page: Page): Promise<void> {
  const triggerButton = page.locator(
    'button:has-text("Run"), button:has-text("Execute"), [data-testid="run-workflow"]'
  );
  await expect(triggerButton).toBeVisible({ timeout: 5000 });
  await triggerButton.click();

  // Wait for execution to start
  const toast = page.locator("[data-sonner-toast]").first();
  await expect(toast).toBeVisible({ timeout: 10_000 });
}

/**
 * Configure the trigger node with schedule settings.
 */
export async function configureScheduleTrigger(
  page: Page,
  cronExpression: string
): Promise<void> {
  // Click on trigger node to select it
  const triggerNode = page.locator(".react-flow__node-trigger").first();
  await expect(triggerNode).toBeVisible({ timeout: 5000 });
  await triggerNode.click();

  // Find and fill cron expression input
  const cronInput = page.locator(
    '[data-testid="cron-input"], #cron-expression'
  );
  if (await cronInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await cronInput.fill(cronExpression);
  }

  // Enable schedule if toggle exists
  const scheduleToggle = page.locator('[data-testid="schedule-toggle"]');
  if (await scheduleToggle.isVisible({ timeout: 1000 }).catch(() => false)) {
    const isChecked = await scheduleToggle.isChecked();
    if (!isChecked) {
      await scheduleToggle.click();
    }
  }
}

/**
 * Get the webhook URL for the current workflow.
 */
export async function getWebhookUrl(page: Page): Promise<string> {
  // Click on trigger node
  const triggerNode = page.locator(".react-flow__node-trigger").first();
  await expect(triggerNode).toBeVisible({ timeout: 5000 });
  await triggerNode.click();

  // Find webhook URL display
  const webhookUrl = page.locator(
    '[data-testid="webhook-url"], [data-testid="trigger-url"]'
  );
  await expect(webhookUrl).toBeVisible({ timeout: 5000 });

  const url = await webhookUrl.textContent();
  if (!url) {
    throw new Error("Webhook URL not found");
  }

  return url.trim();
}

/**
 * Copy webhook URL to clipboard and return it.
 */
export async function copyWebhookUrl(page: Page): Promise<string> {
  const copyButton = page.locator('[data-testid="copy-webhook-url"]');
  await expect(copyButton).toBeVisible({ timeout: 5000 });
  await copyButton.click();

  // Get URL from clipboard
  const url = await page.evaluate(async () => navigator.clipboard.readText());

  return url;
}

/**
 * Navigate to execution history for a workflow.
 */
export async function viewExecutionHistory(
  page: Page,
  workflowId: string
): Promise<void> {
  await page.goto(`/workflow/${workflowId}/history`, {
    waitUntil: "domcontentloaded",
  });

  // Wait for history table to load
  const historyTable = page.locator('[data-testid="execution-history"]');
  await expect(historyTable).toBeVisible({ timeout: 10_000 });
}

/**
 * Check if execution completed successfully by execution ID.
 */
export async function checkExecutionStatus(
  page: Page,
  executionId: string
): Promise<"success" | "failed" | "running" | "pending"> {
  const executionRow = page.locator(`[data-execution-id="${executionId}"]`);
  const statusBadge = executionRow.locator('[data-testid="execution-status"]');

  const status = await statusBadge.textContent();
  if (!status) {
    throw new Error(`Could not get status for execution: ${executionId}`);
  }

  const normalized = status.toLowerCase().trim();
  if (normalized.includes("success") || normalized.includes("completed")) {
    return "success";
  }
  if (normalized.includes("fail") || normalized.includes("error")) {
    return "failed";
  }
  if (normalized.includes("running") || normalized.includes("executing")) {
    return "running";
  }
  return "pending";
}
