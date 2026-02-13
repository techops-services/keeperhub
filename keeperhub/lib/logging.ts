/**
 * Unified Logging + Metrics Helpers
 *
 * This module provides helper functions that automatically log AND emit Prometheus metrics
 * in a single call. This ensures consistency and prevents metrics from being forgotten.
 *
 * Usage:
 * - Use logUserError() for errors caused by user actions (validation, config, etc.)
 * - Use logSystemError() for errors caused by system failures (database, auth, etc.)
 * - Use convenience functions for common categories (logValidationError, logDatabaseError, etc.)
 *
 * Every error/warning automatically:
 * - Logs to console (warn for user errors, error for system errors)
 * - Emits a Prometheus metric with proper categorization
 * - Extracts context from message prefix (e.g., "[Discord]" → "Discord")
 * - Includes standard labels (error_category, error_context, is_user_error)
 */

import {
  getMetricsCollector,
  LabelKeys,
  MetricNames,
} from "@/keeperhub/lib/metrics";

/**
 * Error/warning categories for metrics classification
 */
export const ErrorCategory = {
  // User-caused errors
  VALIDATION: "validation",
  CONFIGURATION: "configuration",
  EXTERNAL_SERVICE: "external_service",
  NETWORK_RPC: "network_rpc",
  TRANSACTION: "transaction",

  // System-caused errors
  DATABASE: "database",
  AUTH: "auth",
  INFRASTRUCTURE: "infrastructure",
  WORKFLOW_ENGINE: "workflow_engine",
  UNKNOWN: "unknown",
} as const;

export type ErrorCategory = (typeof ErrorCategory)[keyof typeof ErrorCategory];

/**
 * Regex pattern for extracting context from message prefix (e.g., "[Discord]" → "Discord")
 */
const CONTEXT_PREFIX_REGEX = /^\[([^\]]+)\]/;

/**
 * Get metric name for error category
 */
function getMetricName(category: ErrorCategory): string {
  switch (category) {
    case ErrorCategory.VALIDATION:
      return MetricNames.USER_VALIDATION_ERRORS;
    case ErrorCategory.CONFIGURATION:
      return MetricNames.USER_CONFIGURATION_ERRORS;
    case ErrorCategory.EXTERNAL_SERVICE:
      return MetricNames.EXTERNAL_SERVICE_ERRORS;
    case ErrorCategory.NETWORK_RPC:
      return MetricNames.NETWORK_RPC_ERRORS;
    case ErrorCategory.TRANSACTION:
      return MetricNames.TRANSACTION_BLOCKCHAIN_ERRORS;
    case ErrorCategory.DATABASE:
      return MetricNames.SYSTEM_DATABASE_ERRORS;
    case ErrorCategory.AUTH:
      return MetricNames.SYSTEM_AUTH_ERRORS;
    case ErrorCategory.INFRASTRUCTURE:
      return MetricNames.SYSTEM_INFRASTRUCTURE_ERRORS;
    case ErrorCategory.WORKFLOW_ENGINE:
      return MetricNames.SYSTEM_WORKFLOW_ENGINE_ERRORS;
    default:
      return MetricNames.API_ERRORS_TOTAL;
  }
}

/**
 * Extract context prefix from message (e.g., "[Discord]" → "Discord")
 */
function extractContext(message: string): string {
  const match = message.match(CONTEXT_PREFIX_REGEX);
  return match ? match[1] : "Unknown";
}

/**
 * Log a user error/warning with automatic metrics
 *
 * User errors are logged as warnings (they don't wake up DevOps) and
 * automatically emit a Prometheus metric for tracking.
 *
 * @param category - Error category (validation, configuration, etc.)
 * @param message - Error message with [Context] prefix
 * @param error - Optional error details (object, Error instance, or string)
 * @param labels - Optional additional metric labels
 *
 * @example
 * logUserError(ErrorCategory.VALIDATION, "[Check Balance] Invalid address:", address, {
 *   plugin_name: "web3",
 *   action_name: "check-balance"
 * });
 */
export function logUserError(
  category: ErrorCategory,
  message: string,
  error?: unknown,
  labels?: Record<string, string>
): void {
  const metrics = getMetricsCollector();
  const context = extractContext(message);

  // Log as warning (user errors don't wake up DevOps)
  console.warn(message, error ?? "");

  // Emit metric
  metrics.recordError(
    getMetricName(category),
    error instanceof Error ? error : { message },
    {
      ...labels,
      [LabelKeys.ERROR_CATEGORY]: category,
      [LabelKeys.ERROR_CONTEXT]: context,
      [LabelKeys.IS_USER_ERROR]: "true",
    }
  );
}

/**
 * Log a system error with automatic metrics
 *
 * System errors are logged as errors (critical failures) and
 * automatically emit a Prometheus metric for tracking.
 *
 * @param category - Error category (database, auth, infrastructure, etc.)
 * @param message - Error message with [Context] prefix
 * @param error - Error object or details (required for system errors)
 * @param labels - Optional additional metric labels
 *
 * @example
 * logSystemError(ErrorCategory.DATABASE, "[API] Failed to insert workflow:", error, {
 *   endpoint: "/api/workflows",
 *   status_code: "500"
 * });
 */
