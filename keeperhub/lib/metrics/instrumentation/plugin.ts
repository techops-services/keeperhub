/**
 * Plugin Metrics Instrumentation
 *
 * Helper functions to instrument plugin actions with golden signal metrics.
 */

import {
  getMetricsCollector,
  MetricNames,
  LabelKeys,
  createTimer,
} from "../index";

/**
 * Plugin action context for metrics
 */
export type PluginMetricsContext = {
  pluginName: string;
  actionName: string;
  executionId?: string;
};

/**
 * Record plugin action invocation and completion
 */
export function recordPluginMetrics(options: {
  pluginName: string;
  actionName: string;
  executionId?: string;
  durationMs: number;
  success: boolean;
  error?: string;
  externalService?: string;
}): void {
  const metrics = getMetricsCollector();

  const labels: Record<string, string> = {
    [LabelKeys.PLUGIN_NAME]: options.pluginName,
    [LabelKeys.ACTION_NAME]: options.actionName,
    [LabelKeys.STATUS]: options.success ? "success" : "failure",
  };
  if (options.executionId) {
    labels[LabelKeys.EXECUTION_ID] = options.executionId;
  }

  // Record plugin action duration
  metrics.recordLatency(MetricNames.PLUGIN_ACTION_DURATION, options.durationMs, labels);

  // Record error if failed
  if (!options.success && options.error) {
    metrics.recordError(
      MetricNames.PLUGIN_ACTION_ERRORS,
      { message: options.error },
      labels
    );

    // Also record as external service error if service specified
    if (options.externalService) {
      metrics.recordError(
        MetricNames.EXTERNAL_SERVICE_ERRORS,
        { message: options.error },
        {
          [LabelKeys.SERVICE]: options.externalService,
          [LabelKeys.PLUGIN_NAME]: options.pluginName,
        }
      );
    }
  }
}

/**
 * Wrap a plugin step handler with metrics tracking
 *
 * @example
 * ```typescript
 * export async function sendDiscordMessageStep(input: SendDiscordMessageInput) {
 *   "use step";
 *   return withPluginMetrics(
 *     { pluginName: "discord", actionName: "send-message" },
 *     () => withStepLogging(input, () => stepHandler(input, credentials))
 *   );
 * }
 * ```
 */
export async function withPluginMetrics<T>(
  context: PluginMetricsContext,
  fn: () => Promise<T>
): Promise<T> {
  const metrics = getMetricsCollector();
  const timer = createTimer();

  const labels: Record<string, string> = {
    [LabelKeys.PLUGIN_NAME]: context.pluginName,
    [LabelKeys.ACTION_NAME]: context.actionName,
  };
  if (context.executionId) {
    labels[LabelKeys.EXECUTION_ID] = context.executionId;
  }

  // Increment invocation counter
  metrics.incrementCounter(MetricNames.PLUGIN_INVOCATIONS_TOTAL, labels);

  try {
    const result = await fn();

    // Check if result indicates an error (plugin convention)
    const isErrorResult =
      result &&
      typeof result === "object" &&
      "success" in result &&
      (result as { success: boolean }).success === false;

    if (isErrorResult) {
      const errorResult = result as { success: false; error?: string };
      metrics.recordLatency(MetricNames.PLUGIN_ACTION_DURATION, timer(), {
        ...labels,
        [LabelKeys.STATUS]: "failure",
      });
      metrics.recordError(
        MetricNames.PLUGIN_ACTION_ERRORS,
        { message: errorResult.error || "Plugin action failed" },
        labels
      );
    } else {
      metrics.recordLatency(MetricNames.PLUGIN_ACTION_DURATION, timer(), {
        ...labels,
        [LabelKeys.STATUS]: "success",
      });
    }

    return result;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    metrics.recordLatency(MetricNames.PLUGIN_ACTION_DURATION, timer(), {
      ...labels,
      [LabelKeys.STATUS]: "failure",
    });
    metrics.recordError(
      MetricNames.PLUGIN_ACTION_ERRORS,
      error instanceof Error ? error : { message: errorMessage },
      labels
    );

    throw error;
  }
}

/**
 * Record external service call metrics (for tracking third-party API reliability)
 */
export function recordExternalServiceCall(options: {
  service: string;
  durationMs: number;
  success: boolean;
  statusCode?: number;
  error?: string;
}): void {
  const metrics = getMetricsCollector();

  const labels: Record<string, string> = {
    [LabelKeys.SERVICE]: options.service,
    [LabelKeys.STATUS]: options.success ? "success" : "failure",
  };
  if (options.statusCode) {
    labels[LabelKeys.STATUS_CODE] = String(options.statusCode);
  }

  // Record as generic API latency (could add a dedicated metric if needed)
  metrics.recordLatency("external.service.latency_ms", options.durationMs, labels);

  if (!options.success && options.error) {
    metrics.recordError(
      MetricNames.EXTERNAL_SERVICE_ERRORS,
      { message: options.error },
      labels
    );
  }
}
