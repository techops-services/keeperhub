/**
 * Prometheus Metrics Collector
 *
 * Exports metrics in Prometheus format for scraping.
 * Uses prom-client library for metric types and registry.
 */

import "server-only";

import { Counter, Gauge, Histogram, Registry } from "prom-client";
import type { ErrorContext, MetricLabels, MetricsCollector } from "../types";

// Use global singleton to prevent duplicate registration during hot reload
// This is safe because each pod has its own Node.js process
const globalForProm = globalThis as unknown as {
  prometheusRegistry: Registry | undefined;
};

// Create a dedicated registry for application metrics (singleton)
const registry = globalForProm.prometheusRegistry ?? new Registry();
globalForProm.prometheusRegistry = registry;

// Pre-defined label names for each metric
const _WORKFLOW_LABELS = [
  "workflow_id",
  "execution_id",
  "trigger_type",
  "status",
];
const _STEP_LABELS = ["execution_id", "step_type", "status"];
const _API_LABELS = ["endpoint", "status_code", "status"];
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

// start custom keeperhub code //
// DB-sourced workflow metrics (populated from database on each scrape)
// Workflow runner jobs exit before Prometheus can scrape - data must come from DB.
//
// All metrics are GAUGES (point-in-time snapshots). Use max() aggregation across pods.
// For rate/delta queries, use PromQL delta() function: max(delta(metric[1h]))

// Workflow execution counts by status
const workflowExecutionsTotal = getOrCreateGauge(
  "keeperhub_workflow_executions_total",
  "Total workflow executions by status (all-time)",
  ["status"]
);

// Workflow errors total (convenience gauge for alerting)
const workflowErrorsTotal = getOrCreateGauge(
  "keeperhub_workflow_execution_errors_total",
  "Total failed workflow executions (all-time)",
  []
);

// Workflow duration histogram as gauges (replaces histogram)
const workflowDurationBucket = getOrCreateGauge(
  "keeperhub_workflow_execution_duration_ms_bucket",
  "Workflow execution duration histogram buckets",
  ["le"]
);

const workflowDurationSum = getOrCreateGauge(
  "keeperhub_workflow_execution_duration_ms_sum",
  "Sum of workflow execution durations",
  []
);

const workflowDurationCount = getOrCreateGauge(
  "keeperhub_workflow_execution_duration_ms_count",
  "Count of workflow executions with duration",
  []
);

// Step execution counts by status (populated from DB)
const stepExecutionsTotal = getOrCreateGauge(
  "keeperhub_workflow_step_executions_total",
  "Total workflow step executions",
  ["step_type", "status"]
);

// Step errors (derived from step executions with status=error)
const stepErrorsTotal = getOrCreateGauge(
  "keeperhub_workflow_step_errors_total",
  "Failed step executions",
  ["step_type"]
);

// Step duration histogram as gauges
const stepDurationBucket = getOrCreateGauge(
  "keeperhub_workflow_step_duration_ms_bucket",
  "Workflow step duration histogram buckets",
  ["le"]
);

const stepDurationSum = getOrCreateGauge(
  "keeperhub_workflow_step_duration_ms_sum",
  "Sum of workflow step durations",
  []
);

const stepDurationCount = getOrCreateGauge(
  "keeperhub_workflow_step_duration_ms_count",
  "Count of workflow steps with duration",
  []
);
// end keeperhub code //

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

// Traffic counters
const pluginInvocations = getOrCreateCounter(
  "keeperhub_plugin_invocations_total",
  "Total plugin invocations",
  ["plugin_name", "action_name"]
);

// Error counters
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

// User metrics (DB-sourced)
const userTotal = getOrCreateGauge(
  "keeperhub_user_total",
  "Total registered users",
  []
);

const userVerified = getOrCreateGauge(
  "keeperhub_user_verified_total",
  "Users with verified email",
  []
);

const userAnonymous = getOrCreateGauge(
  "keeperhub_user_anonymous_total",
  "Anonymous users",
  []
);

const userWithWorkflows = getOrCreateGauge(
  "keeperhub_user_with_workflows_total",
  "Users who have created at least one workflow",
  []
);

