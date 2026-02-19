import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import { expand } from "dotenv-expand";

// Load and expand .env file for local development
expand(dotenv.config());

// Use BASE_URL env var for deployed environments, otherwise localhost
const baseURL = process.env.BASE_URL || "http://localhost:3000";
const isDeployedEnv = !!process.env.BASE_URL;

// Default DATABASE_URL for local docker-compose setup
const DEFAULT_DB_URL =
  "postgresql://postgres:postgres@localhost:5433/keeperhub";

function getDatabaseUrl(): string {
  const envDbUrl = process.env.DATABASE_URL;
  const hasUnexpandedVars = envDbUrl?.includes("${");
  if (!envDbUrl || hasUnexpandedVars) {
    return DEFAULT_DB_URL;
  }
  return envDbUrl;
}

const databaseUrl = getDatabaseUrl();

// Set DATABASE_URL for tests that need direct DB access (e.g., OTP retrieval)
process.env.DATABASE_URL = databaseUrl;

export default defineConfig({
  globalSetup: "./tests/e2e/playwright/global-setup.ts",
  globalTeardown: "./tests/e2e/playwright/global-teardown.ts",
  testDir: "./tests/e2e/playwright",
  testMatch: "**/*.test.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  timeout: 60_000,
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    navigationTimeout: 60_000,
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/playwright/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],
  // Only start local dev server when not running against deployed environment
  webServer: isDeployedEnv
    ? undefined
    : {
        command: "pnpm dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
