/**
 * API Metrics Instrumentation
 *
 * Helper functions to instrument API routes with golden signal metrics.
 */

import {
  createTimer,
  getMetricsCollector,
  LabelKeys,
  MetricNames,
} from "../index";

/**
 * API request context for metrics
 */
export type ApiMetricsContext = {
  endpoint: string;
  method?: string;
};

/**
 * Start tracking API request and return completion function
 */
export function startApiMetrics(context: ApiMetricsContext): {
  complete: (statusCode: number) => void;
  recordError: (error: Error | string, statusCode?: number) => void;
} {
  const metrics = getMetricsCollector();
  const timer = createTimer();

  const baseLabels: Record<string, string> = {
    [LabelKeys.ENDPOINT]: context.endpoint,
  };
  if (context.method) {
    baseLabels.method = context.method;
  }

  return {
    complete: (statusCode: number) => {
      const latencyMetric = getLatencyMetricForEndpoint(context.endpoint);
      const labelsWithStatus = {
        ...baseLabels,
        [LabelKeys.STATUS_CODE]: String(statusCode),
        [LabelKeys.STATUS]: statusCode >= 400 ? "failure" : "success",
      };

      // Increment request counter with status_code (required by Prometheus counter)
      metrics.incrementCounter(MetricNames.API_REQUESTS_TOTAL, {
        [LabelKeys.ENDPOINT]: context.endpoint,
        [LabelKeys.STATUS_CODE]: String(statusCode),
      });

      metrics.recordLatency(latencyMetric, timer(), labelsWithStatus);
    },

    recordError: (error: Error | string, statusCode = 500) => {
      const latencyMetric = getLatencyMetricForEndpoint(context.endpoint);
      const labelsWithStatus = {
        ...baseLabels,
        [LabelKeys.STATUS_CODE]: String(statusCode),
        [LabelKeys.STATUS]: "failure",
      };

      // Increment request counter with status_code (required by Prometheus counter)
      metrics.incrementCounter(MetricNames.API_REQUESTS_TOTAL, {
        [LabelKeys.ENDPOINT]: context.endpoint,
        [LabelKeys.STATUS_CODE]: String(statusCode),
      });

      metrics.recordLatency(latencyMetric, timer(), labelsWithStatus);

      const errorObj = typeof error === "string" ? { message: error } : error;
      metrics.recordError(MetricNames.API_ERRORS_TOTAL, errorObj, {
        ...baseLabels,
        [LabelKeys.STATUS_CODE]: String(statusCode),
      });
    },
  };
}

/**
 * Get the appropriate latency metric name for an endpoint
 */
function getLatencyMetricForEndpoint(endpoint: string): string {
  if (endpoint.includes("webhook")) {
    return MetricNames.API_WEBHOOK_LATENCY;
  }
  if (endpoint.includes("status")) {
    return MetricNames.API_STATUS_LATENCY;
  }
  return "api.request.latency_ms";
}

/**
 * Record webhook trigger metrics
 */
export function recordWebhookMetrics(options: {
  workflowId: string;
  executionId?: string;
  durationMs: number;
  statusCode: number;
  error?: string;
}): void {
  const metrics = getMetricsCollector();
  const success = options.statusCode < 400;

  const labels: Record<string, string> = {
    [LabelKeys.WORKFLOW_ID]: options.workflowId,
    [LabelKeys.STATUS_CODE]: String(options.statusCode),
    [LabelKeys.STATUS]: success ? "success" : "failure",
    // Always include execution_id - Prometheus histogram requires this label
    [LabelKeys.EXECUTION_ID]: options.executionId ?? "unknown",
  };

  metrics.recordLatency(
    MetricNames.API_WEBHOOK_LATENCY,
    options.durationMs,
    labels
  );

  if (!success && options.error) {
    metrics.recordError(
      MetricNames.API_ERRORS_TOTAL,
      { message: options.error },
      {
        [LabelKeys.ENDPOINT]: "webhook",
        [LabelKeys.STATUS_CODE]: String(options.statusCode),
      }
    );
  }
}

/**
 * Record status polling metrics
 */
export function recordStatusPollMetrics(options: {
  executionId: string;
  durationMs: number;
  statusCode: number;
  executionStatus?: string;
}): void {
  const metrics = getMetricsCollector();

  metrics.recordLatency(MetricNames.API_STATUS_LATENCY, options.durationMs, {
    [LabelKeys.EXECUTION_ID]: options.executionId,
    [LabelKeys.STATUS_CODE]: String(options.statusCode),
    [LabelKeys.STATUS]: options.statusCode < 400 ? "success" : "failure",
    // Always include execution_status - Prometheus histogram requires this label
    execution_status: options.executionStatus ?? "unknown",
  });
}
