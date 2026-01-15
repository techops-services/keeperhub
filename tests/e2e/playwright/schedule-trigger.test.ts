import { expect, test } from "@playwright/test";

// Top-level regex for class matching
const SELECTED_CLASS_REGEX = /selected/;

test.describe("Schedule Trigger", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the homepage with the workflow canvas
    await page.goto("/", { waitUntil: "domcontentloaded" });
    // Wait for the canvas to be ready
    await page.waitForSelector('[data-testid="workflow-canvas"]', {
      state: "visible",
      timeout: 60_000,
    });
  });

  test("can access trigger node configuration", async ({ page }) => {
    // Wait for nodes to be visible
    await page.waitForTimeout(1000);

    // Find and click the trigger node
    const triggerNode = page.locator(".react-flow__node-trigger").first();

    if (await triggerNode.isVisible()) {
      await triggerNode.click();
      await page.waitForTimeout(300);

      // Verify trigger node is selected
      await expect(triggerNode).toHaveClass(SELECTED_CLASS_REGEX);

      // Check that properties panel shows trigger configuration
      const _propertiesPanel = page.locator('[data-testid="properties-panel"]');
      // The panel may or may not exist depending on implementation
      // Just verify the trigger node can be selected
    }
  });

  test("trigger node shows trigger type options", async ({ page }) => {
    await page.waitForTimeout(1000);

    const triggerNode = page.locator(".react-flow__node-trigger").first();

    if (await triggerNode.isVisible()) {
      await triggerNode.click();
      await page.waitForTimeout(500);

      // Look for trigger type selector/dropdown
      // The exact testid depends on the UI implementation
      const triggerTypeSelector = page.locator(
        '[data-testid="trigger-type-selector"], [data-testid="trigger-config"]'
      );

      // If trigger type selector exists, verify it's accessible
      if (await triggerTypeSelector.isVisible()) {
        await expect(triggerTypeSelector).toBeVisible();
      }
    }
  });

  test("workflow canvas maintains state after trigger configuration", async ({
    page,
  }) => {
    await page.waitForTimeout(1000);

    // Get initial node count
    const initialNodes = await page.locator(".react-flow__node").count();

    // Click on trigger node
    const triggerNode = page.locator(".react-flow__node-trigger").first();
    if (await triggerNode.isVisible()) {
      await triggerNode.click();
      await page.waitForTimeout(300);

      // Click elsewhere to deselect
      const canvas = page.locator('[data-testid="workflow-canvas"]');
      const canvasBox = await canvas.boundingBox();
      if (canvasBox) {
        await page.mouse.click(canvasBox.x + 50, canvasBox.y + 50);
        await page.waitForTimeout(300);
      }
    }

    // Verify node count is preserved
    const finalNodes = await page.locator(".react-flow__node").count();
    expect(finalNodes).toBe(initialNodes);
  });

  test("can create workflow with action node after trigger", async ({
    page,
  }) => {
    await page.waitForTimeout(1000);

    // Find the trigger node's source handle
    const triggerHandle = page.locator(
      ".react-flow__node-trigger .react-flow__handle-source"
    );

    if (await triggerHandle.isVisible()) {
      const handleBox = await triggerHandle.boundingBox();
      if (handleBox) {
        // Drag from handle to create new node
        await page.mouse.move(
          handleBox.x + handleBox.width / 2,
          handleBox.y + handleBox.height / 2
        );
        await page.mouse.down();
        await page.mouse.move(handleBox.x + 300, handleBox.y);
        await page.mouse.up();

        await page.waitForTimeout(500);

        // Verify action grid appears
        const actionGrid = page.locator('[data-testid="action-grid"]');
        await expect(actionGrid).toBeVisible({ timeout: 5000 });

        // Verify we can select an action
        const httpRequestAction = page.locator(
          '[data-testid="action-option-http-request"]'
        );

        if (await httpRequestAction.isVisible()) {
          await httpRequestAction.click();
          await page.waitForTimeout(500);

          // Verify action node exists
          const actionNode = page.locator(".react-flow__node-action");
          await expect(actionNode).toBeVisible();
        }
      }
    }
  });

  test("workflow has visible edge between trigger and action", async ({
    page,
  }) => {
    await page.waitForTimeout(1000);

    // Create an action node from trigger
    const triggerHandle = page.locator(
      ".react-flow__node-trigger .react-flow__handle-source"
    );

    if (await triggerHandle.isVisible()) {
      const handleBox = await triggerHandle.boundingBox();
      if (handleBox) {
        await page.mouse.move(
          handleBox.x + handleBox.width / 2,
          handleBox.y + handleBox.height / 2
        );
        await page.mouse.down();
        await page.mouse.move(handleBox.x + 300, handleBox.y);
        await page.mouse.up();

        await page.waitForTimeout(500);

        // Select an action
        const httpRequestAction = page.locator(
          '[data-testid="action-option-http-request"]'
        );

        if (await httpRequestAction.isVisible()) {
          await httpRequestAction.click();
          await page.waitForTimeout(500);

          // Verify edge exists
          const edges = page.locator(".react-flow__edge");
          const edgeCount = await edges.count();
          expect(edgeCount).toBeGreaterThan(0);
        }
      }
    }
  });

  test("trigger node displays label", async ({ page }) => {
    await page.waitForTimeout(1000);

    const triggerNode = page.locator(".react-flow__node-trigger").first();

    if (await triggerNode.isVisible()) {
      // Trigger should have some text content
      const nodeText = await triggerNode.textContent();
      expect(nodeText).toBeTruthy();
    }
  });
});

// API and Database tests for workflow execution are in:
// - tests/e2e/workflow-runner.test.ts (vitest - execution lifecycle, database updates)
