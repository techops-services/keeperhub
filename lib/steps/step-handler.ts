/**
 * Step Handler - Logging utilities for workflow builder UI
 * These functions are called FROM INSIDE steps (within "use step" context)
 * Uses direct database calls for security (no HTTP endpoint)
 */
import "server-only";

import { redactSensitiveData } from "../utils/redact";
import {
  logStepCompleteDb,
  logStepStartDb,
  logWorkflowCompleteDb,
} from "../workflow-logging";

export type StepContext = {
  executionId?: string;
  nodeId: string;
  nodeName: string;
  nodeType: string;
};

/**
 * Base input type that all steps should extend
 * Adds optional _context for logging
 */
export type StepInput = {
  _context?: StepContext;
};

type LogInfo = {
  logId: string;
  startTime: number;
};

/**
 * Log the start of a step execution
 */
async function logStepStart(
  context: StepContext | undefined,
  input: unknown
): Promise<LogInfo> {
  if (!context?.executionId) {
    return { logId: "", startTime: Date.now() };
  }

  try {
    const redactedInput = redactSensitiveData(input);

    const result = await logStepStartDb({
      executionId: context.executionId,
      nodeId: context.nodeId,
      nodeName: context.nodeName,
      nodeType: context.nodeType,
      input: redactedInput,
    });

    return result;
  } catch (error) {
    console.error("[stepHandler] Failed to log start:", error);
    return { logId: "", startTime: Date.now() };
  }
}

/**
 * Log the completion of a step execution
 */
async function logStepComplete(
  logInfo: LogInfo,
  status: "success" | "error",
  output?: unknown,
  error?: string
): Promise<void> {
  if (!logInfo.logId) {
    return;
  }

  try {
    const redactedOutput = redactSensitiveData(output);

    await logStepCompleteDb({
      logId: logInfo.logId,
      startTime: logInfo.startTime,
      status,
      output: redactedOutput,
      error,
    });
  } catch (err) {
    console.error("[stepHandler] Failed to log completion:", err);
  }
}

/**
 * Internal fields to strip from logged input
 */
const INTERNAL_FIELDS = ["_context", "actionType", "integrationId"] as const;

/**
 * Strip internal fields from input for logging (we don't want to log internal metadata)
 */
function stripInternalFields<T extends StepInput>(
  input: T
): Omit<T, "_context" | "actionType" | "integrationId"> {
  const result = { ...input };
  for (const field of INTERNAL_FIELDS) {
    delete (result as Record<string, unknown>)[field];
  }
  return result as Omit<T, "_context" | "actionType" | "integrationId">;
}

/**
 * Log workflow execution completion
 * Call this from within a step context to update the overall workflow status
 */
export async function logWorkflowComplete(options: {
  executionId: string;
  status: "success" | "error";
  output?: unknown;
  error?: string;
  startTime: number;
}): Promise<void> {
  try {
    const redactedOutput = redactSensitiveData(options.output);

    await logWorkflowCompleteDb({
      executionId: options.executionId,
      status: options.status,
      output: redactedOutput,
      error: options.error,
      startTime: options.startTime,
    });
  } catch (err) {
    console.error("[stepHandler] Failed to log workflow completion:", err);
  }
}

/**
 * Extended context that includes workflow completion info
 */
export type StepContextWithWorkflow = StepContext & {
  _workflowComplete?: {
    status: "success" | "error";
    output?: unknown;
    error?: string;
    startTime: number;
  };
};

/**
 * Extended input type for steps that may handle workflow completion
 */
export type StepInputWithWorkflow = {
  _context?: StepContextWithWorkflow;
};

/**
 * Wrap step logic with logging
 * Call this from inside your step function (within "use step" context)
 * If _context._workflowComplete is set, also logs workflow completion
 *
 * @example
 * export async function myStep(input: MyInput & StepInput) {
 *   "use step";
 *   return withStepLogging(input, async () => {
 *     // your step logic here
 *     return { success: true, data: ... };
 *   });
 * }
 */
export async function withStepLogging<TInput extends StepInput, TOutput>(
  input: TInput,
  stepLogic: () => Promise<TOutput>
): Promise<TOutput> {
  // Extract context and log input without internal fields
  const context = input._context as StepContextWithWorkflow | undefined;
  const loggedInput = stripInternalFields(input);
  const logInfo = await logStepStart(context, loggedInput);

  try {
    const result = await stepLogic();

    // Check if result has standardized format { success, data } or { success, error }
    const isStandardizedResult =
      result &&
      typeof result === "object" &&
      "success" in result &&
      typeof (result as { success: unknown }).success === "boolean";

    // Check if result indicates an error
    const isErrorResult =
      isStandardizedResult &&
      (result as { success: boolean }).success === false;

    if (isErrorResult) {
      const errorResult = result as {
        success: false;
        error?: string | { message: string };
      };
      // Support both old format (error: string) and new format (error: { message: string })
      const errorMessage =
        typeof errorResult.error === "string"
          ? errorResult.error
          : errorResult.error?.message || "Step execution failed";
      // Log just the error object, not the full result
      const loggedOutput = errorResult.error ?? { message: errorMessage };
      await logStepComplete(logInfo, "error", loggedOutput, errorMessage);
    } else if (isStandardizedResult) {
      // For standardized success results, log just the data
      const successResult = result as { success: true; data?: unknown };
      await logStepComplete(logInfo, "success", successResult.data ?? result);
    } else {
      // For non-standardized results, log as-is
      await logStepComplete(logInfo, "success", result);
    }

    // If this step should also log workflow completion, do it now
    if (context?._workflowComplete && context.executionId) {
      await logWorkflowComplete({
        executionId: context.executionId,
        ...context._workflowComplete,
      });
    }

    return result;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    await logStepComplete(logInfo, "error", undefined, errorMessage);
    throw error;
  }
}
