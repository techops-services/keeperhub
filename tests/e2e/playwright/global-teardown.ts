import dotenv from "dotenv";
import { expand } from "dotenv-expand";
import { cleanupTestUsers } from "./utils/cleanup";

const DEFAULT_DB_URL =
  "postgresql://postgres:postgres@localhost:5433/keeperhub";

async function globalTeardown(): Promise<void> {
  expand(dotenv.config());

  const envDbUrl = process.env.DATABASE_URL;
  if (!envDbUrl || envDbUrl.includes("${")) {
    process.env.DATABASE_URL = DEFAULT_DB_URL;
  }

  await cleanupTestUsers();
}

export default globalTeardown;
