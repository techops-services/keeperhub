/**
 * Workflow Metrics Instrumentation
 *
 * Helper functions to instrument workflow execution with golden signal metrics.
 */

import {
  getMetricsCollector,
  MetricNames,
  LabelKeys,
  createTimer,
  type TriggerType,
} from "../index";

/**
 * Record workflow execution start and return a timer function
 */
export function startWorkflowMetrics(options: {
  workflowId?: string;
  executionId?: string;
  triggerType?: TriggerType;
}): () => void {
  const metrics = getMetricsCollector();
  const timer = createTimer();

  const labels: Record<string, string> = {};
  if (options.workflowId) {
    labels[LabelKeys.WORKFLOW_ID] = options.workflowId;
  }
  if (options.executionId) {
    labels[LabelKeys.EXECUTION_ID] = options.executionId;
  }
  if (options.triggerType) {
    labels[LabelKeys.TRIGGER_TYPE] = options.triggerType;
  }

  // Increment execution counter
  metrics.incrementCounter(MetricNames.WORKFLOW_EXECUTIONS_TOTAL, labels);

  // Return completion function
  return (success = true) => {
    metrics.recordLatency(MetricNames.WORKFLOW_EXECUTION_DURATION, timer(), {
      ...labels,
      [LabelKeys.STATUS]: success ? "success" : "failure",
    });
  };
}

/**
 * Record workflow execution completion
 */
export function recordWorkflowComplete(options: {
  workflowId?: string;
  executionId?: string;
  triggerType?: TriggerType;
  durationMs: number;
  success: boolean;
  error?: Error | string;
}): void {
  const metrics = getMetricsCollector();

  const labels: Record<string, string> = {
    [LabelKeys.STATUS]: options.success ? "success" : "failure",
  };
  if (options.workflowId) {
    labels[LabelKeys.WORKFLOW_ID] = options.workflowId;
  }
  if (options.executionId) {
    labels[LabelKeys.EXECUTION_ID] = options.executionId;
  }
  if (options.triggerType) {
    labels[LabelKeys.TRIGGER_TYPE] = options.triggerType;
  }

  // Record duration
  metrics.recordLatency(
    MetricNames.WORKFLOW_EXECUTION_DURATION,
    options.durationMs,
    labels
  );

  // Record error if failed
  if (!options.success && options.error) {
    const errorObj =
      typeof options.error === "string"
        ? { message: options.error }
        : options.error;

    metrics.recordError(MetricNames.WORKFLOW_EXECUTION_ERRORS, errorObj, labels);
  }
}

/**
 * Record step execution metrics
 */
export function recordStepMetrics(options: {
  executionId?: string;
  nodeId: string;
  nodeName: string;
  stepType: string;
  durationMs: number;
  success: boolean;
  error?: string;
}): void {
  const metrics = getMetricsCollector();

  const labels: Record<string, string> = {
    [LabelKeys.STEP_TYPE]: options.stepType,
    [LabelKeys.STATUS]: options.success ? "success" : "failure",
  };
  if (options.executionId) {
    labels[LabelKeys.EXECUTION_ID] = options.executionId;
  }

  // Record step duration
  metrics.recordLatency(MetricNames.WORKFLOW_STEP_DURATION, options.durationMs, labels);

  // Record error if failed
  if (!options.success && options.error) {
    metrics.recordError(
      MetricNames.WORKFLOW_STEP_ERRORS,
      { message: options.error },
      labels
    );
  }
}

/**
 * Determine trigger type from workflow nodes
 */
export function detectTriggerType(nodes: Array<{ data: { type: string; config?: Record<string, unknown> } }>): TriggerType {
  const triggerNode = nodes.find((n) => n.data.type === "trigger");
  if (!triggerNode) {
    return "manual";
  }

  const triggerType = triggerNode.data.config?.triggerType as string | undefined;

  if (triggerType === "Webhook") {
    return "webhook";
  }
  if (triggerType === "Scheduled" || triggerType === "Schedule") {
    return "scheduled";
  }

  return "manual";
}
