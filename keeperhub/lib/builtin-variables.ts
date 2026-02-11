/**
 * Built-in System Variables
 * Provides runtime-evaluated variables available in all workflow template fields.
 * These are injected as a pseudo-node with a reserved ID into the outputs map.
 */
import type { OutputField } from "@/plugins/registry";

/** Reserved node ID for built-in system variables. Must not collide with user node IDs. */
export const BUILTIN_NODE_ID = "__system";

/** Display label shown in autocomplete UI and template syntax */
export const BUILTIN_NODE_LABEL = "System";

/**
 * Returns current built-in variable values.
 * MUST be called at evaluation time (not cached) so timestamps are fresh.
 */
export function getBuiltinVariables(): Record<string, unknown> {
  const now = Date.now();
  return {
    unixTimestamp: Math.floor(now / 1000),
    unixTimestampMs: now,
    isoTimestamp: new Date(now).toISOString(),
  };
}

/**
 * Returns static field definitions for autocomplete and MCP schema documentation.
 */
export function getBuiltinVariableDefinitions(): OutputField[] {
  return [
    {
      field: "unixTimestamp",
      description:
        "Current time as Unix timestamp in seconds (Solidity-compatible)",
    },
    {
      field: "unixTimestampMs",
      description: "Current time as Unix timestamp in milliseconds",
    },
    {
      field: "isoTimestamp",
      description: "Current time as ISO 8601 UTC string",
    },
  ];
}
