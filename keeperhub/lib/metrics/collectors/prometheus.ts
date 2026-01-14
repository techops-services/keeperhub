/**
 * Prometheus Metrics Collector
 *
 * Exports metrics in Prometheus format for scraping.
 * Uses prom-client library for metric types and registry.
 */

import "server-only";

import {
  Counter,
  collectDefaultMetrics,
  Gauge,
  Histogram,
  Registry,
} from "prom-client";
import type { ErrorContext, MetricLabels, MetricsCollector } from "../types";

// Use global singleton to prevent duplicate registration during hot reload
// This is safe because each pod has its own Node.js process
const globalForProm = globalThis as unknown as {
  prometheusRegistry: Registry | undefined;
};

// Create a dedicated registry for application metrics (singleton)
const registry = globalForProm.prometheusRegistry ?? new Registry();
globalForProm.prometheusRegistry = registry;

// Collect default Node.js metrics (memory, CPU, event loop, etc.)
// Only register if not already registered (handles hot reload)
if (!registry.getSingleMetric("keeperhub_process_cpu_seconds_total")) {
  collectDefaultMetrics({ register: registry, prefix: "keeperhub_" });
}

// Pre-defined label names for each metric
const WORKFLOW_LABELS = [
  "workflow_id",
  "execution_id",
  "trigger_type",
  "status",
];
const STEP_LABELS = ["execution_id", "step_type", "status"];
const API_LABELS = ["endpoint", "status_code", "status"];
const WEBHOOK_LABELS = ["workflow_id", "status_code", "status", "execution_id"];
const PLUGIN_LABELS = ["plugin_name", "action_name", "execution_id", "status"];
const _ERROR_LABELS = ["error_type", "plugin_name", "action_name", "service"];
const DB_LABELS = ["query_type", "threshold"];
const POOL_LABELS = ["active", "max"];

/**
 * Helper to get or create a metric (handles hot reload gracefully)
 */
function getOrCreateHistogram(
  name: string,
  help: string,
  labelNames: string[],
  buckets: number[]
): Histogram {
  const existing = registry.getSingleMetric(name);
  if (existing) {
    return existing as Histogram;
  }
  return new Histogram({
    name,
    help,
    labelNames,
    buckets,
    registers: [registry],
  });
}

function getOrCreateCounter(
  name: string,
  help: string,
  labelNames: string[]
): Counter {
  const existing = registry.getSingleMetric(name);
  if (existing) {
    return existing as Counter;
  }
  return new Counter({ name, help, labelNames, registers: [registry] });
}

function getOrCreateGauge(
  name: string,
  help: string,
  labelNames: string[]
): Gauge {
  const existing = registry.getSingleMetric(name);
  if (existing) {
    return existing as Gauge;
  }
  return new Gauge({ name, help, labelNames, registers: [registry] });
}

// Latency histograms
const workflowDuration = getOrCreateHistogram(
  "keeperhub_workflow_execution_duration_ms",
  "Workflow execution duration in milliseconds",
  WORKFLOW_LABELS,
  [100, 250, 500, 1000, 2000, 5000, 10_000, 30_000]
);

const stepDuration = getOrCreateHistogram(
  "keeperhub_workflow_step_duration_ms",
  "Workflow step execution duration in milliseconds",
  STEP_LABELS,
  [50, 100, 250, 500, 1000, 2000, 5000]
);

const webhookLatency = getOrCreateHistogram(
  "keeperhub_api_webhook_latency_ms",
  "Webhook trigger response time in milliseconds",
  WEBHOOK_LABELS,
  [10, 25, 50, 100, 250, 500]
);

const statusLatency = getOrCreateHistogram(
  "keeperhub_api_status_latency_ms",
  "Status polling response time in milliseconds",
  ["execution_id", "status_code", "status", "execution_status"],
  [5, 10, 25, 50, 100]
);