const userWithIntegrations = getOrCreateGauge(
  "keeperhub_user_with_integrations_total",
  "Users who have configured at least one integration",
  []
);

// Organization metrics (DB-sourced)
const orgTotal = getOrCreateGauge(
  "keeperhub_org_total",
  "Total organizations",
  []
);

const orgMembersTotal = getOrCreateGauge(
  "keeperhub_org_members_total",
  "Total organization members across all orgs",
  []
);

const orgMembersByRole = getOrCreateGauge(
  "keeperhub_org_members_by_role",
  "Organization members by role",
  ["role"]
);

const orgInvitationsPending = getOrCreateGauge(
  "keeperhub_org_invitations_pending",
  "Pending organization invitations",
  []
);

const orgWithWorkflows = getOrCreateGauge(
  "keeperhub_org_with_workflows_total",
  "Organizations with at least one workflow",
  []
);

// Workflow definition metrics (DB-sourced)
const workflowTotal = getOrCreateGauge(
  "keeperhub_workflow_total",
  "Total workflow definitions",
  []
);

const workflowByVisibility = getOrCreateGauge(
  "keeperhub_workflow_by_visibility",
  "Workflows by visibility",
  ["visibility"]
);

const workflowAnonymous = getOrCreateGauge(
  "keeperhub_workflow_anonymous_total",
  "Anonymous workflows",
  []
);

// Schedule metrics (DB-sourced)
const scheduleTotal = getOrCreateGauge(
  "keeperhub_schedule_total",
  "Total workflow schedules",
  []
);

const scheduleEnabled = getOrCreateGauge(
  "keeperhub_schedule_enabled_total",
  "Enabled workflow schedules",
  []
);

const scheduleByLastStatus = getOrCreateGauge(
  "keeperhub_schedule_by_last_status",
  "Schedules by last run status",
  ["status"]
);

// Integration metrics (DB-sourced)
const integrationTotal = getOrCreateGauge(
  "keeperhub_integration_total",
  "Total integrations",
  []
);

const integrationManaged = getOrCreateGauge(
  "keeperhub_integration_managed_total",
  "OAuth-managed integrations",
  []
);

const integrationByType = getOrCreateGauge(
  "keeperhub_integration_by_type",
  "Integrations by type",
  ["type"]
);

// Infrastructure metrics (DB-sourced)
const apiKeyTotal = getOrCreateGauge(
  "keeperhub_apikey_total",
  "Total API keys",
  []
);

const chainTotal = getOrCreateGauge(
  "keeperhub_chain_total",
  "Total blockchain networks configured",
  []
);

const chainEnabled = getOrCreateGauge(
  "keeperhub_chain_enabled_total",
  "Enabled blockchain networks",
  []
);

const paraWalletTotal = getOrCreateGauge(
  "keeperhub_para_wallet_total",
  "Total Para wallets",
  []
);

const sessionActive = getOrCreateGauge(
  "keeperhub_session_active_total",
  "Active (non-expired) sessions",
  []
);

