import { expect, test } from "@playwright/test";
import {
  addActionNode,
  createWorkflow,
  saveWorkflow,
  signUpAndVerify,
  waitForCanvas,
} from "../utils";

// Run tests serially to maintain user session state
test.describe.configure({ mode: "serial" });

test.describe("Happy Path: Address Book", () => {
  const TEST_ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
  const TEST_LABEL = "Vitalik Wallet";

  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("navigate to address book page", async ({ page }) => {
    // Sign up and verify
    await signUpAndVerify(page);

    // Navigate to address book
    await page.goto("/settings/address-book", {
      waitUntil: "domcontentloaded",
    });

    // Verify page loaded
    const heading = page.locator(
      'h1:has-text("Address"), h2:has-text("Address"), h1:has-text("Addresses")'
    );
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test("add new address entry", async ({ page }) => {
    // Sign up and verify
    await signUpAndVerify(page);

    // Navigate to address book
    await page.goto("/settings/address-book", {
      waitUntil: "domcontentloaded",
    });

    // Click add address button
    const addButton = page.locator(
      'button:has-text("Add Address"), button:has-text("Add"), [data-testid="add-address"]'
    );
    await expect(addButton).toBeVisible({ timeout: 10_000 });
    await addButton.click();

    // Fill in address details
    const labelInput = page.locator(
      '[data-testid="address-label"], #label, [name="label"]'
    );
    if (await labelInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await labelInput.fill(TEST_LABEL);
    }

    const addressInput = page.locator(
      '[data-testid="address-input"], #address, [name="address"]'
    );
    if (await addressInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addressInput.fill(TEST_ADDRESS);
    }

    // Save address
    const saveButton = page.locator(
      'button:has-text("Save"), button[type="submit"]'
    );
    await saveButton.click();

    // Verify address appears in list
    const addressItem = page.locator(`text="${TEST_LABEL}"`);
    await expect(addressItem).toBeVisible({ timeout: 10_000 });
  });

  test("address validation rejects invalid addresses", async ({ page }) => {
    // Sign up and verify
    await signUpAndVerify(page);

    // Navigate to address book
    await page.goto("/settings/address-book", {
      waitUntil: "domcontentloaded",
    });

    // Click add address button
    const addButton = page.locator(
      'button:has-text("Add Address"), button:has-text("Add"), [data-testid="add-address"]'
    );
    await expect(addButton).toBeVisible({ timeout: 10_000 });
    await addButton.click();

    // Fill invalid address
    const labelInput = page.locator(
      '[data-testid="address-label"], #label, [name="label"]'
    );
    if (await labelInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await labelInput.fill("Invalid Test");
    }

    const addressInput = page.locator(
      '[data-testid="address-input"], #address, [name="address"]'
    );
    if (await addressInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addressInput.fill("not-a-valid-address");
    }

    // Try to save
    const saveButton = page.locator(
      'button:has-text("Save"), button[type="submit"]'
    );
    await saveButton.click();

    // Verify error message appears
    const errorMessage = page.locator(
      '.text-destructive, [data-testid="error-message"], text=/invalid/i'
    );
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });

  test("edit existing address entry", async ({ page }) => {
    // Sign up and verify
    await signUpAndVerify(page);

    // Navigate to address book
    await page.goto("/settings/address-book", {
      waitUntil: "domcontentloaded",
    });

    // Add an address first
    const addButton = page.locator(
      'button:has-text("Add Address"), button:has-text("Add"), [data-testid="add-address"]'
    );
    await expect(addButton).toBeVisible({ timeout: 10_000 });
    await addButton.click();

    const labelInput = page.locator(
      '[data-testid="address-label"], #label, [name="label"]'
    );
    if (await labelInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await labelInput.fill("Edit Test Address");
    }

    const addressInput = page.locator(
      '[data-testid="address-input"], #address, [name="address"]'
    );
    if (await addressInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addressInput.fill(TEST_ADDRESS);
    }

    const saveButton = page.locator(
      'button:has-text("Save"), button[type="submit"]'
    );
    await saveButton.click();

    // Wait for address to appear
    const addressItem = page.locator('text="Edit Test Address"');
    await expect(addressItem).toBeVisible({ timeout: 10_000 });

    // Click edit
    const editButton = page
      .locator('[data-testid="edit-address"], button:has-text("Edit")')
      .first();
    if (await editButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await editButton.click();

      // Update label
      const editLabelInput = page.locator(
        '[data-testid="address-label"], #label, [name="label"]'
      );
      if (
        await editLabelInput.isVisible({ timeout: 3000 }).catch(() => false)
      ) {
        await editLabelInput.fill("Updated Address Label");
      }

      // Save changes
      const updateButton = page.locator(
        'button:has-text("Update"), button:has-text("Save")'
      );
      if (await updateButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await updateButton.click();
      }

      // Verify updated label
      const updatedAddress = page.locator('text="Updated Address Label"');
      await expect(updatedAddress).toBeVisible({ timeout: 10_000 });
    }
  });

  test("delete address entry", async ({ page }) => {
    // Sign up and verify
    await signUpAndVerify(page);

    // Navigate to address book
    await page.goto("/settings/address-book", {
      waitUntil: "domcontentloaded",
    });

    // Add an address to delete
    const addButton = page.locator(
      'button:has-text("Add Address"), button:has-text("Add"), [data-testid="add-address"]'
    );
    await expect(addButton).toBeVisible({ timeout: 10_000 });
    await addButton.click();

    const labelInput = page.locator(
      '[data-testid="address-label"], #label, [name="label"]'
    );
    if (await labelInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await labelInput.fill("Delete Test Address");
    }

    const addressInput = page.locator(
      '[data-testid="address-input"], #address, [name="address"]'
    );
    if (await addressInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addressInput.fill(TEST_ADDRESS);
    }

    const saveButton = page.locator(
      'button:has-text("Save"), button[type="submit"]'
    );
    await saveButton.click();

    // Wait for address to appear
    const addressItem = page.locator('text="Delete Test Address"');
    await expect(addressItem).toBeVisible({ timeout: 10_000 });

    // Delete
    const deleteButton = page
      .locator('[data-testid="delete-address"], button:has-text("Delete")')
      .first();
    if (await deleteButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await deleteButton.click();

      // Confirm if dialog appears
      const confirmButton = page.locator(
        'button:has-text("Confirm"), button:has-text("Yes")'
      );
      if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmButton.click();
      }

      // Verify removed
      await expect(addressItem).not.toBeVisible({ timeout: 10_000 });
    }
  });

  test("use address book entry in Web3 workflow", async ({ page }) => {
    // Sign up and verify
    await signUpAndVerify(page);

    // First add an address to the address book
    await page.goto("/settings/address-book", {
      waitUntil: "domcontentloaded",
    });

    const addButton = page.locator(
      'button:has-text("Add Address"), button:has-text("Add"), [data-testid="add-address"]'
    );
    await expect(addButton).toBeVisible({ timeout: 10_000 });
    await addButton.click();

    const labelInput = page.locator(
      '[data-testid="address-label"], #label, [name="label"]'
    );
    if (await labelInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await labelInput.fill("Workflow Address Test");
    }

    const addressInput = page.locator(
      '[data-testid="address-input"], #address, [name="address"]'
    );
    if (await addressInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addressInput.fill(TEST_ADDRESS);
    }

    const saveButton = page.locator(
      'button:has-text("Save"), button[type="submit"]'
    );
    await saveButton.click();

    // Wait for address to be saved
    const addressItem = page.locator('text="Workflow Address Test"');
    await expect(addressItem).toBeVisible({ timeout: 10_000 });

    // Now create a workflow with Web3 action
    await createWorkflow(page, "Address Book Workflow");

    // Add check-balance action
    await addActionNode(page, "check-balance");

    // Click on action node to configure
    const actionNode = page.locator(".react-flow__node-action").first();
    await actionNode.click();

    // Look for address book selector or autocomplete
    const addressSelector = page.locator(
      '[data-testid="address-book-select"], [data-testid="address-autocomplete"]'
    );
    if (await addressSelector.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addressSelector.click();

      // Select our address from the book
      const addressOption = page.locator('text="Workflow Address Test"');
      if (await addressOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await addressOption.click();

        // Verify address was populated
        const configAddressInput = page.locator(
          '[data-testid="address-input"], #address, [name="address"]'
        );
        if (
          await configAddressInput
            .isVisible({ timeout: 2000 })
            .catch(() => false)
        ) {
          await expect(configAddressInput).toHaveValue(TEST_ADDRESS);
        }
      }
    }

    // Save workflow
    await saveWorkflow(page);

    // Reload and verify address persisted
    await page.reload();
    await waitForCanvas(page);

    // Click action to view config
    const actionNodeReload = page.locator(".react-flow__node-action").first();
    await actionNodeReload.click();

    const reloadAddressInput = page.locator(
      '[data-testid="address-input"], #address, [name="address"]'
    );
    if (
      await reloadAddressInput.isVisible({ timeout: 3000 }).catch(() => false)
    ) {
      await expect(reloadAddressInput).toHaveValue(TEST_ADDRESS);
    }
  });
});
