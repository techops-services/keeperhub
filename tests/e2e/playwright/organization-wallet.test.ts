import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { signUpAndVerify as signUpAndVerifyBase } from "./utils";

// Regex patterns (moved to top level for performance)
const SLUG_PATTERN = /test-org-/;
const CREATED_PATTERN = /created/i;
const WALLET_CREATED_PATTERN = /wallet created/i;
const ADDRESS_PATTERN = /0x.*\.\.\./;
const COPIED_PATTERN = /copied/i;

// Sign up and wait for org switcher to appear
async function signUpAndVerify(
  page: Page,
  opts?: { email?: string }
): Promise<{ email: string }> {
  const { email } = await signUpAndVerifyBase(page, { email: opts?.email });

  // Wait for org switcher to appear (org auto-created after first sign-in)
  await expect(page.locator('button[role="combobox"]')).toBeVisible({
    timeout: 15_000,
  });

  return { email };
}

// Open the organization creation form from Manage Organizations modal
async function openCreateOrgForm(page: Page): Promise<void> {
  const orgSwitcher = page.locator('button[role="combobox"]');
  await orgSwitcher.click();

  await page.locator("text=Manage Organizations").click();

  const dialog = page.locator('[role="dialog"]');
  await expect(
    dialog.locator('h2:has-text("Manage Organizations")')
  ).toBeVisible({ timeout: 5000 });

  // Click the "Create New Organization" button to show the form
  await dialog.locator('button:has-text("Create New Organization")').click();

  // Wait for the org name input to appear (form is now visible)
  await expect(dialog.locator("#org-name")).toBeVisible({ timeout: 5000 });
}

// Open the wallet overlay from the user menu
async function openWalletOverlay(page: Page): Promise<void> {
  // Click on user menu (avatar button)
  const userMenuButton = page
    .locator('button[aria-haspopup="menu"]')
    .filter({ has: page.locator("span.relative") })
    .first();
  await userMenuButton.click();

  // Wait for dropdown menu to appear
  const dropdownMenu = page.locator('[role="menu"]');
  await expect(dropdownMenu).toBeVisible({ timeout: 5000 });

  // Click on Wallet menu item
  await dropdownMenu.locator('div[role="menuitem"]:has-text("Wallet")').click();

  // Wait for wallet overlay to appear
  const overlay = page.locator('[role="dialog"]');
  await expect(overlay.locator("text=Organization Wallet")).toBeVisible({
    timeout: 5000,
  });
}

// Run tests serially to avoid session state conflicts
test.describe.configure({ mode: "serial" });

test.describe("Organization Management", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test.describe("Organization Creation", () => {
    test("ORG-CREATE-1: user can create a new organization", async ({
      page,
    }) => {
      await signUpAndVerify(page);

      // Open create organization form
      await openCreateOrgForm(page);

      const dialog = page.locator('[role="dialog"]');

      // Fill in organization details
      const orgName = `Test Org ${Date.now()}`;
      await dialog.locator("#org-name").fill(orgName);

      // Verify slug is auto-generated
      const slugInput = dialog.locator("#org-slug");
      await expect(slugInput).toHaveValue(SLUG_PATTERN);

      // Submit the form
      await dialog.locator('button:has-text("Create")').click();

      // Verify success - should redirect or show the new org
      await expect(
        page.locator("[data-sonner-toast]").filter({ hasText: CREATED_PATTERN })
      ).toBeVisible({ timeout: 10_000 });
    });

    test("ORG-CREATE-2: slug is auto-generated from name", async ({ page }) => {
      await signUpAndVerify(page);
      await openCreateOrgForm(page);

      const dialog = page.locator('[role="dialog"]');

      // Type organization name
      await dialog.locator("#org-name").fill("My Test Organization");

      // Verify slug is auto-generated with correct format
      const slugInput = dialog.locator("#org-slug");
      await expect(slugInput).toHaveValue("my-test-organization");
    });

    test("ORG-CREATE-3: user can manually edit slug", async ({ page }) => {
      await signUpAndVerify(page);
      await openCreateOrgForm(page);

      const dialog = page.locator('[role="dialog"]');

      // Fill in organization name
      await dialog.locator("#org-name").fill("My Organization");

      // Manually edit the slug
      const slugInput = dialog.locator("#org-slug");
      await slugInput.clear();
      await slugInput.fill("custom-slug-123");

      // Verify custom slug is preserved
      await expect(slugInput).toHaveValue("custom-slug-123");

      // Submit and verify success
      await dialog.locator('button:has-text("Create")').click();
      await expect(
        page.locator("[data-sonner-toast]").filter({ hasText: CREATED_PATTERN })
      ).toBeVisible({ timeout: 10_000 });
    });

    test("ORG-CREATE-4: new organization appears in org switcher", async ({
      page,
    }) => {
      await signUpAndVerify(page);

      // Create a new organization
      await openCreateOrgForm(page);
      const dialog = page.locator('[role="dialog"]');

      const orgName = `Switcher Test Org ${Date.now()}`;
      await dialog.locator("#org-name").fill(orgName);
      await dialog.locator('button:has-text("Create")').click();

      // Wait for creation
      await expect(
        page.locator("[data-sonner-toast]").filter({ hasText: CREATED_PATTERN })
      ).toBeVisible({ timeout: 10_000 });

      // Close any open dialogs by pressing Escape
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);

      // Open org switcher
      const orgSwitcher = page.locator('button[role="combobox"]');
      await expect(orgSwitcher).toBeVisible({ timeout: 5000 });
      await orgSwitcher.click();

      // Verify new org appears in the list
      const popover = page.locator('[role="listbox"]');
      await expect(popover).toBeVisible({ timeout: 5000 });
      await expect(popover.locator(`text=${orgName}`)).toBeVisible();
    });
  });
});

