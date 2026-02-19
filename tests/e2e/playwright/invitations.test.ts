import type { BrowserContext, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

// Build DATABASE_URL from individual vars since dotenv doesn't expand ${} references
const DATABASE_URL = process.env.POSTGRES_HOST
  ? `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`
  : process.env.DATABASE_URL || "postgres://localhost:5432/workflow";

const ACCEPT_INVITE_URL_REGEX = /\/accept-invite/;

// Navigate to accept-invite page with retry.
// Next.js 16 has a hydration race condition that can occasionally redirect
// away from the accept-invite page during initial load when a session is
// active. Waiting for network idle and retrying resolves this reliably.
async function gotoAcceptInvite(
  page: Page,
  invitationId: string
): Promise<void> {
  const url = `/accept-invite/${invitationId}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    await page.goto(url, { waitUntil: "networkidle" });
    // Verify we landed on the accept-invite page AND it's not a 404
    const is404 = await page
      .locator("text=This page could not be found")
      .isVisible()
      .catch(() => false);
    if (page.url().includes("accept-invite") && !is404) {
      return;
    }
    // Brief wait before retry to let any pending state (or Turbopack recompile) settle
    await page.waitForTimeout(1000);
  }
  throw new Error(
    `Failed to navigate to ${url} after 5 attempts (kept redirecting to ${page.url()} or got 404)`
  );
}

// Query the invitation table for the invite ID sent to an email
async function getInvitationIdFromDb(
  email: string,
  maxRetries = 10
): Promise<string> {
  const sql = postgres(DATABASE_URL, { max: 1 });
  try {
    for (let i = 0; i < maxRetries; i++) {
      const result = await sql`
        SELECT id FROM invitation
        WHERE email = ${email} AND status = 'pending'
        ORDER BY expires_at DESC
        LIMIT 1
      `;
      if (result.length > 0) {
        return result[0].id;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(
      `No invitation found for ${email} after ${maxRetries} retries`
    );
  } finally {
    await sql.end();
  }
}

// Query the verifications table for the OTP code sent to an email
async function getOtpFromDb(email: string, maxRetries = 10): Promise<string> {
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
  const testEmail = `test+${Date.now()}@techops.services`;
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
async function signUpAndVerify(
  page: Page,
  opts?: { email?: string }
): Promise<{ email: string }> {
  const testEmail = opts?.email ?? `test+${Date.now()}@techops.services`;
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

  // Invite form is now inline in the org detail view
  await expect(
    dialog.locator('input[placeholder="colleague@example.com"]')
  ).toBeVisible({ timeout: 5000 });
}

// Send an invite from the current user and return the invitation ID
async function sendInvite(page: Page, inviteeEmail: string): Promise<string> {
  await openInviteForm(page);

  const dialog = page.locator('[role="dialog"]');
  await dialog
    .locator('input[placeholder="colleague@example.com"]')
    .fill(inviteeEmail);

  const inviteButton = dialog.locator('button:has-text("Invite")');
  await expect(inviteButton).toBeEnabled({ timeout: 5000 });
  await inviteButton.click();

  // Wait for any toast to appear, then check it's the success toast
  const anyToast = page.locator("[data-sonner-toast]").first();
  await expect(anyToast).toBeVisible({ timeout: 15_000 });

  const successToast = page
    .locator("[data-sonner-toast]")
    .filter({ hasText: `Invitation sent to ${inviteeEmail}` });
  await expect(successToast).toBeVisible({ timeout: 5000 });

  const invitationId = await getInvitationIdFromDb(inviteeEmail);
  return invitationId;
}

// Create inviter, send invite, then sign up invitee who accepts the invite.
// Returns with the invitee logged in and belonging to 2 orgs.
async function setupUserInTwoOrgs(
  page: Page,
  context: BrowserContext
): Promise<{ inviteeEmail: string }> {
  // Inviter signs up first
  await signUpAndVerify(page);

  // Generate invitee email AFTER signUpAndVerify to avoid Date.now() collision
  const inviteeEmail = `test+${Date.now()}@techops.services`;
  const invitationId = await sendInvite(page, inviteeEmail);
  await context.clearCookies();

  // Invitee signs up (gets their own org)
  await signUpAndVerify(page, { email: inviteeEmail });

  // Invitee accepts the invitation (now in 2 orgs)
  await gotoAcceptInvite(page, invitationId);
  await expect(
    page.locator('button:has-text("Accept Invitation")')
  ).toBeVisible({ timeout: 15_000 });
  await page.locator('button:has-text("Accept Invitation")').click();

  // Wait for accept to process: either "Welcome to" toast or redirect away
  const welcomeToast = page
    .locator("[data-sonner-toast]")
    .filter({ hasText: "Welcome to" });
  const notOnAcceptPage = page.waitForURL(
    (url) => !url.pathname.includes("accept-invite"),
    { timeout: 15_000 }
  );
  await Promise.race([
    welcomeToast.waitFor({ state: "visible", timeout: 15_000 }).catch(() => {}),
    notOnAcceptPage.catch(() => {}),
  ]);

  // Navigate to home to ensure org switcher is available regardless of where we ended up
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator('button[role="combobox"]')).toBeVisible({
    timeout: 15_000,
  });

  return { inviteeEmail };
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

      await dialog
        .locator('input[placeholder="colleague@example.com"]')
        .fill(inviteEmail);
      await dialog.locator('button:has-text("Invite")').click();

      // Verify success toast
      const toast = page.locator("[data-sonner-toast]");
      await expect(
        toast.filter({ hasText: `Invitation sent to ${inviteEmail}` })
      ).toBeVisible({ timeout: 10_000 });

      // Verify invited member appears in the members list
      await expect(dialog.locator("text=invited").first()).toBeVisible({
        timeout: 5000,
      });
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

      await dialog
        .locator('input[placeholder="colleague@example.com"]')
        .fill(existingUserEmail);
      await dialog.locator('button:has-text("Invite")').click();

      // Verify success toast
      const toast = page.locator("[data-sonner-toast]");
      await expect(
        toast.filter({ hasText: `Invitation sent to ${existingUserEmail}` })
      ).toBeVisible({ timeout: 10_000 });

      // Verify invited member appears in the members list
      await expect(dialog.locator("text=invited").first()).toBeVisible({
        timeout: 5000,
      });
    });

    test("INV-SEND-3: invite email with pending invitation shows error toast", async ({
      page,
    }) => {
      await signUpAndVerify(page);
      await openInviteForm(page);

      const dialog = page.locator('[role="dialog"]');
      const inviteEmail = `duplicate+${Date.now()}@example.com`;

      // First invite should succeed
      await dialog
        .locator('input[placeholder="colleague@example.com"]')
        .fill(inviteEmail);
      await dialog.locator('button:has-text("Invite")').click();

      await expect(
        page
          .locator("[data-sonner-toast]")
          .filter({ hasText: `Invitation sent to ${inviteEmail}` })
      ).toBeVisible({ timeout: 10_000 });

      // Type the same email again (input was cleared on success)
      await dialog
        .locator('input[placeholder="colleague@example.com"]')
        .fill(inviteEmail);
      await dialog.locator('button:has-text("Invite")').click();

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

      await dialog
        .locator('input[placeholder="colleague@example.com"]')
        .fill(ownEmail);
      await dialog.locator('button:has-text("Invite")').click();

      await expect(
        page
          .locator("[data-sonner-toast]")
          .filter({ hasText: "already a member" })
      ).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe("Receiving Invites", () => {
    test("INV-RECV-1: accept invite as logged-out new user via signup and OTP", async ({
      page,
      context,
    }) => {
      // Set up: inviter creates an invite for a new email
      await signUpAndVerify(page);

      const inviteeEmail = `test+${Date.now()}@techops.services`;
      const invitationId = await sendInvite(page, inviteeEmail);

      // Log out so we visit the accept page as a new user
      await context.clearCookies();

      // Navigate to the accept invite page
      await gotoAcceptInvite(page, invitationId);

      // Should show auth form in signup mode
      await expect(page.locator("h1:has-text('Join')")).toBeVisible({
        timeout: 15_000,
      });
      await expect(
        page.locator('button:has-text("Create Account & Join")')
      ).toBeVisible();

      // Fill password and submit
      await page.locator("#password").fill("TestPassword123!");
      await page.locator('button:has-text("Create Account & Join")').click();

      // Should show account creation toast
      await expect(
        page
          .locator("[data-sonner-toast]")
          .filter({ hasText: "Account created" })
      ).toBeVisible({ timeout: 10_000 });

      // Should transition to verification form
      await expect(
        page.locator("h1:has-text('Verify Your Email')")
      ).toBeVisible({ timeout: 10_000 });

      // Get OTP from DB for the invitee and verify
      const otp = await getOtpFromDb(inviteeEmail);
      await page.locator("#otp").fill(otp);
      await page.locator('button:has-text("Verify & Join")').click();

      // Should show welcome toast and/or navigate away from accept-invite.
      // The handleSuccess chain (getSession → toast → router.push) can race
      // in CI, so accept either the toast or the URL change as proof of success.
      const welcomeToast = page
        .locator("[data-sonner-toast]")
        .filter({ hasText: "Welcome to" });
      const navigatedAway = page.waitForURL(
        (url) => !ACCEPT_INVITE_URL_REGEX.test(url.pathname),
        { timeout: 20_000 }
      );

      await Promise.race([
        welcomeToast.waitFor({ state: "visible", timeout: 20_000 }),
        navigatedAway,
      ]);

      // Verify we're no longer on the accept-invite page
      await expect(page).not.toHaveURL(ACCEPT_INVITE_URL_REGEX, {
        timeout: 15_000,
      });
    });

    test("INV-RECV-2: accept invite as logged-out existing user via sign in", async ({
      page,
      context,
    }) => {
      // Create the invitee first (verified, existing user)
      const inviteeEmail = `test+${Date.now()}@techops.services`;
      await signUpAndVerify(page, { email: inviteeEmail });
      await context.clearCookies();

      // Create inviter and send invite to the existing user
      await signUpAndVerify(page);
      const invitationId = await sendInvite(page, inviteeEmail);
      await context.clearCookies();

      // Visit accept-invite page as logged-out existing user
      await gotoAcceptInvite(page, invitationId);

      // Should show auth form in signin mode (userExists = true)
      await expect(page.locator("h1:has-text('Join')")).toBeVisible({
        timeout: 15_000,
      });
      await expect(
        page.locator('button:has-text("Sign In & Join")')
      ).toBeVisible();

      // Sign in with the existing user's password
      await page.locator("#password").fill("TestPassword123!");
      await page.locator('button:has-text("Sign In & Join")').click();

      // Should show welcome toast and/or navigate away from accept-invite.
      // The handleSuccess chain can race in CI, so accept either signal.
      const welcomeToast2 = page
        .locator("[data-sonner-toast]")
        .filter({ hasText: "Welcome to" });
      const navigatedAway2 = page.waitForURL(
        (url) => !ACCEPT_INVITE_URL_REGEX.test(url.pathname),
        { timeout: 20_000 }
      );

      await Promise.race([
        welcomeToast2.waitFor({ state: "visible", timeout: 20_000 }),
        navigatedAway2,
      ]);

      await expect(page).not.toHaveURL(ACCEPT_INVITE_URL_REGEX, {
        timeout: 15_000,
      });
    });

    test("INV-RECV-3: accept invite while logged in as the correct user", async ({
      page,
      context,
    }) => {
      // Create inviter and send invite
      await signUpAndVerify(page);
      const inviteeEmail = `test+${Date.now()}@techops.services`;
      const invitationId = await sendInvite(page, inviteeEmail);
      await context.clearCookies();

      // Create invitee with the matching email (now logged in)
      await signUpAndVerify(page, { email: inviteeEmail });

      // Navigate to accept-invite page while logged in as correct user
      await gotoAcceptInvite(page, invitationId);

      // Should show AcceptDirectState
      await expect(page.locator("h1:has-text('Join')")).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.locator("text=You're signed in as")).toBeVisible();
      await expect(
        page.locator('button:has-text("Accept Invitation")')
      ).toBeVisible();

      // Accept the invitation
      await page.locator('button:has-text("Accept Invitation")').click();

      // Should show welcome toast and/or navigate away from accept-invite.
      // The handleSuccess chain can race in CI, so accept either signal.
      const welcomeToast3 = page
        .locator("[data-sonner-toast]")
        .filter({ hasText: "Welcome to" });
      const navigatedAway3 = page.waitForURL(
        (url) => !ACCEPT_INVITE_URL_REGEX.test(url.pathname),
        { timeout: 20_000 }
      );

      await Promise.race([
        welcomeToast3.waitFor({ state: "visible", timeout: 20_000 }),
        navigatedAway3,
      ]);

      await expect(page).not.toHaveURL(ACCEPT_INVITE_URL_REGEX, {
        timeout: 15_000,
      });
    });

    test("INV-RECV-4: accept invite while logged in as a different user shows mismatch", async ({
      page,
      context,
    }) => {
      // Create inviter and send invite to a specific email
      await signUpAndVerify(page);
      const inviteeEmail = `test+${Date.now()}@techops.services`;
      const invitationId = await sendInvite(page, inviteeEmail);
      await context.clearCookies();

      // Log in as a DIFFERENT user
      await signUpAndVerify(page);

      // Navigate to accept-invite page while logged in as wrong user
      await gotoAcceptInvite(page, invitationId);

      // Should show EmailMismatchState
      await expect(page.locator("h1:has-text('Wrong Account')")).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.locator("text=This invitation is for")).toBeVisible();
      await expect(
        page.locator("text=You're currently signed in as")
      ).toBeVisible();

      // Click "Sign Out & Continue" to sign out and reload
      await page.locator('button:has-text("Sign Out & Continue")').click();

      // Page should reload as logged-out, showing auth form
      await expect(page.locator("h1:has-text('Join')")).toBeVisible({
        timeout: 15_000,
      });
    });
  });

  test.describe("Organization Membership", () => {
    test("ORG-1: user can switch between multiple orgs", async ({
      page,
      context,
    }) => {
      await setupUserInTwoOrgs(page, context);

      // Open org switcher
      const orgSwitcher = page.locator('button[role="combobox"]');
      const currentOrgName = await orgSwitcher.innerText();
      await orgSwitcher.click();

      // Popover should list both orgs
      const popover = page.locator('[role="listbox"]');
      await expect(popover).toBeVisible({ timeout: 5000 });
      const orgItems = popover.locator('[role="option"]');
      await expect(orgItems).toHaveCount(3); // 2 orgs + "Manage Organizations"

      // Active org should have a visible checkmark (opacity-100)
      const activeItem = orgItems.filter({ hasText: currentOrgName.trim() });
      await expect(activeItem.locator("svg.opacity-100")).toBeVisible();

      // Click the other org (not the current one, not Manage)
      const otherOrg = orgItems
        .filter({ hasNotText: currentOrgName.trim() })
        .filter({ hasNotText: "Manage Organizations" })
        .first();
      const otherOrgName = await otherOrg.innerText();
      await otherOrg.click();

      // Org switcher should now show the other org's name
      await expect(orgSwitcher).toContainText(otherOrgName.trim(), {
        timeout: 10_000,
      });
    });

    test("ORG-2: accepting invite to second org shows new org in switcher", async ({
      page,
      context,
    }) => {
      // Create inviter and send invite
      await signUpAndVerify(page);
      const inviteeEmail = `test+${Date.now()}@techops.services`;
      const invitationId = await sendInvite(page, inviteeEmail);
      await context.clearCookies();

      // Create invitee with their own org
      await signUpAndVerify(page, { email: inviteeEmail });

      // Accept invite via accept-invite page
      await gotoAcceptInvite(page, invitationId);
      await expect(
        page.locator('button:has-text("Accept Invitation")')
      ).toBeVisible({ timeout: 15_000 });
      await page.locator('button:has-text("Accept Invitation")').click();

      // Wait for accept to process: either toast or redirect away from accept page
      const welcomeToast = page
        .locator("[data-sonner-toast]")
        .filter({ hasText: "Welcome to" });
      const notOnAcceptPage = page.waitForURL(
        (url) => !url.pathname.includes("accept-invite"),
        { timeout: 15_000 }
      );
      await Promise.race([
        welcomeToast
          .waitFor({ state: "visible", timeout: 15_000 })
          .catch(() => {}),
        notOnAcceptPage.catch(() => {}),
      ]);

      // Go home and open org switcher
      await page.goto("/", { waitUntil: "domcontentloaded" });
      const orgSwitcher = page.locator('button[role="combobox"]');
      await expect(orgSwitcher).toBeVisible({ timeout: 15_000 });
      await orgSwitcher.click();

      // Should list 2 orgs + Manage Organizations
      const popover = page.locator('[role="listbox"]');
      await expect(popover).toBeVisible({ timeout: 5000 });
      const orgItems = popover.locator('[role="option"]');
      await expect(orgItems).toHaveCount(3);
    });

    test("ORG-3: user can leave an org", async ({ page, context }) => {
      await setupUserInTwoOrgs(page, context);

      // Open manage orgs modal
      const orgSwitcher = page.locator('button[role="combobox"]');
      await orgSwitcher.click();
      await page.locator("text=Manage Organizations").click();

      const dialog = page.locator('[role="dialog"]');
      await expect(
        dialog.locator('h2:has-text("Manage Organizations")')
      ).toBeVisible({ timeout: 5000 });

      // Click "Manage" on the org where the user is a member (not owner)
      // so that "Leave Organization" is available instead of "Delete Organization"
      const orgCards = dialog.locator(
        ".flex.items-center.justify-between.rounded-lg.border.p-3"
      );
      const memberOrg = orgCards
        .filter({ has: page.locator("p.capitalize", { hasText: "Member" }) })
        .first();
      const orgNameToLeave = await memberOrg
        .locator(".font-medium.text-sm")
        .first()
        .innerText();
      await memberOrg.locator('button:has-text("Manage")').click();

      // Click "Leave Organization"
      await dialog.locator('button:has-text("Leave Organization")').click();

      // Confirmation dialog should appear
      const alertDialog = page.locator('[role="alertdialog"]');
      await expect(alertDialog).toBeVisible({ timeout: 5000 });
      await expect(
        alertDialog.locator("text=Are you sure you want to leave")
      ).toBeVisible();

      // Confirm leaving
      await alertDialog
        .locator('button:has-text("Leave Organization")')
        .click();

      // Toast confirms leaving
      await expect(
        page
          .locator("[data-sonner-toast]")
          .filter({ hasText: `Left ${orgNameToLeave}` })
      ).toBeVisible({ timeout: 10_000 });
    });

    // biome-ignore lint/suspicious/noSkippedTests: Remove member UI (members-list.tsx) is not wired into any page yet
    // biome-ignore lint/suspicious/noEmptyBlockStatements: placeholder for unimplemented UI
    test.skip("ORG-4: admin can remove a member from org", () => {});
  });
});