// Allowed labels per error metric (must match counter definitions)
const errorLabelAllowlist: Record<string, string[]> = {
  "workflow.execution.errors": ["workflow_id", "trigger_type", "error_type"],
  "workflow.step.errors": ["step_type", "error_type"],
  "plugin.action.errors": ["plugin_name", "action_name", "error_type"],
  "api.errors.total": ["endpoint", "status_code", "error_type"],
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
// Note: Workflow execution/step metrics are now DB-sourced gauges, not histograms/counters

// Metrics that are DB-sourced and should be silently ignored when called via runtime instrumentation
// These are populated from database queries in updateDbMetrics(), not from runtime calls
const dbSourcedMetrics = new Set([
  "workflow.execution.duration_ms",
  "workflow.step.duration_ms",
  "workflow.executions.total",
  "workflow.execution.errors",
  "workflow.step.errors",
  "workflow.queue.depth",
  "workflow.concurrent.count",
]);

const histogramMap: Record<string, Histogram> = {
  "api.webhook.latency_ms": webhookLatency,
  "api.status.latency_ms": statusLatency,
  "plugin.action.duration_ms": pluginDuration,
  "ai.generation.duration_ms": aiDuration,
};

const counterMap: Record<string, Counter> = {
  "plugin.invocations.total": pluginInvocations,
  "db.query.slow_count": slowQueries,
};

const errorCounterMap: Record<string, Counter> = {
  "plugin.action.errors": pluginErrors,
  "api.errors.total": apiErrors,
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
    // Silently skip DB-sourced metrics (populated via updateDbMetrics)
    if (dbSourcedMetrics.has(name)) {
      return;
    }
    const histogram = histogramMap[name];
    if (histogram) {
      histogram.observe(sanitizeLabels(labels), durationMs);
    } else {
      console.warn(`[Prometheus] Unknown latency metric: ${name}`);
    }
  },

  incrementCounter(name: string, labels?: MetricLabels, value = 1): void {
    // Silently skip DB-sourced metrics (populated via updateDbMetrics)
    if (dbSourcedMetrics.has(name)) {
      return;
    }
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
    // Silently skip DB-sourced metrics (populated via updateDbMetrics)
    if (dbSourcedMetrics.has(name)) {
      return;
    }
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
    // Silently skip DB-sourced metrics (populated via updateDbMetrics)
    if (dbSourcedMetrics.has(name)) {
      return;
    }
    const gauge = gaugeMap[name];
    if (gauge) {
      gauge.set(sanitizeLabels(labels), value);
    } else {
      console.warn(`[Prometheus] Unknown gauge metric: ${name}`);
    }
  },
};

// start custom keeperhub code //
// Duration histogram bucket boundaries in milliseconds
const WORKFLOW_DURATION_BUCKETS = [
  100, 250, 500, 1000, 2000, 5000, 10_000, 30_000,
];
const STEP_DURATION_BUCKETS = [50, 100, 250, 500, 1000, 2000, 5000];

/**
 * Update DB-sourced metrics from database
 *
 * Called before each metrics scrape to ensure fresh data from the database.
 * This is necessary because workflow runner jobs exit before Prometheus can scrape them.
 */
