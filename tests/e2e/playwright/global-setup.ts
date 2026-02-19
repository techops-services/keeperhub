import dotenv from "dotenv";
import { expand } from "dotenv-expand";
import { cleanupTestUsers } from "./utils/cleanup";

const DEFAULT_DB_URL =
  "postgresql://postgres:postgres@localhost:5433/keeperhub";

async function globalSetup(): Promise<void> {
  expand(dotenv.config());

  // Ensure DATABASE_URL is available (mirrors playwright.config.ts logic)
  const envDbUrl = process.env.DATABASE_URL;
  if (!envDbUrl || envDbUrl.includes("${")) {
    process.env.DATABASE_URL = DEFAULT_DB_URL;
  }

  // Clean up leftover test data from previous runs
  await cleanupTestUsers();
}

export default globalSetup;
