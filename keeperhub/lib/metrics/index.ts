/**
 * Golden Signal Metrics
 *
 * Application-level metrics for KeeperHub workflow execution,
 * user activity, and plugin operations.
 *
 * @example
 * ```typescript
 * import { getMetricsCollector, MetricNames, LabelKeys } from "@/keeperhub/lib/metrics";
 *
 * const metrics = getMetricsCollector();
 *
 * // Record workflow execution duration
 * metrics.recordLatency(
 *   MetricNames.WORKFLOW_EXECUTION_DURATION,
 *   1234,
 *   { [LabelKeys.WORKFLOW_ID]: "wf_123", [LabelKeys.STATUS]: "success" }
 * );
 *
 * // Increment execution counter
 * metrics.incrementCounter(
 *   MetricNames.WORKFLOW_EXECUTIONS_TOTAL,
 *   { [LabelKeys.TRIGGER_TYPE]: "webhook" }
 * );
 * ```
 */

// Re-export types
export type {
  MetricsCollector,
  MetricLabels,
  MetricEvent,
  MetricType,
  ErrorContext,
  TriggerType,
  ExecutionStatus,
} from "./types";

// Re-export constants
export { MetricNames, LabelKeys } from "./types";

// Re-export collectors
export { consoleMetricsCollector, createPrefixedConsoleCollector } from "./collectors/console";
export { noopMetricsCollector } from "./collectors/noop";

import type { MetricsCollector } from "./types";
import { consoleMetricsCollector } from "./collectors/console";
import { noopMetricsCollector } from "./collectors/noop";

/**
 * Detect if running in a server environment
 */
function isServerEnvironment(): boolean {
  return typeof window === "undefined";
}

/**
 * Check if metrics are enabled via environment variable
 */
function isMetricsEnabled(): boolean {
  // Default to enabled in server environment
  const envValue = process.env.METRICS_ENABLED;
  if (envValue === undefined) {
    return isServerEnvironment();
  }
  return envValue === "true" || envValue === "1";
}

/**
 * Singleton metrics collector instance
 */
let metricsCollectorInstance: MetricsCollector | null = null;

/**
 * Get the metrics collector instance
 *
 * Returns:
 * - ConsoleMetricsCollector in server environment (when enabled)
 * - NoopMetricsCollector in browser or when disabled
 *
 * @returns MetricsCollector instance
 */
export function getMetricsCollector(): MetricsCollector {
  if (metricsCollectorInstance) {
    return metricsCollectorInstance;
  }

  if (isServerEnvironment() && isMetricsEnabled()) {
    metricsCollectorInstance = consoleMetricsCollector;
  } else {
    metricsCollectorInstance = noopMetricsCollector;
  }

  return metricsCollectorInstance;
}

/**
 * Set a custom metrics collector (useful for testing or custom implementations)
 *
 * @param collector - Custom MetricsCollector implementation
 */
export function setMetricsCollector(collector: MetricsCollector): void {
  metricsCollectorInstance = collector;
}

/**
 * Reset the metrics collector to default behavior
 * Useful for testing cleanup
 */
export function resetMetricsCollector(): void {
  metricsCollectorInstance = null;
}

/**
 * Utility: Create a timer for measuring operation duration
 *
 * @example
 * ```typescript
 * const timer = createTimer();
 * await someOperation();
 * metrics.recordLatency("operation.duration_ms", timer());
 * ```
 */
export function createTimer(): () => number {
  const start = performance.now();
  return () => Math.round(performance.now() - start);
}

/**
 * Utility: Wrap an async function with latency tracking
 *
 * @example
 * ```typescript
 * const result = await withLatencyTracking(
 *   () => executeWorkflow(id),
 *   MetricNames.WORKFLOW_EXECUTION_DURATION,
 *   { workflow_id: id }
 * );
 * ```
 */
export async function withLatencyTracking<T>(
  fn: () => Promise<T>,
  metricName: string,
  labels?: Record<string, string>
): Promise<T> {
  const metrics = getMetricsCollector();
  const timer = createTimer();

  try {
    const result = await fn();
    metrics.recordLatency(metricName, timer(), { ...labels, status: "success" });
    return result;
  } catch (error) {
    metrics.recordLatency(metricName, timer(), { ...labels, status: "failure" });
    throw error;
  }
}

/**
 * Utility: Wrap an async function with full metrics tracking (latency + errors)
 *
 * @example
 * ```typescript
 * const result = await withMetrics(
 *   () => executeWorkflow(id),
 *   {
 *     latencyMetric: MetricNames.WORKFLOW_EXECUTION_DURATION,
 *     errorMetric: MetricNames.WORKFLOW_EXECUTION_ERRORS,
 *     counterMetric: MetricNames.WORKFLOW_EXECUTIONS_TOTAL,
 *     labels: { workflow_id: id, trigger_type: "webhook" }
 *   }
 * );
 * ```
 */
export async function withMetrics<T>(
  fn: () => Promise<T>,
  options: {
    latencyMetric?: string;
    errorMetric?: string;
    counterMetric?: string;
    labels?: Record<string, string>;
  }
): Promise<T> {
  const metrics = getMetricsCollector();
  const timer = createTimer();
  const { latencyMetric, errorMetric, counterMetric, labels } = options;

  // Increment traffic counter if specified
  if (counterMetric) {
    metrics.incrementCounter(counterMetric, labels);
  }

  try {
    const result = await fn();

    if (latencyMetric) {
      metrics.recordLatency(latencyMetric, timer(), { ...labels, status: "success" });
    }

    return result;
  } catch (error) {
    if (latencyMetric) {
      metrics.recordLatency(latencyMetric, timer(), { ...labels, status: "failure" });
    }

    if (errorMetric && error instanceof Error) {
      metrics.recordError(errorMetric, error, labels);
    }

    throw error;
  }
}