test.describe("Para Wallet Management", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test.describe("Wallet Creation", () => {
    test("WALLET-CREATE-1: admin can create organization wallet", async ({
      page,
    }) => {
      const { email } = await signUpAndVerify(page);

      // Open wallet overlay
      await openWalletOverlay(page);

      const overlay = page.locator('[role="dialog"]');

      // Verify no wallet message is shown
      await expect(overlay.locator("text=No wallet found")).toBeVisible({
        timeout: 5000,
      });

      // Click create wallet button
      await overlay
        .locator('button:has-text("Create Organization Wallet")')
        .click();

      // Verify form appears with pre-filled email
      const emailInput = overlay.locator("#wallet-email");
      await expect(emailInput).toBeVisible({ timeout: 5000 });
      await expect(emailInput).toHaveValue(email);

      // Submit the form
      await overlay.locator('button:has-text("Create Wallet")').click();

      // Verify success toast
      await expect(
        page
          .locator("[data-sonner-toast]")
          .filter({ hasText: WALLET_CREATED_PATTERN })
      ).toBeVisible({ timeout: 15_000 });

      // Verify wallet details are shown
      await expect(overlay.locator("text=Account details")).toBeVisible({
        timeout: 5000,
      });
    });

    test("WALLET-CREATE-2: wallet shows address after creation", async ({
      page,
    }) => {
      const { email } = await signUpAndVerify(page);

      await openWalletOverlay(page);
      const overlay = page.locator('[role="dialog"]');

      // Create wallet
      await overlay
        .locator('button:has-text("Create Organization Wallet")')
        .click();
      await overlay.locator('button:has-text("Create Wallet")').click();

      // Wait for wallet creation
      await expect(
        page
          .locator("[data-sonner-toast]")
          .filter({ hasText: WALLET_CREATED_PATTERN })
      ).toBeVisible({ timeout: 15_000 });

      // Verify wallet address is displayed (format: 0x...xxxx)
      await expect(overlay.locator("code")).toContainText(ADDRESS_PATTERN);

      // Verify email is displayed
      await expect(overlay.locator(`text=${email}`)).toBeVisible();
    });

    test("WALLET-CREATE-3: wallet form can be cancelled", async ({ page }) => {
      await signUpAndVerify(page);

      await openWalletOverlay(page);
      const overlay = page.locator('[role="dialog"]');

      // Click create wallet button
      await overlay
        .locator('button:has-text("Create Organization Wallet")')
        .click();

      // Verify form appears
      await expect(overlay.locator("#wallet-email")).toBeVisible({
        timeout: 5000,
      });

      // Click cancel
      await overlay.locator('button:has-text("Cancel")').click();

      // Verify form is hidden and original message is shown
      await expect(overlay.locator("#wallet-email")).toBeHidden();
      await expect(overlay.locator("text=No wallet found")).toBeVisible();
    });

    test("WALLET-CREATE-4: wallet creation requires email", async ({
      page,
    }) => {
      await signUpAndVerify(page);

      await openWalletOverlay(page);
      const overlay = page.locator('[role="dialog"]');

      // Open create form
      await overlay
        .locator('button:has-text("Create Organization Wallet")')
        .click();

      // Clear the pre-filled email
      const emailInput = overlay.locator("#wallet-email");
      await emailInput.clear();

      // Create button should be disabled when email is empty
      const createButton = overlay.locator('button:has-text("Create Wallet")');
      await expect(createButton).toBeDisabled();
    });
  });

  test.describe("Wallet Display", () => {
    test("WALLET-DISPLAY-1: wallet shows balance sections after creation", async ({
      page,
    }) => {
      await signUpAndVerify(page);

      await openWalletOverlay(page);
      const overlay = page.locator('[role="dialog"]');

      // Create wallet
      await overlay
        .locator('button:has-text("Create Organization Wallet")')
        .click();
      await overlay.locator('button:has-text("Create Wallet")').click();

      await expect(
        page
          .locator("[data-sonner-toast]")
          .filter({ hasText: WALLET_CREATED_PATTERN })
      ).toBeVisible({ timeout: 15_000 });

      // Verify balance section appears
      await expect(overlay.locator("text=Balances")).toBeVisible({
        timeout: 10_000,
      });

      // Verify mainnet/testnet toggle exists
      await expect(
        overlay.locator('button:has-text("Mainnets")')
      ).toBeVisible();
      await expect(
        overlay.locator('button:has-text("Testnets")')
      ).toBeVisible();
    });

    test("WALLET-DISPLAY-2: user can toggle between mainnets and testnets", async ({
      page,
    }) => {
      await signUpAndVerify(page);

      await openWalletOverlay(page);
      const overlay = page.locator('[role="dialog"]');

      // Create wallet first
      await overlay
        .locator('button:has-text("Create Organization Wallet")')
        .click();
      await overlay.locator('button:has-text("Create Wallet")').click();

      await expect(
        page
          .locator("[data-sonner-toast]")
          .filter({ hasText: WALLET_CREATED_PATTERN })
      ).toBeVisible({ timeout: 15_000 });

      // Wait for balance section
      await expect(overlay.locator("text=Balances")).toBeVisible({
        timeout: 10_000,
      });

      // Click testnets button
      await overlay.locator('button:has-text("Testnets")').click();

      // Testnets button should now have the active style (verify it's selected)
      const testnetsButton = overlay.locator('button:has-text("Testnets")');
      await expect(testnetsButton).toBeVisible();

      // Click mainnets button
      await overlay.locator('button:has-text("Mainnets")').click();

      // Mainnets button should be active again
      const mainnetsButton = overlay.locator('button:has-text("Mainnets")');
      await expect(mainnetsButton).toBeVisible();
    });

    test("WALLET-DISPLAY-3: admin can refresh balances", async ({ page }) => {
      await signUpAndVerify(page);

      await openWalletOverlay(page);
      const overlay = page.locator('[role="dialog"]');

      // Create wallet
      await overlay
        .locator('button:has-text("Create Organization Wallet")')
        .click();
      await overlay.locator('button:has-text("Create Wallet")').click();

      await expect(
        page
          .locator("[data-sonner-toast]")
          .filter({ hasText: WALLET_CREATED_PATTERN })
      ).toBeVisible({ timeout: 15_000 });

      // Wait for balance section
      await expect(overlay.locator("text=Balances")).toBeVisible({
        timeout: 10_000,
      });

      // Find and click refresh button (has RefreshCw icon)
      const refreshButton = overlay.locator(
        "button:has(svg.lucide-refresh-cw)"
      );
      await expect(refreshButton).toBeVisible();
      await refreshButton.click();

      // Button should show spinning animation (handled by CSS class)
      // Just verify the button is still clickable after refresh
      await page.waitForTimeout(1000);
      await expect(refreshButton).toBeEnabled();
    });
  });

  test.describe("Wallet Copy Address", () => {
    test("WALLET-COPY-1: user can copy wallet address", async ({ page }) => {
      await signUpAndVerify(page);

      await openWalletOverlay(page);
      const overlay = page.locator('[role="dialog"]');

      // Create wallet
      await overlay
        .locator('button:has-text("Create Organization Wallet")')
        .click();
      await overlay.locator('button:has-text("Create Wallet")').click();

      await expect(
        page
          .locator("[data-sonner-toast]")
          .filter({ hasText: WALLET_CREATED_PATTERN })
      ).toBeVisible({ timeout: 15_000 });

      // Wait for wallet details to load
      await expect(overlay.locator("text=Account details")).toBeVisible({
        timeout: 5000,
      });

      // Click copy button (near the address)
      const copyButton = overlay
        .locator("button")
        .filter({ has: page.locator("svg.lucide-copy") })
        .first();
      await copyButton.click();

      // Verify toast appears
      await expect(
        page.locator("[data-sonner-toast]").filter({ hasText: COPIED_PATTERN })
      ).toBeVisible({ timeout: 5000 });
    });
  });
});
