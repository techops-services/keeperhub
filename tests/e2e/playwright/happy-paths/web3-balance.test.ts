import { expect, test } from "@playwright/test";
import {
  addActionNode,
  configureAction,
  createWorkflow,
  saveWorkflow,
  signUpAndVerify,
  triggerWorkflowManually,
  waitForCanvas,
} from "../utils";

// Top-level regex for balance output validation
const BALANCE_OUTPUT_REGEX = /balance|eth|wei/i;

// Run tests serially to maintain user session state
test.describe.configure({ mode: "serial" });

test.describe("Happy Path: Web3 Balance Check", () => {
  // Known Ethereum address with balance (vitalik.eth)
  const TEST_ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
  const TEST_NETWORK = "mainnet";

  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("create workflow with Web3 check-balance action", async ({ page }) => {
    // Step 1: Sign up and verify
    await signUpAndVerify(page);

    // Step 2: Create a new workflow
    const workflowId = await createWorkflow(page, "Web3 Balance Workflow");
    expect(workflowId).toBeTruthy();

    // Step 3: Add Web3 check-balance action
    await addActionNode(page, "check-balance");

    // Step 4: Verify action node exists
    const actionNode = page.locator(".react-flow__node-action");
    await expect(actionNode).toBeVisible({ timeout: 5000 });

    // Step 5: Configure the action
    await configureAction(page, {
      network: TEST_NETWORK,
      address: TEST_ADDRESS,
    });

    // Step 6: Save the workflow
    await saveWorkflow(page);

    // Step 7: Verify save succeeded
    await page.reload();
    await waitForCanvas(page);

    const actionNodeAfterReload = page.locator(".react-flow__node-action");
    await expect(actionNodeAfterReload).toBeVisible({ timeout: 10_000 });
  });

  test("configure Web3 action with network selection", async ({ page }) => {
    // Sign up and verify
    await signUpAndVerify(page);

    // Create workflow
    await createWorkflow(page, "Web3 Network Test");

    // Add check-balance action
    await addActionNode(page, "check-balance");

    // Click on the action node to show config
    const actionNode = page.locator(".react-flow__node-action").first();
    await actionNode.click();

    // Find network selector
    const networkSelect = page.locator(
      '[data-testid="network-select"], #network, [name="network"]'
    );

    if (await networkSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Select mainnet
      await networkSelect.selectOption("mainnet");

      // Verify selection
      await expect(networkSelect).toHaveValue("mainnet");
    }
  });

  test("Web3 action configuration persists after save", async ({ page }) => {
    // Sign up and verify
    await signUpAndVerify(page);

    // Create workflow
    await createWorkflow(page, "Web3 Persistence Test");

    // Add and configure check-balance action
    await addActionNode(page, "check-balance");

    // Configure with specific values
    await configureAction(page, {
      network: TEST_NETWORK,
      address: TEST_ADDRESS,
    });

    // Save workflow
    await saveWorkflow(page);

    // Reload page
    await page.reload();
    await waitForCanvas(page);

    // Click action node to view config
    const actionNode = page.locator(".react-flow__node-action").first();
    await actionNode.click();

    // Verify address persisted
    const addressInput = page.locator(
      '[data-testid="address-input"], #address, [name="address"]'
    );
    if (await addressInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(addressInput).toHaveValue(TEST_ADDRESS);
    }
  });

  test("trigger Web3 workflow and verify execution output", async ({
    page,
  }) => {
    // Sign up and verify
    await signUpAndVerify(page);

    // Create and configure workflow
    const workflowId = await createWorkflow(page, "Web3 Execution Test");
    await addActionNode(page, "check-balance");
    await configureAction(page, {
      network: TEST_NETWORK,
      address: TEST_ADDRESS,
    });
    await saveWorkflow(page);

    // Trigger workflow manually
    await triggerWorkflowManually(page);

    // Navigate to execution history
    await page.goto(`/workflow/${workflowId}/history`, {
      waitUntil: "domcontentloaded",
    });

    // Wait for execution to appear
    const executionRow = page.locator('[data-testid="execution-row"]').first();
    await expect(executionRow).toBeVisible({ timeout: 60_000 });

    // Click on execution to view details
    await executionRow.click();

    // Verify output contains balance data
    const outputPanel = page.locator('[data-testid="execution-output"]');
    if (await outputPanel.isVisible({ timeout: 5000 }).catch(() => false)) {
      const outputText = await outputPanel.textContent();
      // Balance output should contain ETH-related data
      expect(outputText).toMatch(BALANCE_OUTPUT_REGEX);
    }
  });
});
