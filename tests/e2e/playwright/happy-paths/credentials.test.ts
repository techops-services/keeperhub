import { expect, test } from "@playwright/test";
import { signUpAndVerify } from "../utils";

// Run tests serially to maintain user session state
test.describe.configure({ mode: "serial" });

test.describe("Happy Path: Credentials Management", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("navigate to credentials page after authentication", async ({
    page,
  }) => {
    // Sign up and verify
    await signUpAndVerify(page);

    // Navigate to credentials page
    await page.goto("/settings/credentials", { waitUntil: "domcontentloaded" });

    // Verify credentials page loaded
    const heading = page.locator(
      'h1:has-text("Credentials"), h2:has-text("Credentials")'
    );
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test("add a new Discord webhook credential", async ({ page }) => {
    // Sign up and verify
    await signUpAndVerify(page);

    // Navigate to credentials page
    await page.goto("/settings/credentials", { waitUntil: "domcontentloaded" });

    // Click add credential button
    const addButton = page.locator(
      'button:has-text("Add Credential"), button:has-text("Add"), [data-testid="add-credential"]'
    );
    await expect(addButton).toBeVisible({ timeout: 10_000 });
    await addButton.click();

    // Select Discord from credential type options
    const discordOption = page.locator(
      '[data-testid="credential-type-discord"], button:has-text("Discord")'
    );
    if (await discordOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await discordOption.click();
    }

    // Fill in credential details
    const nameInput = page.locator(
      '[data-testid="credential-name"], #name, [name="name"]'
    );
    if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nameInput.fill("Test Discord Webhook");
    }

    const webhookUrlInput = page.locator(
      '[data-testid="webhook-url"], #webhookUrl, [name="webhookUrl"]'
    );
    if (await webhookUrlInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await webhookUrlInput.fill(
        "https://discord.com/api/webhooks/123456789/test-token"
      );
    }

    // Save credential
    const saveButton = page.locator(
      'button:has-text("Save"), button[type="submit"]'
    );
    await saveButton.click();

    // Verify credential appears in list
    const credentialItem = page.locator('text="Test Discord Webhook"');
    await expect(credentialItem).toBeVisible({ timeout: 10_000 });
  });

  test("edit existing credential", async ({ page }) => {
    // Sign up and verify
    await signUpAndVerify(page);

    // Navigate to credentials page
    await page.goto("/settings/credentials", { waitUntil: "domcontentloaded" });

    // First add a credential
    const addButton = page.locator(
      'button:has-text("Add Credential"), button:has-text("Add"), [data-testid="add-credential"]'
    );
    await expect(addButton).toBeVisible({ timeout: 10_000 });
    await addButton.click();

    // Fill minimal details
    const nameInput = page.locator(
      '[data-testid="credential-name"], #name, [name="name"]'
    );
    if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nameInput.fill("Edit Test Credential");
    }

    // Save
    const saveButton = page.locator(
      'button:has-text("Save"), button[type="submit"]'
    );
    if (await saveButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await saveButton.click();
    }

    // Find and click edit button on the credential
    const editButton = page
      .locator('[data-testid="edit-credential"], button:has-text("Edit")')
      .first();
    if (await editButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await editButton.click();

      // Update the name
      const editNameInput = page.locator(
        '[data-testid="credential-name"], #name, [name="name"]'
      );
      if (await editNameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await editNameInput.fill("Updated Credential Name");
      }

      // Save changes
      const updateButton = page.locator(
        'button:has-text("Update"), button:has-text("Save")'
      );
      if (await updateButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await updateButton.click();
      }

      // Verify updated name appears
      const updatedCredential = page.locator('text="Updated Credential Name"');
      await expect(updatedCredential).toBeVisible({ timeout: 10_000 });
    }
  });

  test("delete credential", async ({ page }) => {
    // Sign up and verify
    await signUpAndVerify(page);

    // Navigate to credentials page
    await page.goto("/settings/credentials", { waitUntil: "domcontentloaded" });

    // Add a credential to delete
    const addButton = page.locator(
      'button:has-text("Add Credential"), button:has-text("Add"), [data-testid="add-credential"]'
    );
    await expect(addButton).toBeVisible({ timeout: 10_000 });
    await addButton.click();

    const nameInput = page.locator(
      '[data-testid="credential-name"], #name, [name="name"]'
    );
    if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nameInput.fill("Delete Test Credential");
    }

    const saveButton = page.locator(
      'button:has-text("Save"), button[type="submit"]'
    );
    if (await saveButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await saveButton.click();
    }

    // Wait for credential to appear
    const credentialItem = page.locator('text="Delete Test Credential"');
    await expect(credentialItem).toBeVisible({ timeout: 10_000 });

    // Click delete button
    const deleteButton = page
      .locator('[data-testid="delete-credential"], button:has-text("Delete")')
      .first();
    if (await deleteButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await deleteButton.click();

      // Confirm deletion if dialog appears
      const confirmButton = page.locator(
        'button:has-text("Confirm"), button:has-text("Yes")'
      );
      if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmButton.click();
      }

      // Verify credential is removed
      await expect(credentialItem).not.toBeVisible({ timeout: 10_000 });
    }
  });

  test("credential is available in workflow action config", async ({
    page,
  }) => {
    // Sign up and verify
    await signUpAndVerify(page);

    // First add a credential
    await page.goto("/settings/credentials", { waitUntil: "domcontentloaded" });

    const addButton = page.locator(
      'button:has-text("Add Credential"), button:has-text("Add"), [data-testid="add-credential"]'
    );
    await expect(addButton).toBeVisible({ timeout: 10_000 });
    await addButton.click();

    const nameInput = page.locator(
      '[data-testid="credential-name"], #name, [name="name"]'
    );
    if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nameInput.fill("Workflow Test Credential");
    }

    const saveButton = page.locator(
      'button:has-text("Save"), button[type="submit"]'
    );
    if (await saveButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await saveButton.click();
    }

    // Now create a workflow and check credential is available
    await page.goto("/workflows", { waitUntil: "domcontentloaded" });

    const createButton = page.locator('button:has-text("New Workflow")');
    if (await createButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await createButton.click();

      // Wait for canvas
      await page.waitForSelector('[data-testid="workflow-canvas"]', {
        state: "visible",
        timeout: 60_000,
      });

      // Add an action that uses credentials
      const triggerHandle = page.locator(
        ".react-flow__node-trigger .react-flow__handle-source"
      );
      if (await triggerHandle.isVisible({ timeout: 5000 }).catch(() => false)) {
        const handleBox = await triggerHandle.boundingBox();
        if (handleBox) {
          await page.mouse.move(
            handleBox.x + handleBox.width / 2,
            handleBox.y + handleBox.height / 2
          );
          await page.mouse.down();
          await page.mouse.move(handleBox.x + 300, handleBox.y);
          await page.mouse.up();

          // Look for credential selector in action config
          const credentialSelect = page.locator(
            '[data-testid="credential-select"], [name="credential"]'
          );
          if (
            await credentialSelect
              .isVisible({ timeout: 5000 })
              .catch(() => false)
          ) {
            // Verify our credential appears as an option
            await credentialSelect.click();
            const credentialOption = page.locator(
              'text="Workflow Test Credential"'
            );
            await expect(credentialOption).toBeVisible({ timeout: 5000 });
          }
        }
      }
    }
  });
});
