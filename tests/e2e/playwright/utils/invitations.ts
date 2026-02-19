import type { BrowserContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import postgres from "postgres";
import { signUpAndVerify } from "./auth";

function getDbConnection(): ReturnType<typeof postgres> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }
  return postgres(databaseUrl, { max: 1 });
}

/**
 * Navigate to accept-invite page with retry.
 * Next.js 16 has a hydration race condition that can occasionally redirect
 * away from the accept-invite page during initial load when a session is
 * active. Waiting for network idle and retrying resolves this reliably.
 */
export async function gotoAcceptInvite(
  page: Page,
  invitationId: string
): Promise<void> {
  const url = `/accept-invite/${invitationId}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    await page.goto(url, { waitUntil: "networkidle" });
    const is404 = await page
      .locator("text=This page could not be found")
      .isVisible()
      .catch(() => false);
    if (page.url().includes("accept-invite") && !is404) {
      return;
    }
    await page.waitForTimeout(1000);
  }
  throw new Error(
    `Failed to navigate to ${url} after 5 attempts (kept redirecting to ${page.url()} or got 404)`
  );
}

/**
 * Query the invitation table for the invite ID sent to an email.
 * Polls with retries since the invitation may not be committed yet.
 */
export async function getInvitationIdFromDb(
  email: string,
  maxRetries = 10
): Promise<string> {
  const sql = getDbConnection();
  try {
    for (let i = 0; i < maxRetries; i++) {
      const result = await sql`
        SELECT id FROM invitation
        WHERE email = ${email} AND status = 'pending'
        ORDER BY expires_at DESC
        LIMIT 1
      `;
      if (result.length > 0) {
        return result[0].id as string;
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

/**
 * Navigate to the invite form inside the Manage Organizations modal.
 * Waits for org switcher visibility before interacting.
 */
export async function openInviteForm(page: Page): Promise<void> {
  const orgSwitcher = page.locator('button[role="combobox"]');
  await expect(orgSwitcher).toBeVisible({ timeout: 15_000 });
  await orgSwitcher.click();

  await page.locator("text=Manage Organizations").click();

  const dialog = page.locator('[role="dialog"]');
  await expect(
    dialog.locator('h2:has-text("Manage Organizations")')
  ).toBeVisible({ timeout: 5000 });

  await dialog.locator('button:has-text("Manage")').first().click();

  await expect(
    dialog.locator('input[placeholder="colleague@example.com"]')
  ).toBeVisible({ timeout: 5000 });
}

/**
 * Send an invite from the current user and return the invitation ID.
 * Opens the invite form, fills the email, submits, and verifies success.
 */
export async function sendInvite(
  page: Page,
  inviteeEmail: string
): Promise<string> {
  await openInviteForm(page);

  const dialog = page.locator('[role="dialog"]');
  await dialog
    .locator('input[placeholder="colleague@example.com"]')
    .fill(inviteeEmail);

  const inviteButton = dialog.locator('button:has-text("Invite")');
  await expect(inviteButton).toBeEnabled({ timeout: 5000 });
  await inviteButton.click();

  const anyToast = page.locator("[data-sonner-toast]").first();
  await expect(anyToast).toBeVisible({ timeout: 15_000 });

  const successToast = page
    .locator("[data-sonner-toast]")
    .filter({ hasText: `Invitation sent to ${inviteeEmail}` });
  await expect(successToast).toBeVisible({ timeout: 5000 });

  return getInvitationIdFromDb(inviteeEmail);
}

/**
 * Create inviter, send invite, then sign up invitee who accepts the invite.
 * Returns with the invitee logged in and belonging to 2 orgs.
 */
export async function setupUserInTwoOrgs(
  page: Page,
  context: BrowserContext
): Promise<{ inviteeEmail: string }> {
  await signUpAndVerify(page);

  const inviteeEmail = `test+${Date.now()}@techops.services`;
  const invitationId = await sendInvite(page, inviteeEmail);
  await context.clearCookies();

  await signUpAndVerify(page, { email: inviteeEmail });

  await gotoAcceptInvite(page, invitationId);
  await expect(
    page.locator('button:has-text("Accept Invitation")')
  ).toBeVisible({ timeout: 15_000 });
  await page.locator('button:has-text("Accept Invitation")').click();

  const welcomeToast = page
    .locator("[data-sonner-toast]")
    .filter({ hasText: "Welcome to" });
  const notOnAcceptPage = page.waitForURL(
    (url) => !url.pathname.includes("accept-invite"),
    { timeout: 15_000 }
  );
  await Promise.race([
    welcomeToast.waitFor({ state: "visible", timeout: 15_000 }).catch(() => {
      /* intentional noop */
    }),
    notOnAcceptPage.catch(() => {
      /* intentional noop */
    }),
  ]);

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator('button[role="combobox"]')).toBeVisible({
    timeout: 15_000,
  });

  return { inviteeEmail };
}
