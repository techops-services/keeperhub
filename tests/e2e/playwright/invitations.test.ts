import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

const DATABASE_URL =
  process.env.DATABASE_URL || "postgres://localhost:5432/workflow";

// Query the verifications table for the OTP code sent to an email
async function getOtpFromDb(
  email: string,
  maxRetries = 10
): Promise<string> {
  const sql = postgres(DATABASE_URL, { max: 1 });
  try {
    for (let i = 0; i < maxRetries; i++) {
      const result = await sql`
        SELECT value FROM verifications
        WHERE identifier = ${`email-verification-otp-${email}`}
        ORDER BY created_at DESC
        LIMIT 1
      `;
      if (result.length > 0) {
        return result[0].value;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`No OTP found for ${email} after ${maxRetries} retries`);
  } finally {
    await sql.end();
  }
}

// Sign up a user without verifying OTP (just creates the account in the DB)
async function signUpOnly(page: Page): Promise<{ email: string }> {
  const testEmail = `jacob+e2e${Date.now()}@techops.services`;
  const testPassword = "TestPassword123!";

  await page.goto("/", { waitUntil: "domcontentloaded" });

  const signInButton = page.locator('button:has-text("Sign In")').first();
  await expect(signInButton).toBeVisible({ timeout: 15_000 });
  await signInButton.click();

  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible({ timeout: 5000 });

  await dialog.locator('button:has-text("Create account")').click();

  const dialogTitle = dialog.locator("h2");
  await expect(dialogTitle).toHaveText("Create account");

  await dialog.locator("#signup-email").fill(testEmail);
  await dialog.locator("#signup-password").fill(testPassword);
  await dialog
    .locator('button[type="submit"]:has-text("Create account")')
    .click();

  // Wait for verify view to confirm account was created
  await expect(dialogTitle).toHaveText("Verify your email", {
    timeout: 15_000,
  });

  return { email: testEmail };
}

// Sign up a new user, verify OTP from DB, and return authenticated
async function signUpAndVerify(page: Page): Promise<{ email: string }> {
  const testEmail = `jacob+e2e${Date.now()}@techops.services`;
  const testPassword = "TestPassword123!";

  await page.goto("/", { waitUntil: "domcontentloaded" });

  const signInButton = page.locator('button:has-text("Sign In")').first();
  await expect(signInButton).toBeVisible({ timeout: 15_000 });
  await signInButton.click();

  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible({ timeout: 5000 });

  await dialog.locator('button:has-text("Create account")').click();

  const dialogTitle = dialog.locator("h2");
  await expect(dialogTitle).toHaveText("Create account");

  await dialog.locator("#signup-email").fill(testEmail);
  await dialog.locator("#signup-password").fill(testPassword);
  await dialog
    .locator('button[type="submit"]:has-text("Create account")')
    .click();

  await expect(dialogTitle).toHaveText("Verify your email", {
    timeout: 15_000,
  });

  const otp = await getOtpFromDb(testEmail);

  const otpInput = dialog.locator("#otp");
  await otpInput.fill(otp);
  await dialog.locator('button[type="submit"]:has-text("Verify")').click();

  // Wait for dialog to close (verification + auto sign-in complete)
  await expect(dialog).toBeHidden({ timeout: 15_000 });

  // Wait for org switcher to appear (org auto-created after first sign-in)
  await expect(page.locator('button[role="combobox"]')).toBeVisible({
    timeout: 15_000,
  });

  return { email: testEmail };
}

// Navigate to the invite form inside the Manage Organizations modal
async function openInviteForm(page: Page): Promise<void> {
  const orgSwitcher = page.locator('button[role="combobox"]');
  await orgSwitcher.click();

  await page.locator("text=Manage Organizations").click();

  const dialog = page.locator('[role="dialog"]');
  await expect(
    dialog.locator('h2:has-text("Manage Organizations")')
  ).toBeVisible({ timeout: 5000 });

  await dialog.locator('button:has-text("Manage")').first().click();

  await dialog.locator('button:has-text("Invite Members")').click();

  await expect(dialog.locator("#invite-email")).toBeVisible({ timeout: 5000 });
}

// Run tests serially to avoid session state conflicts
test.describe.configure({ mode: "serial" });

test.describe("Organization Invitations", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test.describe("Sending Invites", () => {
    test("INV-SEND-1: invite new email shows success toast and confirmation", async ({
      page,
    }) => {
      await signUpAndVerify(page);
      await openInviteForm(page);

      const dialog = page.locator('[role="dialog"]');
      const inviteEmail = `newinvitee+${Date.now()}@example.com`;

      await dialog.locator("#invite-email").fill(inviteEmail);
      await dialog.locator('button:has-text("Send Invitation")').click();

      // Verify success toast
      const toast = page.locator("[data-sonner-toast]");
      await expect(
        toast.filter({ hasText: `Invitation sent to ${inviteEmail}` })
      ).toBeVisible({ timeout: 10_000 });

      // Verify confirmation box appears in the form
      await expect(
        dialog.locator("text=Invitation sent").first()
      ).toBeVisible({ timeout: 5000 });
    });

    test("INV-SEND-2: invite existing user shows success toast and confirmation", async ({
      page,
      context,
    }) => {
      // Create an existing user (just needs an account, no verification needed)
      const { email: existingUserEmail } = await signUpOnly(page);

      // Clear session so we can sign up the inviter
      await context.clearCookies();

      // Sign up and verify the inviter
      await signUpAndVerify(page);
      await openInviteForm(page);

      const dialog = page.locator('[role="dialog"]');

      await dialog.locator("#invite-email").fill(existingUserEmail);
      await dialog.locator('button:has-text("Send Invitation")').click();

      // Verify success toast
      const toast = page.locator("[data-sonner-toast]");
      await expect(
        toast.filter({ hasText: `Invitation sent to ${existingUserEmail}` })
      ).toBeVisible({ timeout: 10_000 });

      // Verify confirmation box appears in the form
      await expect(
        dialog.locator("text=Invitation sent").first()
      ).toBeVisible({ timeout: 5000 });
    });

    test("INV-SEND-3: invite email with pending invitation shows error toast", async ({
      page,
    }) => {
      await signUpAndVerify(page);
      await openInviteForm(page);

      const dialog = page.locator('[role="dialog"]');
      const inviteEmail = `duplicate+${Date.now()}@example.com`;

      // First invite should succeed
      await dialog.locator("#invite-email").fill(inviteEmail);
      await dialog.locator('button:has-text("Send Invitation")').click();

      await expect(
        page
          .locator("[data-sonner-toast]")
          .filter({ hasText: `Invitation sent to ${inviteEmail}` })
      ).toBeVisible({ timeout: 10_000 });

      // Type the same email again (input was cleared on success)
      await dialog.locator("#invite-email").fill(inviteEmail);
      await dialog.locator('button:has-text("Send Invitation")').click();

      // Second invite should show error toast
      await expect(
        page
          .locator("[data-sonner-toast]")
          .filter({ hasText: "already invited" })
      ).toBeVisible({ timeout: 10_000 });
    });

    test("INV-SEND-4: invite yourself shows already a member error toast", async ({
      page,
    }) => {
      const { email: ownEmail } = await signUpAndVerify(page);
      await openInviteForm(page);

      const dialog = page.locator('[role="dialog"]');

      await dialog.locator("#invite-email").fill(ownEmail);
      await dialog.locator('button:has-text("Send Invitation")').click();

      await expect(
        page
          .locator("[data-sonner-toast]")
          .filter({ hasText: "already a member" })
      ).toBeVisible({ timeout: 10_000 });
    });
  });
});