const pluginDuration = getOrCreateHistogram(
  "keeperhub_plugin_action_duration_ms",
  "Plugin action execution duration in milliseconds",
  PLUGIN_LABELS,
  [50, 100, 250, 500, 1000, 2000, 5000]
);

const aiDuration = getOrCreateHistogram(
  "keeperhub_ai_generation_duration_ms",
  "AI workflow generation duration in milliseconds",
  ["status"],
  [500, 1000, 2000, 5000, 10_000, 20_000]
);

const externalServiceLatency = getOrCreateHistogram(
  "keeperhub_external_service_latency_ms",
  "External service call latency in milliseconds",
  ["service", "status", "status_code"],
  [50, 100, 250, 500, 1000, 2000, 5000]
);

// Traffic counters
const workflowExecutions = getOrCreateCounter(
  "keeperhub_workflow_executions_total",
  "Total workflow executions",
  ["trigger_type", "workflow_id"]
);

const apiRequests = getOrCreateCounter(
  "keeperhub_api_requests_total",
  "Total API requests",
  ["endpoint", "status_code"]
);

const pluginInvocations = getOrCreateCounter(
  "keeperhub_plugin_invocations_total",
  "Total plugin invocations",
  ["plugin_name", "action_name"]
);

const aiTokensConsumed = getOrCreateCounter(
  "keeperhub_ai_tokens_consumed_total",
  "Total AI tokens consumed",
  []
);

// Error counters
const workflowErrors = getOrCreateCounter(
  "keeperhub_workflow_execution_errors_total",
  "Failed workflow executions",
  ["workflow_id", "trigger_type", "error_type"]
);

const stepErrors = getOrCreateCounter(
  "keeperhub_workflow_step_errors_total",
  "Failed step executions",
  ["step_type", "error_type"]
);

const pluginErrors = getOrCreateCounter(
  "keeperhub_plugin_action_errors_total",
  "Failed plugin actions",
  ["plugin_name", "action_name", "error_type"]
);

const apiErrors = getOrCreateCounter(
  "keeperhub_api_errors_total",
  "API errors by status code",
  ["endpoint", "status_code", "error_type"]
);

const externalServiceErrors = getOrCreateCounter(
  "keeperhub_external_service_errors_total",
  "External service failures",
  ["service", "plugin_name"]
);

const slowQueries = getOrCreateCounter(
  "keeperhub_db_query_slow_total",
  "Slow database queries (>100ms)",
  DB_LABELS
);

// Saturation gauges
const dbPoolUtilization = getOrCreateGauge(
  "keeperhub_db_pool_utilization_percent",
  "Database connection pool utilization percentage",
  POOL_LABELS
);

const workflowQueueDepth = getOrCreateGauge(
  "keeperhub_workflow_queue_depth",
  "Pending workflow jobs in queue",
  []
);

const workflowConcurrent = getOrCreateGauge(
  "keeperhub_workflow_concurrent_count",
  "Current concurrent workflow executions",
  []
);

const activeUsers = getOrCreateGauge(
  "keeperhub_user_active_daily",
  "Daily active users",
  []
);

// Allowed labels per error metric (must match counter definitions)
const errorLabelAllowlist: Record<string, string[]> = {
  "workflow.execution.errors": ["workflow_id", "trigger_type", "error_type"],
  "workflow.step.errors": ["step_type", "error_type"],
  "plugin.action.errors": ["plugin_name", "action_name", "error_type"],
  "api.errors.total": ["endpoint", "status_code", "error_type"],
  "external.service.errors": ["service", "plugin_name"],
};

/**
 * Filter labels to only include allowed ones for a specific metric
 */
function filterLabelsForMetric(
  metricName: string,
  labels: Record<string, string>
): Record<string, string> {
  const allowed = errorLabelAllowlist[metricName];
  if (!allowed) {
    return labels;
  }

  const filtered: Record<string, string> = {};
  for (const key of allowed) {
    if (key in labels) {
      filtered[key] = labels[key];
    }
  }
  return filtered;
}

