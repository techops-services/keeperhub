/**
 * ESM Bootstrap script for workflow-runner
 *
 * This ESM script registers a hook to return empty module for 'server-only'
 * before loading the main workflow-runner script.
 *
 * Usage: node --import ./scripts/workflow-runner-bootstrap.mjs scripts/workflow-runner.ts
 *
 * Or with tsx:
 *   NODE_OPTIONS="--import ./scripts/workflow-runner-bootstrap.mjs" npx tsx scripts/workflow-runner.ts
 */

import { register } from "node:module";
import { pathToFileURL } from "node:url";

// Register a custom loader to handle 'server-only' imports
register("./server-only-loader.mjs", pathToFileURL("./"));
