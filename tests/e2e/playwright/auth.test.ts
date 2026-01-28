import { expect, test } from "@playwright/test";

// Run tests serially to avoid session state conflicts
test.describe.configure({ mode: "serial" });

test.describe("Authentication", () => {
  // Clear cookies before each test to ensure clean state
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test.describe("Email OTP Verification on Signup", () => {
    test("shows verification view after signup with OTP input", async ({
      page,
    }) => {
      await page.goto("/", { waitUntil: "domcontentloaded" });

      // Wait for page to fully load and find Sign In button (not inside dialog)
      const signInButton = page.locator('button:has-text("Sign In")').first();
      await expect(signInButton).toBeVisible({ timeout: 15_000 });
      await signInButton.click();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // Switch to signup view
      const createAccountLink = dialog.locator(
        'button:has-text("Create account")'
      );
      await createAccountLink.click();

      const dialogTitle = dialog.locator("h2");
      await expect(dialogTitle).toHaveText("Create account");

      // Fill in signup form
      const testEmail = `jacob+local${Date.now()}@techops.services`;
      await dialog.locator("#signup-email").fill(testEmail);
      await dialog.locator("#signup-password").fill("TestPassword123!");

      // Submit the form
      await dialog
        .locator('button[type="submit"]:has-text("Create account")')
        .click();

      // Dialog should switch to verify view
      await expect(dialog).toBeVisible({ timeout: 5000 });
      await expect(dialogTitle).toHaveText("Verify your email", {
        timeout: 15_000,
      });

      // Verify OTP input is present
      const otpInput = dialog.locator("#otp");
      await expect(otpInput).toBeVisible();

      // Verify toast notification appears
      const toast = page.locator("[data-sonner-toast]").first();
      await expect(toast).toBeVisible({ timeout: 5000 });

      // Verify resend and back links are present
      await expect(dialog.locator('button:has-text("Resend")')).toBeVisible();
      await expect(
        dialog.locator('button:has-text("Back to sign in")')
      ).toBeVisible();
    });

    test("shows error for invalid email format", async ({ page }) => {
      await page.goto("/", { waitUntil: "domcontentloaded" });

      const signInButton = page.locator('button:has-text("Sign In")').first();
      await expect(signInButton).toBeVisible({ timeout: 15_000 });
      await signInButton.click();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible({ timeout: 5000 });

      const createAccountLink = dialog.locator(
        'button:has-text("Create account")'
      );
      await createAccountLink.click();

      // Try to submit with invalid email
      await dialog.locator("#signup-email").fill("invalid-email");
      await dialog.locator("#signup-password").fill("TestPassword123!");
      await dialog
        .locator('button[type="submit"]:has-text("Create account")')
        .click();

      // HTML5 validation should prevent submission - form stays on signup view
      const dialogTitle = dialog.locator("h2");
      await expect(dialogTitle).toHaveText("Create account");
    });

    test("existing unverified user signing up redirects to verification", async ({
      page,
    }) => {
      await page.goto("/", { waitUntil: "domcontentloaded" });

      // First create an unverified account
      const testEmail = `jacob+existing${Date.now()}@techops.services`;

      const signInButton = page.locator('button:has-text("Sign In")').first();
      await expect(signInButton).toBeVisible({ timeout: 15_000 });
      await signInButton.click();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible({ timeout: 5000 });

      const createAccountLink = dialog.locator(
        'button:has-text("Create account")'
      );
      await createAccountLink.click();

      await dialog.locator("#signup-email").fill(testEmail);
      await dialog.locator("#signup-password").fill("TestPassword123!");
      await dialog
        .locator('button[type="submit"]:has-text("Create account")')
        .click();

      // Wait for verify view
      const dialogTitle = dialog.locator("h2");
      await expect(dialogTitle).toHaveText("Verify your email", {
        timeout: 15_000,
      });

      // Go back and try to sign up again with same email
      await dialog.locator('button:has-text("Back to sign in")').click();
      await expect(dialogTitle).toHaveText("Sign in", { timeout: 5000 });

      await dialog.locator('button:has-text("Create account")').click();
      await dialog.locator("#signup-email").fill(testEmail);
      await dialog.locator("#signup-password").fill("DifferentPassword123!");
      await dialog
        .locator('button[type="submit"]:has-text("Create account")')
        .click();

      // Should redirect to verification view (not show error)
      await expect(dialogTitle).toHaveText("Verify your email", {
        timeout: 15_000,
      });
    });

    test("OTP input only accepts numeric characters", async ({ page }) => {
      await page.goto("/", { waitUntil: "domcontentloaded" });

      const signInButton = page.locator('button:has-text("Sign In")').first();
      await expect(signInButton).toBeVisible({ timeout: 15_000 });
      await signInButton.click();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible({ timeout: 5000 });

      const createAccountLink = dialog.locator(
        'button:has-text("Create account")'
      );
      await createAccountLink.click();

      // Fill signup form
      const testEmail = `jacob+local${Date.now()}@techops.services`;
      await dialog.locator("#signup-email").fill(testEmail);
      await dialog.locator("#signup-password").fill("TestPassword123!");
      await dialog
        .locator('button[type="submit"]:has-text("Create account")')
        .click();

      // Wait for verify view
      const dialogTitle = dialog.locator("h2");
      await expect(dialogTitle).toHaveText("Verify your email", {
        timeout: 15_000,
      });

      // Try to enter non-numeric characters using type() to trigger onChange
      const otpInput = dialog.locator("#otp");
      await otpInput.pressSequentially("abc123def456", { delay: 50 });

      // Should only contain numeric characters, max 6
      await expect(otpInput).toHaveValue("123456");
    });

    test("verify button is disabled until 6 digits entered", async ({
      page,
    }) => {
      await page.goto("/", { waitUntil: "domcontentloaded" });

      const signInButton = page.locator('button:has-text("Sign In")').first();
      await expect(signInButton).toBeVisible({ timeout: 15_000 });
      await signInButton.click();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible({ timeout: 5000 });

      const createAccountLink = dialog.locator(
        'button:has-text("Create account")'
      );
      await createAccountLink.click();

      const testEmail = `jacob+local${Date.now()}@techops.services`;
      await dialog.locator("#signup-email").fill(testEmail);
      await dialog.locator("#signup-password").fill("TestPassword123!");
      await dialog
        .locator('button[type="submit"]:has-text("Create account")')
        .click();

      const dialogTitle = dialog.locator("h2");
      await expect(dialogTitle).toHaveText("Verify your email", {
        timeout: 15_000,
      });

      const verifyButton = dialog.locator(
        'button[type="submit"]:has-text("Verify")'
      );
      const otpInput = dialog.locator("#otp");

      // Button should be disabled with no input
      await expect(verifyButton).toBeDisabled();

      // Button should be disabled with partial input
      await otpInput.fill("123");
      await expect(verifyButton).toBeDisabled();

      // Button should be enabled with 6 digits
      await otpInput.fill("123456");
      await expect(verifyButton).toBeEnabled();
    });
  });

  test.describe("Sign In", () => {
    test("can open sign in dialog with email and password form", async ({
      page,
    }) => {
      await page.goto("/", { waitUntil: "domcontentloaded" });

      const signInButton = page.locator('button:has-text("Sign In")').first();
      await expect(signInButton).toBeVisible({ timeout: 15_000 });
      await signInButton.click();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible({ timeout: 5000 });

      const dialogTitle = dialog.locator("h2");
      await expect(dialogTitle).toHaveText("Sign in");

      await expect(dialog.locator("#email")).toBeVisible();
      await expect(dialog.locator("#password")).toBeVisible();
    });

    test("shows error for incorrect credentials", async ({ page }) => {
      await page.goto("/", { waitUntil: "domcontentloaded" });

      const signInButton = page.locator('button:has-text("Sign In")').first();
      await expect(signInButton).toBeVisible({ timeout: 15_000 });
      await signInButton.click();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible({ timeout: 5000 });

      await dialog.locator("#email").fill("nonexistent@example.com");
      await dialog.locator("#password").fill("WrongPassword123!");
      await dialog.locator('button[type="submit"]:has-text("Sign in")').click();

      const errorMessage = dialog.locator(".text-destructive");
      await expect(errorMessage).toBeVisible({ timeout: 10_000 });
    });

    test("unverified user signing in redirects to verification", async ({
      page,
    }) => {
      await page.goto("/", { waitUntil: "domcontentloaded" });

      // First create an unverified account
      const testEmail = `jacob+local${Date.now()}@techops.services`;
      const testPassword = "TestPassword123!";

      const signInButton = page.locator('button:has-text("Sign In")').first();
      await expect(signInButton).toBeVisible({ timeout: 15_000 });
      await signInButton.click();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // Sign up
      const createAccountLink = dialog.locator(
        'button:has-text("Create account")'
      );
      await createAccountLink.click();

      await dialog.locator("#signup-email").fill(testEmail);
      await dialog.locator("#signup-password").fill(testPassword);
      await dialog
        .locator('button[type="submit"]:has-text("Create account")')
        .click();

      // Wait for verify view
      const dialogTitle = dialog.locator("h2");
      await expect(dialogTitle).toHaveText("Verify your email", {
        timeout: 15_000,
      });

      // Go back to sign in
      await dialog.locator('button:has-text("Back to sign in")').click();
      await expect(dialogTitle).toHaveText("Sign in", { timeout: 5000 });

      // Try to sign in with unverified account
      await dialog.locator("#email").fill(testEmail);
      await dialog.locator("#password").fill(testPassword);
      await dialog.locator('button[type="submit"]:has-text("Sign in")').click();

      // Should redirect to verification view (not show error)
      await expect(dialogTitle).toHaveText("Verify your email", {
        timeout: 15_000,
      });

      // Toast should indicate verification needed (use first() to handle multiple toasts)
      const toast = page.locator("[data-sonner-toast]").first();
      await expect(toast).toBeVisible({ timeout: 5000 });
    });

    test("can navigate between sign in and create account views", async ({
      page,
    }) => {
      await page.goto("/", { waitUntil: "domcontentloaded" });

      const signInButton = page.locator('button:has-text("Sign In")').first();
      await expect(signInButton).toBeVisible({ timeout: 15_000 });
      await signInButton.click();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible({ timeout: 5000 });

      const dialogTitle = dialog.locator("h2");

      // Start on sign in
      await expect(dialogTitle).toHaveText("Sign in");

      // Go to create account - use the link inside the form
      const createAccountLink = dialog.locator(
        'button:has-text("Create account")'
      );
      await createAccountLink.click();
      await expect(dialogTitle).toHaveText("Create account");

      // Go back to sign in - find the specific link in the signup form
      const signInLink = dialog.locator(
        '.text-muted-foreground + button:has-text("Sign in")'
      );
      await signInLink.click();
      await expect(dialogTitle).toHaveText("Sign in");
    });
  });
});
