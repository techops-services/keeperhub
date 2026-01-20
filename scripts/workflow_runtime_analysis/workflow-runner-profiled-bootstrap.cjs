"use strict";
/**
 * Bootstrap script for workflow-runner-profiled
 *
 * This CommonJS script patches the 'server-only' module before loading
 * the profiled workflow-runner script. This allows the runner to work outside
 * of Next.js (in local testing/profiling).
 *
 * Usage: node scripts/workflow_runtime_analysis/workflow-runner-profiled-bootstrap.cjs
 *
 * Required env vars (set in .env or pass directly):
 *   WORKFLOW_ID - ID of the workflow to execute
 *   EXECUTION_ID - ID of the execution record
 *   DATABASE_URL - PostgreSQL connection string
 */

const path = require("node:path");
const { spawn } = require("node:child_process");
const fs = require("node:fs");

// Load .env file if it exists
const projectRoot = path.join(__dirname, "..", "..");
const envPath = path.join(projectRoot, ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex > 0) {
        const key = trimmed.slice(0, eqIndex);
        let value = trimmed.slice(eqIndex + 1);
        // Remove surrounding quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        // Only set if not already in environment (allow overrides)
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

// Create a shim for server-only in node_modules to avoid the error
const serverOnlyPaths = [
  path.join(__dirname, "..", "..", "node_modules", "server-only", "index.js"),
  path.join(
    __dirname,
    "..",
    "..",
    "node_modules",
    ".pnpm",
    "server-only@0.0.1",
    "node_modules",
    "server-only",
    "index.js"
  ),
];

// Backup and replace server-only
const backups = [];
for (const serverOnlyPath of serverOnlyPaths) {
  if (fs.existsSync(serverOnlyPath)) {
    const backup = `${serverOnlyPath}.backup`;
    if (!fs.existsSync(backup)) {
      fs.copyFileSync(serverOnlyPath, backup);
    }
    fs.writeFileSync(serverOnlyPath, "module.exports = {};");
    backups.push({ path: serverOnlyPath, backup });
  }
}

// Run the actual script using tsx
const tsx = path.join(__dirname, "..", "..", "node_modules", ".bin", "tsx");
const runner = path.join(__dirname, "workflow-runner-profiled.ts");

function restoreServerOnly() {
  for (const { path: p, backup } of backups) {
    if (fs.existsSync(backup)) {
      try {
        fs.copyFileSync(backup, p);
        fs.unlinkSync(backup);
      } catch (_e) {
        // Ignore cleanup errors
      }
    }
  }
}

const child = spawn(tsx, [runner], {
  stdio: ["ignore", "pipe", "pipe"],
  env: process.env,
  cwd: path.join(__dirname, "..", ".."),
});

// Forward child output to parent without keeping event loop alive
child.stdout.on("data", (data) => process.stdout.write(data));
child.stderr.on("data", (data) => process.stderr.write(data));

// Forward signals to child
process.on("SIGTERM", () => {
  child.kill("SIGTERM");
});

process.on("SIGINT", () => {
  child.kill("SIGINT");
});

child.on("close", (code, signal) => {
  restoreServerOnly();
  process.exit(signal ? 1 : (code ?? 0));
});

child.on("error", (err) => {
  console.error("Failed to start profiled workflow runner:", err);
  restoreServerOnly();
  process.exit(1);
});
