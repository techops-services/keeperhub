"use strict";
/**
 * Bootstrap script for workflow-runner
 *
 * This CommonJS script patches the 'server-only' module before loading
 * the main workflow-runner script. This allows the runner to work outside
 * of Next.js (in K8s Jobs or local testing).
 *
 * Usage: node scripts/workflow-runner-bootstrap.cjs
 */

const path = require("node:path");
const { spawn } = require("node:child_process");

// Create a shim for server-only in node_modules to avoid the error
const fs = require("node:fs");
const serverOnlyPaths = [
  path.join(__dirname, "..", "node_modules", "server-only", "index.js"),
  path.join(
    __dirname,
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
const tsx = path.join(__dirname, "..", "node_modules", ".bin", "tsx");
const runner = path.join(__dirname, "workflow-runner.ts");

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
  cwd: path.join(__dirname, ".."),
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
  // Use 'close' instead of 'exit' to ensure stdio is flushed
  process.exit(signal ? 1 : (code ?? 0));
});

child.on("error", (err) => {
  console.error("Failed to start workflow runner:", err);
  restoreServerOnly();
  process.exit(1);
});
