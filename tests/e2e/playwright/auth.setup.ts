import { expect, test as setup } from "@playwright/test";
import { signIn } from "./utils/auth";
import {
  PERSISTENT_TEST_PASSWORD,
  PERSISTENT_TEST_USER_EMAIL,
} from "./utils/db";

const authFile = "tests/e2e/playwright/.auth/user.json";

setup("authenticate as persistent test user", async ({ page }) => {
  await signIn(page, PERSISTENT_TEST_USER_EMAIL, PERSISTENT_TEST_PASSWORD);

  // After sign-in, the server-side session hook auto-sets the active org.
  // The client needs to re-fetch the session to pick up the active org.
  // Wait briefly for the hook to complete, then reload.
  await page.waitForTimeout(2000);
  await page.goto("/", { waitUntil: "networkidle" });

  // Wait for org switcher (confirms org context is loaded in session)
  const orgSwitcher = page.locator('button[role="combobox"]');
  await expect(orgSwitcher).toBeVisible({ timeout: 15_000 });

  await page.context().storageState({ path: authFile });
});