// Metric name to histogram/counter/gauge mapping
const histogramMap: Record<string, Histogram> = {
  "workflow.execution.duration_ms": workflowDuration,
  "workflow.step.duration_ms": stepDuration,
  "api.webhook.latency_ms": webhookLatency,
  "api.status.latency_ms": statusLatency,
  "plugin.action.duration_ms": pluginDuration,
  "ai.generation.duration_ms": aiDuration,
  "external.service.latency_ms": externalServiceLatency,
};

const counterMap: Record<string, Counter> = {
  "workflow.executions.total": workflowExecutions,
  "api.requests.total": apiRequests,
  "plugin.invocations.total": pluginInvocations,
  "ai.tokens.consumed": aiTokensConsumed,
  "db.query.slow_count": slowQueries,
};

const errorCounterMap: Record<string, Counter> = {
  "workflow.execution.errors": workflowErrors,
  "workflow.step.errors": stepErrors,
  "plugin.action.errors": pluginErrors,
  "api.errors.total": apiErrors,
  "external.service.errors": externalServiceErrors,
};

const gaugeMap: Record<string, Gauge> = {
  "db.pool.utilization": dbPoolUtilization,
  "workflow.queue.depth": workflowQueueDepth,
  "workflow.concurrent.count": workflowConcurrent,
  "user.active.daily": activeUsers,
};

/**
 * Convert labels to Prometheus-compatible format
 * Prometheus labels must be strings and use snake_case
 */
function sanitizeLabels(labels?: MetricLabels): Record<string, string> {
  if (!labels) {
    return {};
  }

  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(labels)) {
    // Convert to snake_case if needed
    const snakeKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
    sanitized[snakeKey] = String(value);
  }
  return sanitized;
}

/**
 * Prometheus Metrics Collector
 */
export const prometheusMetricsCollector: MetricsCollector = {
  recordLatency(name: string, durationMs: number, labels?: MetricLabels): void {
    const histogram = histogramMap[name];
    if (histogram) {
      histogram.observe(sanitizeLabels(labels), durationMs);
    } else {
      console.warn(`[Prometheus] Unknown latency metric: ${name}`);
    }
  },

  incrementCounter(name: string, labels?: MetricLabels, value = 1): void {
    const counter = counterMap[name];
    if (counter) {
      counter.inc(sanitizeLabels(labels), value);
    } else {
      console.warn(`[Prometheus] Unknown counter metric: ${name}`);
    }
  },

  recordError(
    name: string,
    error: Error | ErrorContext,
    labels?: MetricLabels
  ): void {
    const counter = errorCounterMap[name];
    if (counter) {
      const sanitized = sanitizeLabels(labels);
      // Add error type from error object if available
      if ("code" in error && error.code) {
        sanitized.error_type = error.code;
      } else if (error instanceof Error) {
        sanitized.error_type = error.name || "Error";
      } else {
        // Default error type for plain objects without code
        sanitized.error_type = "UnknownError";
      }
      // Filter to only include labels defined for this counter
      const errorLabels = filterLabelsForMetric(name, sanitized);
      counter.inc(errorLabels);
    } else {
      console.warn(`[Prometheus] Unknown error metric: ${name}`);
    }
  },

  setGauge(name: string, value: number, labels?: MetricLabels): void {
    const gauge = gaugeMap[name];
    if (gauge) {
      gauge.set(sanitizeLabels(labels), value);
    } else {
      console.warn(`[Prometheus] Unknown gauge metric: ${name}`);
    }
  },
};

/**
 * Get Prometheus registry for metrics endpoint
 */
export function getPrometheusRegistry(): Registry {
  return registry;
}

/**
 * Get metrics in Prometheus format
 */
export async function getPrometheusMetrics(): Promise<string> {
  return await registry.metrics();
}

/**
 * Get content type for Prometheus metrics
 */
export function getPrometheusContentType(): string {
  return registry.contentType;
}
