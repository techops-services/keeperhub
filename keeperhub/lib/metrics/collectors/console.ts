/**
 * Console Metrics Collector
 *
 * Outputs structured JSON logs compatible with CloudWatch/Datadog.
 * Use for server-side metric collection.
 */

import type {
  MetricsCollector,
  MetricLabels,
  MetricEvent,
  ErrorContext,
} from "../types";

/**
 * Normalize labels to ensure all values are JSON-serializable
 */
function normalizeLabels(
  labels?: MetricLabels
): Record<string, string> | undefined {
  if (!labels) return undefined;

  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(labels)) {
    normalized[key] = String(value);
  }
  return normalized;
}

/**
 * Extract error context from Error object or ErrorContext
 */
function extractErrorContext(error: Error | ErrorContext): ErrorContext {
  if (error instanceof Error) {
    const errorWithExtras = error as Error & { code?: string; cause?: unknown };
    return {
      code: errorWithExtras.code,
      message: error.message,
      stack: error.stack,
      cause: errorWithExtras.cause ? String(errorWithExtras.cause) : undefined,
    };
  }
  return error;
}

/**
 * Create a structured metric event
 */
function createMetricEvent(
  name: string,
  type: MetricEvent["metric"]["type"],
  value: number,
  labels?: MetricLabels,
  level: MetricEvent["level"] = "info"
): MetricEvent {
  return {
    timestamp: new Date().toISOString(),
    level,
    metric: {
      name,
      type,
      value,
      labels: normalizeLabels(labels),
    },
  };
}

/**
 * Console-based metrics collector that outputs structured JSON
 *
 * Output format is compatible with CloudWatch Logs Insights and Datadog:
 * ```json
 * {
 *   "timestamp": "2024-01-13T10:30:00.000Z",
 *   "level": "info",
 *   "metric": {
 *     "name": "workflow.execution.duration_ms",
 *     "type": "histogram",
 *     "value": 1234,
 *     "labels": { "workflow_id": "wf_123", "status": "success" }
 *   }
 * }
 * ```
 */
export const consoleMetricsCollector: MetricsCollector = {
  recordLatency(
    name: string,
    durationMs: number,
    labels?: MetricLabels
  ): void {
    const event = createMetricEvent(name, "histogram", durationMs, labels);
    console.info(JSON.stringify(event));
  },

  incrementCounter(
    name: string,
    labels?: MetricLabels,
    value: number = 1
  ): void {
    const event = createMetricEvent(name, "counter", value, labels);
    console.info(JSON.stringify(event));
  },

  recordError(
    name: string,
    error: Error | ErrorContext,
    labels?: MetricLabels
  ): void {
    const errorContext = extractErrorContext(error);
    const enrichedLabels: MetricLabels = {
      ...labels,
      error_message: errorContext.message,
      ...(errorContext.code && { error_code: errorContext.code }),
    };

    const event = createMetricEvent(name, "counter", 1, enrichedLabels, "error");

    // Include full error context in a separate field for debugging
    const eventWithError = {
      ...event,
      error: errorContext,
    };

    console.error(JSON.stringify(eventWithError));
  },

  setGauge(name: string, value: number, labels?: MetricLabels): void {
    const event = createMetricEvent(name, "gauge", value, labels);
    console.info(JSON.stringify(event));
  },
};

/**
 * Create a console collector with a custom prefix for namespacing
 */
export function createPrefixedConsoleCollector(
  prefix: string
): MetricsCollector {
  return {
    recordLatency(name, durationMs, labels) {
      consoleMetricsCollector.recordLatency(`${prefix}.${name}`, durationMs, labels);
    },
    incrementCounter(name, labels, value) {
      consoleMetricsCollector.incrementCounter(`${prefix}.${name}`, labels, value);
    },
    recordError(name, error, labels) {
      consoleMetricsCollector.recordError(`${prefix}.${name}`, error, labels);
    },
    setGauge(name, value, labels) {
      consoleMetricsCollector.setGauge(`${prefix}.${name}`, value, labels);
    },
  };
}
