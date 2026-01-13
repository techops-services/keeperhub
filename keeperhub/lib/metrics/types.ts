/**
 * Golden Signal Metrics Types
 *
 * Application-level metrics for workflow execution, user activity, and plugin operations.
 * Follows the four golden signals: Latency, Traffic, Errors, Saturation.
 */

/**
 * Metric types supported by the collector
 */
export type MetricType = "counter" | "histogram" | "gauge";

/**
 * Labels for metric dimensions - keep minimal to avoid cardinality explosion
 */
export type MetricLabels = Record<string, string | number | boolean>;

/**
 * Structured metric event for logging
 */
export type MetricEvent = {
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  metric: {
    name: string;
    type: MetricType;
    value: number;
    labels?: MetricLabels;
  };
};

/**
 * Error context for error metrics
 */
export type ErrorContext = {
  code?: string;
  message: string;
  stack?: string;
  cause?: string;
};

/**
 * Core metrics collector interface
 *
 * Allows dependency injection for different environments:
 * - Console collector for server-side (CloudWatch/Datadog compatible)
 * - Noop collector for frontend/testing
 */
export type MetricsCollector = {
  /**
   * Record a latency/duration measurement (histogram)
   * @param name - Metric name (e.g., "workflow.execution.duration_ms")
   * @param durationMs - Duration in milliseconds
   * @param labels - Optional labels for dimensions
   */
  recordLatency(
    name: string,
    durationMs: number,
    labels?: MetricLabels
  ): void;

  /**
   * Increment a counter metric
   * @param name - Metric name (e.g., "workflow.executions.total")
   * @param labels - Optional labels for dimensions
   * @param value - Increment value (default: 1)
   */
  incrementCounter(
    name: string,
    labels?: MetricLabels,
    value?: number
  ): void;

  /**
   * Record an error with context
   * @param name - Metric name (e.g., "workflow.execution.errors")
   * @param error - Error object or context
   * @param labels - Optional labels for dimensions
   */
  recordError(
    name: string,
    error: Error | ErrorContext,
    labels?: MetricLabels
  ): void;

  /**
   * Set a gauge metric (point-in-time value)
   * @param name - Metric name (e.g., "workflow.concurrent.count")
   * @param value - Current value
   * @param labels - Optional labels for dimensions
   */
  setGauge(name: string, value: number, labels?: MetricLabels): void;
};

/**
 * Predefined metric names for consistency
 */
export const MetricNames = {
  // Latency metrics
  WORKFLOW_EXECUTION_DURATION: "workflow.execution.duration_ms",
  WORKFLOW_STEP_DURATION: "workflow.step.duration_ms",
  API_WEBHOOK_LATENCY: "api.webhook.latency_ms",
  API_STATUS_LATENCY: "api.status.latency_ms",
  PLUGIN_ACTION_DURATION: "plugin.action.duration_ms",
  AI_GENERATION_DURATION: "ai.generation.duration_ms",

  // Traffic metrics
  WORKFLOW_EXECUTIONS_TOTAL: "workflow.executions.total",
  API_REQUESTS_TOTAL: "api.requests.total",
  PLUGIN_INVOCATIONS_TOTAL: "plugin.invocations.total",
  USER_ACTIVE_DAILY: "user.active.daily",
  AI_TOKENS_CONSUMED: "ai.tokens.consumed",

  // Error metrics
  WORKFLOW_EXECUTION_ERRORS: "workflow.execution.errors",
  WORKFLOW_STEP_ERRORS: "workflow.step.errors",
  PLUGIN_ACTION_ERRORS: "plugin.action.errors",
  API_ERRORS_TOTAL: "api.errors.total",
  EXTERNAL_SERVICE_ERRORS: "external.service.errors",

  // Saturation metrics
  DB_POOL_UTILIZATION: "db.pool.utilization",
  DB_QUERY_SLOW_COUNT: "db.query.slow_count",
  WORKFLOW_QUEUE_DEPTH: "workflow.queue.depth",
  WORKFLOW_CONCURRENT_COUNT: "workflow.concurrent.count",
} as const;

/**
 * Common label keys for consistency
 */
export const LabelKeys = {
  WORKFLOW_ID: "workflow_id",
  EXECUTION_ID: "execution_id",
  STEP_TYPE: "step_type",
  PLUGIN_NAME: "plugin_name",
  ACTION_NAME: "action_name",
  TRIGGER_TYPE: "trigger_type",
  STATUS: "status",
  STATUS_CODE: "status_code",
  ERROR_TYPE: "error_type",
  ENDPOINT: "endpoint",
  SERVICE: "service",
} as const;

/**
 * Trigger types for workflow executions
 */
export type TriggerType = "manual" | "webhook" | "scheduled";

/**
 * Execution status values
 */
export type ExecutionStatus = "success" | "failure" | "timeout" | "cancelled";
