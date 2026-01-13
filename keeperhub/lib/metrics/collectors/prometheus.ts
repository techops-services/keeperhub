/**
 * Prometheus Metrics Collector
 *
 * Exports metrics in Prometheus format for scraping.
 * Uses prom-client library for metric types and registry.
 */

import "server-only";

import {
  Registry,
  Counter,
  Histogram,
  Gauge,
  collectDefaultMetrics,
} from "prom-client";
import type { MetricsCollector, MetricLabels, ErrorContext } from "../types";

// Create a dedicated registry for application metrics
const registry = new Registry();

// Collect default Node.js metrics (memory, CPU, event loop, etc.)
collectDefaultMetrics({ register: registry, prefix: "keeperhub_" });

// Pre-defined label names for each metric
const WORKFLOW_LABELS = ["workflow_id", "execution_id", "trigger_type", "status"];
const STEP_LABELS = ["execution_id", "step_type", "status"];
const API_LABELS = ["endpoint", "status_code", "status"];
const PLUGIN_LABELS = ["plugin_name", "action_name", "execution_id", "status"];
const ERROR_LABELS = ["error_type", "plugin_name", "action_name", "service"];
const DB_LABELS = ["query_type", "threshold"];
const POOL_LABELS = ["active", "max"];

// Latency histograms
const workflowDuration = new Histogram({
  name: "keeperhub_workflow_execution_duration_ms",
  help: "Workflow execution duration in milliseconds",
  labelNames: WORKFLOW_LABELS,
  buckets: [100, 250, 500, 1000, 2000, 5000, 10000, 30000],
  registers: [registry],
});

const stepDuration = new Histogram({
  name: "keeperhub_workflow_step_duration_ms",
  help: "Workflow step execution duration in milliseconds",
  labelNames: STEP_LABELS,
  buckets: [50, 100, 250, 500, 1000, 2000, 5000],
  registers: [registry],
});

const webhookLatency = new Histogram({
  name: "keeperhub_api_webhook_latency_ms",
  help: "Webhook trigger response time in milliseconds",
  labelNames: API_LABELS,
  buckets: [10, 25, 50, 100, 250, 500],
  registers: [registry],
});

const statusLatency = new Histogram({
  name: "keeperhub_api_status_latency_ms",
  help: "Status polling response time in milliseconds",
  labelNames: ["execution_id", "status"],
  buckets: [5, 10, 25, 50, 100],
  registers: [registry],
});

const pluginDuration = new Histogram({
  name: "keeperhub_plugin_action_duration_ms",
  help: "Plugin action execution duration in milliseconds",
  labelNames: PLUGIN_LABELS,
  buckets: [50, 100, 250, 500, 1000, 2000, 5000],
  registers: [registry],
});

const aiDuration = new Histogram({
  name: "keeperhub_ai_generation_duration_ms",
  help: "AI workflow generation duration in milliseconds",
  labelNames: ["status"],
  buckets: [500, 1000, 2000, 5000, 10000, 20000],
  registers: [registry],
});

const externalServiceLatency = new Histogram({
  name: "keeperhub_external_service_latency_ms",
  help: "External service call latency in milliseconds",
  labelNames: ["service", "status", "status_code"],
  buckets: [50, 100, 250, 500, 1000, 2000, 5000],
  registers: [registry],
});

// Traffic counters
const workflowExecutions = new Counter({
  name: "keeperhub_workflow_executions_total",
  help: "Total workflow executions",
  labelNames: ["trigger_type", "workflow_id"],
  registers: [registry],
});

const apiRequests = new Counter({
  name: "keeperhub_api_requests_total",
  help: "Total API requests",
  labelNames: ["endpoint", "status_code"],
  registers: [registry],
});

const pluginInvocations = new Counter({
  name: "keeperhub_plugin_invocations_total",
  help: "Total plugin invocations",
  labelNames: ["plugin_name", "action_name"],
  registers: [registry],
});

const aiTokensConsumed = new Counter({
  name: "keeperhub_ai_tokens_consumed_total",
  help: "Total AI tokens consumed",
  labelNames: [],
  registers: [registry],
});

// Error counters
const workflowErrors = new Counter({
  name: "keeperhub_workflow_execution_errors_total",
  help: "Failed workflow executions",
  labelNames: ["workflow_id", "trigger_type", "error_type"],
  registers: [registry],
});

const stepErrors = new Counter({
  name: "keeperhub_workflow_step_errors_total",
  help: "Failed step executions",
  labelNames: ["step_type", "error_type"],
  registers: [registry],
});

const pluginErrors = new Counter({
  name: "keeperhub_plugin_action_errors_total",
  help: "Failed plugin actions",
  labelNames: ["plugin_name", "action_name", "error_type"],
  registers: [registry],
});

const apiErrors = new Counter({
  name: "keeperhub_api_errors_total",
  help: "API errors by status code",
  labelNames: ["endpoint", "status_code", "error_type"],
  registers: [registry],
});

const externalServiceErrors = new Counter({
  name: "keeperhub_external_service_errors_total",
  help: "External service failures",
  labelNames: ["service", "plugin_name"],
  registers: [registry],
});

const slowQueries = new Counter({
  name: "keeperhub_db_query_slow_total",
  help: "Slow database queries (>100ms)",
  labelNames: DB_LABELS,
  registers: [registry],
});

// Saturation gauges
const dbPoolUtilization = new Gauge({
  name: "keeperhub_db_pool_utilization_percent",
  help: "Database connection pool utilization percentage",
  labelNames: POOL_LABELS,
  registers: [registry],
});

const workflowQueueDepth = new Gauge({
  name: "keeperhub_workflow_queue_depth",
  help: "Pending workflow jobs in queue",
  labelNames: [],
  registers: [registry],
});

const workflowConcurrent = new Gauge({
  name: "keeperhub_workflow_concurrent_count",
  help: "Current concurrent workflow executions",
  labelNames: [],
  registers: [registry],
});

const activeUsers = new Gauge({
  name: "keeperhub_user_active_daily",
  help: "Daily active users",
  labelNames: [],
  registers: [registry],
});

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
  if (!labels) return {};

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
      const errorLabels = sanitizeLabels(labels);
      // Add error type from error object if available
      if ("code" in error && error.code) {
        errorLabels.error_type = error.code;
      } else if (error instanceof Error) {
        errorLabels.error_type = error.name || "Error";
      }
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
  return registry.metrics();
}

/**
 * Get content type for Prometheus metrics
 */
export function getPrometheusContentType(): string {
  return registry.contentType;
}