export async function updateDbMetrics(): Promise<void> {
  try {
    // Dynamic import to avoid circular dependencies
    const {
      getWorkflowStatsFromDb,
      getStepStatsFromDb,
      getDailyActiveUsersFromDb,
      getUserStatsFromDb,
      getOrgStatsFromDb,
      getWorkflowDefinitionStatsFromDb,
      getScheduleStatsFromDb,
      getIntegrationStatsFromDb,
      getInfraStatsFromDb,
    } = await import("../db-metrics");
    const [
      workflowStats,
      stepStats,
      dailyActiveUsers,
      userStats,
      orgStats,
      workflowDefStats,
      scheduleStats,
      integrationStats,
      infraStats,
    ] = await Promise.all([
      getWorkflowStatsFromDb(),
      getStepStatsFromDb(),
      getDailyActiveUsersFromDb(),
      getUserStatsFromDb(),
      getOrgStatsFromDb(),
      getWorkflowDefinitionStatsFromDb(),
      getScheduleStatsFromDb(),
      getIntegrationStatsFromDb(),
      getInfraStatsFromDb(),
    ]);

    // Update workflow execution counts by status (gauges - point-in-time snapshots)
    workflowExecutionsTotal.set(
      { status: "success" },
      workflowStats.totalSuccess
    );
    workflowExecutionsTotal.set({ status: "error" }, workflowStats.totalError);
    workflowExecutionsTotal.set(
      { status: "running" },
      workflowStats.totalRunning
    );
    workflowExecutionsTotal.set(
      { status: "pending" },
      workflowStats.totalPending
    );
    workflowExecutionsTotal.set(
      { status: "cancelled" },
      workflowStats.totalCancelled
    );

    // Update workflow errors total (convenience gauge for alerting)
    workflowErrorsTotal.set(workflowStats.totalError);

    // Update workflow duration histogram buckets
    for (let i = 0; i < WORKFLOW_DURATION_BUCKETS.length; i++) {
      workflowDurationBucket.set(
        { le: String(WORKFLOW_DURATION_BUCKETS[i]) },
        workflowStats.durationBuckets[i] ?? 0
      );
    }
    // +Inf bucket (all observations)
    workflowDurationBucket.set(
      { le: "+Inf" },
      workflowStats.durationBuckets[WORKFLOW_DURATION_BUCKETS.length] ??
        workflowStats.durationCount
    );

    // Update workflow duration sum and count
    workflowDurationSum.set(workflowStats.durationSum);
    workflowDurationCount.set(workflowStats.durationCount);

    // Update step execution counts by status and type
    // Reset label-based gauges to clear stale step types before repopulating
    stepExecutionsTotal.reset();
    stepErrorsTotal.reset();
    for (const [stepType, counts] of Object.entries(stepStats.countsByType)) {
      stepExecutionsTotal.set(
        { step_type: stepType, status: "success" },
        counts.success
      );
      stepExecutionsTotal.set(
        { step_type: stepType, status: "error" },
        counts.error
      );
      // Update step errors for this type
      stepErrorsTotal.set({ step_type: stepType }, counts.error);
    }

    // Update step duration histogram buckets
    for (let i = 0; i < STEP_DURATION_BUCKETS.length; i++) {
      stepDurationBucket.set(
        { le: String(STEP_DURATION_BUCKETS[i]) },
        stepStats.durationBuckets[i] ?? 0
      );
    }
    // +Inf bucket
    stepDurationBucket.set(
      { le: "+Inf" },
      stepStats.durationBuckets[STEP_DURATION_BUCKETS.length] ??
        stepStats.durationCount
    );

    // Update step duration sum and count
    stepDurationSum.set(stepStats.durationSum);
    stepDurationCount.set(stepStats.durationCount);

    // Update saturation gauges from DB
    workflowQueueDepth.set(workflowStats.totalPending);
    workflowConcurrent.set(workflowStats.totalRunning);
    activeUsers.set(dailyActiveUsers);

    // Update user metrics from DB
    userTotal.set(userStats.total);
    userVerified.set(userStats.verified);
    userAnonymous.set(userStats.anonymous);
    userWithWorkflows.set(userStats.withWorkflows);
    userWithIntegrations.set(userStats.withIntegrations);

    // Update organization metrics from DB
    orgTotal.set(orgStats.total);
    orgMembersTotal.set(orgStats.membersTotal);
    // Reset label-based gauge to clear stale roles before repopulating
    orgMembersByRole.reset();
    for (const [role, count] of Object.entries(orgStats.membersByRole)) {
      orgMembersByRole.set({ role }, count);
    }
    orgInvitationsPending.set(orgStats.invitationsPending);
    orgWithWorkflows.set(orgStats.withWorkflows);

    // Update workflow definition metrics from DB
    workflowTotal.set(workflowDefStats.total);
    workflowByVisibility.set({ visibility: "public" }, workflowDefStats.public);
    workflowByVisibility.set(
      { visibility: "private" },
      workflowDefStats.private
    );
    workflowAnonymous.set(workflowDefStats.anonymous);

    // Update schedule metrics from DB
    scheduleTotal.set(scheduleStats.total);
    scheduleEnabled.set(scheduleStats.enabled);
    // Reset label-based gauge to clear stale statuses before repopulating
    scheduleByLastStatus.reset();
    for (const [status, count] of Object.entries(scheduleStats.byLastStatus)) {
      scheduleByLastStatus.set({ status }, count);
    }

    // Update integration metrics from DB
    integrationTotal.set(integrationStats.total);
    integrationManaged.set(integrationStats.managed);
    // Reset label-based gauge to clear stale types before repopulating
    integrationByType.reset();
    for (const [type, count] of Object.entries(integrationStats.byType)) {
      integrationByType.set({ type }, count);
    }

    // Update infrastructure metrics from DB
    apiKeyTotal.set(infraStats.apiKeysTotal);
    chainTotal.set(infraStats.chainsTotal);
    chainEnabled.set(infraStats.chainsEnabled);
    paraWalletTotal.set(infraStats.paraWalletsTotal);
    sessionActive.set(infraStats.sessionsActive);
  } catch (error) {
    console.error("[Prometheus] Failed to update DB metrics:", error);
    // Don't throw - allow other metrics to still be returned
  }
}
// end keeperhub code //

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
