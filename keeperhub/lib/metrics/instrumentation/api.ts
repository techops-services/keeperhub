/**
 * API Metrics Instrumentation
 *
 * Helper functions to instrument API routes with golden signal metrics.
 */

import { getMetricsCollector, LabelKeys, MetricNames } from "../index";

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
    [LabelKeys.STATUS_CODE]: String(options.statusCode),
    [LabelKeys.STATUS]: success ? "success" : "failure",
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
    [LabelKeys.STATUS_CODE]: String(options.statusCode),
    [LabelKeys.STATUS]: options.statusCode < 400 ? "success" : "failure",
    execution_status: options.executionStatus ?? "unknown",
  });
}
