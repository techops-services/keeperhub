/**
 * Step Handler - Logging utilities for workflow builder UI
 * These functions are called FROM INSIDE steps (within "use step" context)
 * Uses direct database calls for security (no HTTP endpoint)
 */
import "server-only";

// start custom keeperhub code //
import { recordStepMetrics } from "@/keeperhub/lib/metrics/instrumentation/workflow";
import { redactSensitiveData } from "../utils/redact";
import {
  incrementCompletedSteps,
  logStepCompleteDb,
  logStepStartDb,
  logWorkflowCompleteDb,
  updateCurrentStep,
} from "../workflow-logging";
// end keeperhub code //

export type StepContext = {
  executionId?: string;
  nodeId: string;
  nodeName: string;
  nodeType: string;
  // start custom keeperhub code //
  triggerType?: string;
  // end keeperhub code //
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
 * Strip _context from input for logging (we don't want to log internal metadata)
 */
function stripContext<T extends StepInput>(input: T): Omit<T, "_context"> {
  const { _context, ...rest } = input;
  return rest as Omit<T, "_context">;
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
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Step logging requires comprehensive error handling and progress tracking
export async function withStepLogging<TInput extends StepInput, TOutput>(
  input: TInput,
  stepLogic: () => Promise<TOutput>
): Promise<TOutput> {
  // Extract context and log input without _context
  const context = input._context as StepContextWithWorkflow | undefined;
  const loggedInput = stripContext(input);

  // Update progress: mark this step as currently running
  if (context?.executionId && context.nodeId) {
    try {
      await updateCurrentStep({
        executionId: context.executionId,
        currentNodeId: context.nodeId,
        currentNodeName: context.nodeName,
      });
    } catch (err) {
      console.error("[stepHandler] Failed to update current step:", err);
    }
  }

  const logInfo = await logStepStart(context, loggedInput);

  try {
    const result = await stepLogic();

    // Check if result indicates an error
    const isErrorResult =
      result &&
      typeof result === "object" &&
      "success" in result &&
      (result as { success: boolean }).success === false;

    if (isErrorResult) {
      const errorResult = result as { success: false; error?: string };
      await logStepComplete(
        logInfo,
        "error",
        result,
        errorResult.error || "Step execution failed"
      );

      // start custom keeperhub code //
      recordStepMetrics({
        executionId: context?.executionId,
        nodeId: context?.nodeId || "",
        nodeName: context?.nodeName || "",
        stepType: context?.nodeType || "unknown",
        durationMs: Date.now() - logInfo.startTime,
        success: false,
        error: errorResult.error,
      });
      // end keeperhub code //
    } else {
      await logStepComplete(logInfo, "success", result);

      // start custom keeperhub code //
      recordStepMetrics({
        executionId: context?.executionId,
        nodeId: context?.nodeId || "",
        nodeName: context?.nodeName || "",
        stepType: context?.nodeType || "unknown",
        durationMs: Date.now() - logInfo.startTime,
        success: true,
      });
      // end keeperhub code //
    }

    // Update progress: increment completed steps
    if (context?.executionId && context.nodeId) {
      try {
        await incrementCompletedSteps({
          executionId: context.executionId,
          nodeId: context.nodeId,
          nodeName: context.nodeName,
          success: !isErrorResult,
        });
      } catch (err) {
        console.error(
          "[stepHandler] Failed to increment completed steps:",
          err
        );
      }
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

    // start custom keeperhub code //
    recordStepMetrics({
      executionId: context?.executionId,
      nodeId: context?.nodeId || "",
      nodeName: context?.nodeName || "",
      stepType: context?.nodeType || "unknown",
      durationMs: Date.now() - logInfo.startTime,
      success: false,
      error: errorMessage,
    });
    // end keeperhub code //

    // Update progress on error too
    if (context?.executionId && context.nodeId) {
      try {
        await incrementCompletedSteps({
          executionId: context.executionId,
          nodeId: context.nodeId,
          nodeName: context.nodeName,
          success: false,
        });
      } catch (err) {
        console.error(
          "[stepHandler] Failed to increment completed steps:",
          err
        );
      }
    }

    throw error;
  }
}