export function logSystemError(
  category: ErrorCategory,
  message: string,
  error: unknown,
  labels?: Record<string, string>
): void {
  const metrics = getMetricsCollector();
  const context = extractContext(message);

  // Log as error (system failures are critical)
  console.error(message, error);

  // Emit metric
  metrics.recordError(
    getMetricName(category),
    error instanceof Error ? error : { message: String(error) },
    {
      ...labels,
      [LabelKeys.ERROR_CATEGORY]: category,
      [LabelKeys.ERROR_CONTEXT]: context,
      [LabelKeys.IS_USER_ERROR]: "false",
    }
  );
}

/**
 * Convenience function: log validation error
 *
 * Use for: invalid addresses, malformed inputs, schema validation failures
 *
 * @example
 * logValidationError("[Check Balance] Invalid address:", address, {
 *   plugin_name: "web3",
 *   action_name: "check-balance"
 * });
 */
export function logValidationError(
  message: string,
  details?: unknown,
  labels?: Record<string, string>
): void {
  logUserError(ErrorCategory.VALIDATION, message, details, labels);
}

/**
 * Convenience function: log configuration error
 *
 * Use for: missing API keys, invalid settings, configuration mismatches
 *
 * @example
 * logConfigurationError("[Discord] Missing bot token in integration config", undefined, {
 *   integration_id: "abc123"
 * });
 */
export function logConfigurationError(
  message: string,
  details?: unknown,
  labels?: Record<string, string>
): void {
  logUserError(ErrorCategory.CONFIGURATION, message, details, labels);
}

/**
 * Convenience function: log external service error
 *
 * Use for: Etherscan API failures, Discord API errors, SendGrid failures
 *
 * @example
 * logExternalServiceError("[Etherscan] API request failed:", error, {
 *   service: "etherscan",
 *   endpoint: "/api/v1/contract"
 * });
 */
export function logExternalServiceError(
  message: string,
  error?: unknown,
  labels?: Record<string, string>
): void {
  logUserError(ErrorCategory.EXTERNAL_SERVICE, message, error, labels);
}

/**
 * Convenience function: log RPC/network error
 *
 * Use for: RPC connection failures, network timeouts, chain not available
 *
 * @example
 * logNetworkError("[RPC] Failed to connect to Ethereum node:", error, {
 *   chain_id: "1",
 *   rpc_url: "https://eth.llamarpc.com"
 * });
 */
export function logNetworkError(
  message: string,
  error?: unknown,
  labels?: Record<string, string>
): void {
  logUserError(ErrorCategory.NETWORK_RPC, message, error, labels);
}

/**
 * Convenience function: log transaction error
 *
 * Use for: transaction failures, gas estimation errors, nonce issues
 *
 * @example
 * logTransactionError("[Transaction] Failed to send transaction:", error, {
 *   chain_id: "1",
 *   tx_hash: "0x..."
 * });
 */
export function logTransactionError(
  message: string,
  error?: unknown,
  labels?: Record<string, string>
): void {
  logUserError(ErrorCategory.TRANSACTION, message, error, labels);
}

/**
 * Convenience function: log database error
 *
 * Use for: query failures, connection errors, constraint violations
 *
 * @example
 * logDatabaseError("[DB] Failed to insert workflow:", error, {
 *   table: "workflows",
 *   operation: "insert"
 * });
 */
export function logDatabaseError(
  message: string,
  error: unknown,
  labels?: Record<string, string>
): void {
  logSystemError(ErrorCategory.DATABASE, message, error, labels);
}

/**
 * Convenience function: log auth error
 *
 * Use for: session failures, token validation errors, permission denied
 *
 * @example
 * logAuthError("[Auth] Failed to verify session:", error, {
 *   endpoint: "/api/workflows"
 * });
 */
export function logAuthError(
  message: string,
  error: unknown,
  labels?: Record<string, string>
): void {
  logSystemError(ErrorCategory.AUTH, message, error, labels);
}

/**
 * Convenience function: log infrastructure error
 *
 * Use for: deployment failures, environment issues, resource exhaustion
 *
 * @example
 * logInfrastructureError("[Infrastructure] Failed to initialize metrics collector:", error, {
 *   component: "metrics"
 * });
 */
export function logInfrastructureError(
  message: string,
  error: unknown,
  labels?: Record<string, string>
): void {
  logSystemError(ErrorCategory.INFRASTRUCTURE, message, error, labels);
}

/**
 * Convenience function: log workflow engine error
 *
 * Use for: workflow execution failures, step resolution errors, workflow runtime issues
 *
 * @example
 * logWorkflowEngineError("[Workflow] Failed to execute step:", error, {
 *   workflow_id: "abc123",
 *   step_id: "xyz789"
 * });
 */
export function logWorkflowEngineError(
  message: string,
  error: unknown,
  labels?: Record<string, string>
): void {
  logSystemError(ErrorCategory.WORKFLOW_ENGINE, message, error, labels);
}
