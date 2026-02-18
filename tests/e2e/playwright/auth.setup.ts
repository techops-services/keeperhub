import { test as setup } from "@playwright/test";
import { signIn } from "./utils/auth";
import {
  PERSISTENT_TEST_PASSWORD,
  PERSISTENT_TEST_USER_EMAIL,
} from "./utils/db";

const authFile = "tests/e2e/playwright/.auth/user.json";

setup("authenticate as persistent test user", async ({ page }) => {
  await signIn(page, PERSISTENT_TEST_USER_EMAIL, PERSISTENT_TEST_PASSWORD);

  await page.context().storageState({ path: authFile });
});
