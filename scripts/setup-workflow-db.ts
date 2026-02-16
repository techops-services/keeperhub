/**
 * Sets up the workflow database schemas:
 * 1. workflow schema (via workflow-postgres-setup from @workflow/world-postgres)
 * 2. pgboss schema (via pg-boss start/stop)
 *
 * Run: pnpm db:setup-workflow
 */

import "dotenv/config";
import { execSync } from "node:child_process";
import PgBoss from "pg-boss";

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL environment variable is required");
  }
  return url;
}

async function main(): Promise<void> {
  const databaseUrl = getDatabaseUrl();

  // Step 1: Run workflow-postgres-setup (creates workflow schema + tables)
  console.log("[1/2] Running workflow-postgres-setup...");
  try {
    execSync("pnpm exec workflow-postgres-setup", {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: databaseUrl },
    });
  } catch {
    console.error("workflow-postgres-setup failed");
    process.exit(1);
  }

  // Step 2: Initialize pg-boss schema
  console.log("[2/2] Initializing pg-boss schema...");
  const boss = new PgBoss(databaseUrl);
  try {
    await boss.start();
    console.log("pgboss schema created");
    await boss.stop({ graceful: false });
    console.log("pgboss stopped");
  } catch (err) {
    console.error(
      "pg-boss initialization failed:",
      err instanceof Error ? err.message : err
    );
    process.exit(1);
  }

  console.log("All workflow schemas ready.");
}

main();
