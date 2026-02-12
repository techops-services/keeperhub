/**
 * Workflow-based executor using "use workflow" and "use step" directives
 * This executor captures step executions through the workflow SDK for better observability
 */

import {
  getMetricsCollector,
  LabelKeys,
  MetricNames,
} from "@/keeperhub/lib/metrics";
import {
  decrementConcurrentExecutions,
  incrementConcurrentExecutions,
} from "@/keeperhub/lib/metrics/instrumentation/saturation";
// start custom keeperhub code //
import {
  detectTriggerType,
  recordWorkflowComplete,
} from "@/keeperhub/lib/metrics/instrumentation/workflow";
import {
  preValidateConditionExpression,
  validateConditionExpression,
} from "@/lib/condition-validator";
import {
  getActionLabel,
  getStepImporter,
  type StepImporter,
} from "./step-registry";
import type { StepContext } from "./steps/step-handler";
import { triggerStep } from "./steps/trigger";
import { deserializeEventTriggerData, getErrorMessageAsync } from "./utils";
import type { WorkflowEdge, WorkflowNode } from "./workflow-store";

// end keeperhub code //

// System actions that don't have plugins - maps to module import functions
const SYSTEM_ACTIONS: Record<string, StepImporter> = {
  "Database Query": {
    // biome-ignore lint/suspicious/noExplicitAny: Dynamic module import
    importer: () => import("./steps/database-query") as Promise<any>,
    stepFunction: "databaseQueryStep",
  },
  "HTTP Request": {
    // biome-ignore lint/suspicious/noExplicitAny: Dynamic module import
    importer: () => import("./steps/http-request") as Promise<any>,
    stepFunction: "httpRequestStep",
  },
  Condition: {
    // biome-ignore lint/suspicious/noExplicitAny: Dynamic module import
    importer: () => import("./steps/condition") as Promise<any>,
    stepFunction: "conditionStep",
  },
};

type ExecutionResult = {
  success: boolean;
  data?: unknown;
  error?: string;
};

type NodeOutputs = Record<string, { label: string; data: unknown }>;

/** Matches path segment like "carts[0]" for array index access (same as template.ts) */
const ARRAY_ACCESS_PATTERN = /^([^[]+)\[(\d+)\]$/;

export type WorkflowExecutionInput = {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  triggerInput?: Record<string, unknown>;
  executionId?: string;
  workflowId?: string; // Used by steps to fetch credentials
};

/**
 * Helper to replace template variables in conditions
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: KEEP-1284 validation requires checking multiple error conditions
function replaceTemplateVariable(
  _match: string,
  nodeId: string,
  rest: string,
  outputs: NodeOutputs,
  evalContext: Record<string, unknown>,
  varCounter: { value: number }
): string {
  const sanitizedNodeId = nodeId.replace(/[^a-zA-Z0-9]/g, "_");
  const output = outputs[sanitizedNodeId];

  // KEEP-1284: Throw error when referenced node output doesn't exist
  if (!output) {
    throw new Error(
      `Condition references node "${nodeId}" but no output was found. The referenced node may not have executed or produced output.`
    );
  }

  const dotIndex = rest.indexOf(".");
  let value: unknown;

  if (dotIndex === -1) {
    value = output.data;
  } else if (output.data === null || output.data === undefined) {
    // KEEP-1284: Throw error when node data is null/undefined
    throw new Error(
      `Condition references "${rest}" but the node output data is ${output.data === null ? "null" : "undefined"}. Ensure the referenced node produces valid output.`
    );
  } else {
    const fieldPath = rest.substring(dotIndex + 1);
    const fields = fieldPath.split(".");
    // biome-ignore lint/suspicious/noExplicitAny: Dynamic data traversal
    let current: any = output.data;

    for (const segment of fields) {
      if (current === null || current === undefined) {
        throw new Error(
          `Condition references field "${fieldPath}" but it could not be resolved. Check that the field path is correct.`
        );
      }
      if (typeof current !== "object") {
        throw new Error(
          `Condition references field "${fieldPath}" but it could not be resolved. Check that the field path is correct.`
        );
      }

      const arrayMatch = segment.match(ARRAY_ACCESS_PATTERN);
      if (arrayMatch) {
        const [, key, indexStr] = arrayMatch;
        const index = Number.parseInt(indexStr, 10);
        if (!(key in current)) {
          throw new Error(
            `Condition references field "${fieldPath}" but "${key}" does not exist on the data. Available fields: ${Object.keys(current).join(", ") || "(none)"}`
          );
        }
        const arr = current[key];
        if (!Array.isArray(arr)) {
          throw new Error(
            `Condition references field "${fieldPath}" but "${key}" is not an array. Cannot access [${index}].`
          );
        }
        if (index < 0 || index >= arr.length) {
          throw new Error(
            `Condition references field "${fieldPath}" but "${segment}" is out of range (array length ${arr.length}). Use index 0 to ${arr.length - 1}.`
          );
        }
        current = arr[index];
      } else {
        if (!(segment in current)) {
          throw new Error(
            `Condition references field "${fieldPath}" but "${segment}" does not exist on the data. Available fields: ${Object.keys(current).join(", ") || "(none)"}`
          );
        }
        current = current[segment];
      }
    }
    value = current;
  }

  const varName = `__v${varCounter.value}`;
  varCounter.value += 1;
  evalContext[varName] = value;
  return varName;
}

type ConditionEvalResult = {
  result: boolean;
  resolvedValues: Record<string, unknown>;
};

/**
 * Evaluate condition expression with template variable replacement
 * Uses Function constructor to evaluate user-defined conditions dynamically
 *
 * Security: Expressions are validated before evaluation to prevent code injection.
 * Only comparison operators, logical operators, and whitelisted methods are allowed.
 */
// Exported for testing - KEEP-1284
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: KEEP-1284 validation requires comprehensive error checking
export function evaluateConditionExpression(
  conditionExpression: unknown,
  outputs: NodeOutputs
): ConditionEvalResult {
  console.log("[Condition] Original expression:", conditionExpression);

  // KEEP-1284: Throw error when condition is not configured
  if (conditionExpression === undefined || conditionExpression === null) {
    throw new Error(
      "Condition node has no expression configured. Please add a condition expression."
    );
  }

  if (typeof conditionExpression === "boolean") {
    return { result: conditionExpression, resolvedValues: {} };
  }

  if (typeof conditionExpression === "string") {
    // Pre-validate the expression before any processing
    // KEEP-1284: Throw error when condition is empty/invalid instead of silently returning false
    const preValidation = preValidateConditionExpression(conditionExpression);
    if (!preValidation.valid) {
      throw new Error(
        `Condition expression is invalid: ${preValidation.error}. Expression: "${conditionExpression}"`
      );
    }

    try {
      const evalContext: Record<string, unknown> = {};
      const resolvedValues: Record<string, unknown> = {};
      let transformedExpression = conditionExpression;
      const templatePattern = /\{\{@([^:]+):([^}]+)\}\}/g;
      const varCounter = { value: 0 };

      transformedExpression = transformedExpression.replace(
        templatePattern,
        (match, nodeId, rest) => {
          const varName = replaceTemplateVariable(
            match,
            nodeId,
            rest,
            outputs,
            evalContext,
            varCounter
          );
          // Store the resolved value with a readable key (the display text from the template)
          resolvedValues[rest] = evalContext[varName];
          return varName;
        }
      );

      // Validate the transformed expression before evaluation
      // KEEP-1284: Throw error when validation fails instead of silently returning false
      const validation = validateConditionExpression(transformedExpression);
      if (!validation.valid) {
        throw new Error(
          `Condition expression validation failed: ${validation.error}. Original: "${conditionExpression}"`
        );
      }

      const varNames = Object.keys(evalContext);
      const varValues = Object.values(evalContext);

      // Safe to evaluate - expression has been validated
      // Only contains: variables (__v0, __v1), operators, literals, and whitelisted methods
      const evalFunc = new Function(
        ...varNames,
        `return (${transformedExpression});`
      );
      const result = evalFunc(...varValues);
      return { result: Boolean(result), resolvedValues };
    } catch (error) {
      // KEEP-1284: Re-throw errors about missing data - these should not be silently swallowed
      if (
        error instanceof Error &&
        error.message.includes("Condition references")
      ) {
        throw error;
      }
      // Other errors (syntax errors, etc.) should still fail loudly
      console.error("[Condition] Failed to evaluate condition:", error);
      console.error("[Condition] Expression was:", conditionExpression);
      throw new Error(
        `Failed to evaluate condition expression: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // KEEP-1284: Throw error for unexpected expression types (number, object, etc.)
  throw new Error(
    `Condition expression must be a string or boolean, got ${typeof conditionExpression}`
  );
}

/**
 * Execute a single action step with logging via stepHandler
 * IMPORTANT: Steps receive only the integration ID as a reference to fetch credentials.
 * This prevents credentials from being logged in Vercel's workflow observability.
 */
async function executeActionStep(input: {
  actionType: string;
  config: Record<string, unknown>;
  outputs: NodeOutputs;
  context: StepContext;
}) {
  const { actionType, config, outputs, context } = input;

  // Build step input WITHOUT credentials, but WITH integrationId reference and logging context
  const stepInput: Record<string, unknown> = {
    ...config,
    _context: context,
  };

  // Special handling for Condition action - needs template evaluation
  if (actionType === "Condition") {
    const systemAction = SYSTEM_ACTIONS.Condition;
    const module = await systemAction.importer();
    const originalExpression = stepInput.condition;

    // KEEP-1284: Catch evaluation errors and pass to step so it gets logged
    let evaluatedCondition = false;
    let resolvedValues: Record<string, unknown> = {};
    let evaluationError: string | undefined;

    try {
      const result = evaluateConditionExpression(originalExpression, outputs);
      evaluatedCondition = result.result;
      resolvedValues = result.resolvedValues;
    } catch (error) {
      evaluationError = error instanceof Error ? error.message : String(error);
    }

    console.log("[Condition] Final result:", evaluatedCondition);

    return await module[systemAction.stepFunction]({
      condition: evaluatedCondition,
      // Include original expression only when evaluation succeeded (avoid raw template in UI on failure)
      expression:
        !evaluationError && typeof originalExpression === "string"
          ? originalExpression
          : undefined,
      values:
        Object.keys(resolvedValues).length > 0 ? resolvedValues : undefined,
      _evaluationError: evaluationError,
      _context: context,
    });
  }

  // Check system actions first (Database Query, HTTP Request)
  const systemAction = SYSTEM_ACTIONS[actionType];
  if (systemAction) {
    const module = await systemAction.importer();
    const stepFunction = module[systemAction.stepFunction];
    return await stepFunction(stepInput);
  }

  // Look up plugin action from the generated step registry
  const stepImporter = getStepImporter(actionType);
  if (stepImporter) {
    const module = await stepImporter.importer();
    const stepFunction = module[stepImporter.stepFunction];
    if (stepFunction) {
      return await stepFunction(stepInput);
    }

    return {
      success: false,
      error: `Step function "${stepImporter.stepFunction}" not found in module for action "${actionType}". Check that the plugin exports the correct function name.`,
    };
  }

  // Fallback for unknown action types
  return {
    success: false,
    error: `Unknown action type: "${actionType}". This action is not registered in the plugin system. Available system actions: ${Object.keys(SYSTEM_ACTIONS).join(", ")}.`,
  };
}

// start custom keeperhub code //
/**
 * Resolve a field path (e.g. "data.recipes[0].tags[0]") into a value.
 * Supports bracket notation for array indices.
 */
function resolveConfigFieldPath(data: unknown, fieldPath: string): unknown {
  if (data === null || data === undefined) {
    return;
  }
  const parts = fieldPath.split(".");
  let current: unknown = data;
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }
    const arrayMatch = trimmed.match(ARRAY_ACCESS_PATTERN);
    if (arrayMatch) {
      const [, key, indexStr] = arrayMatch;
      const obj = current as Record<string, unknown>;
      const arr = obj?.[key];
      if (!Array.isArray(arr)) {
        return;
      }
      current = arr[Number.parseInt(indexStr, 10)];
    } else {
      current = (current as Record<string, unknown>)?.[trimmed];
    }
    if (current === undefined || current === null) {
      return;
    }
  }
  return current;
}

function formatConfigValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

/** True when output has shape { data: object } (e.g. HTTP step result). */
function hasNestedDataShape(
  data: unknown
): data is Record<string, unknown> & { data: object } {
  return (
    typeof data === "object" &&
    data !== null &&
    "data" in data &&
    typeof (data as Record<string, unknown>).data === "object"
  );
}

/**
 * Resolve from output.data, or from output.data.data when step wraps body in .data (e.g. HTTP).
 */
function resolveFromOutputData(data: unknown, fieldPath: string): unknown {
  const fromTop = fieldPath ? resolveConfigFieldPath(data, fieldPath) : data;
  if (fromTop !== undefined && fromTop !== null) {
    return fromTop;
  }
  if (hasNestedDataShape(data)) {
    const inner = data.data;
    return fieldPath ? resolveConfigFieldPath(inner, fieldPath) : inner;
  }
  return;
}

function replaceConfigTemplate(
  match: string,
  nodeId: string,
  rest: string,
  outputs: NodeOutputs
): string {
  const trimmedNodeId = nodeId.trim();
  const sanitizedNodeId = trimmedNodeId.replace(/[^a-zA-Z0-9]/g, "_");
  const output = outputs[sanitizedNodeId] ?? outputs[trimmedNodeId];
  const fieldPath = rest.includes(".")
    ? rest.substring(rest.indexOf(".") + 1).trim()
    : "";

  console.log("[Template] Resolving:", {
    template: match,
    nodeId: trimmedNodeId,
    sanitizedNodeId,
    fieldPath: fieldPath || "(whole output)",
    outputKeys: Object.keys(outputs),
    foundOutput: !!output,
  });

  if (!output) {
    console.log("[Template] No output for node, returning empty string");
    return "";
  }
  const data = output.data;
  if (data === null || data === undefined) {
    console.log(
      "[Template] Output data is null/undefined, returning empty string"
    );
    return "";
  }

  const dataKeys =
    typeof data === "object" && data !== null
      ? Object.keys(data as Record<string, unknown>)
      : [];
  console.log("[Template] Output data top-level keys:", dataKeys);

  const resolved = resolveFromOutputData(data, fieldPath);
  if (resolved === undefined || resolved === null) {
    if (hasNestedDataShape(data)) {
      const innerKeys = Object.keys(data.data as Record<string, unknown>);
      console.log("[Template] Trying inner output.data, keys:", innerKeys);
    }
    console.log(
      "[Template] Path not found, returning empty string. fieldPath:",
      fieldPath
    );
    return "";
  }

  console.log(
    "[Template] Resolved, type:",
    typeof resolved,
    Array.isArray(resolved) ? "array" : ""
  );
  return formatConfigValue(resolved);
}

/**
 * Process template variables in config.
 * Recurses into nested objects; supports array paths like data.recipes[0].
 */
function processTemplates(
  config: Record<string, unknown>,
  outputs: NodeOutputs
): Record<string, unknown> {
  const processed: Record<string, unknown> = {};
  const templatePattern = /\{\{@([^:]+):([^}]+)\}\}/g;

  for (const [key, value] of Object.entries(config)) {
    if (typeof value === "string") {
      processed[key] = value.replace(templatePattern, (m, nodeId, rest) =>
        replaceConfigTemplate(m, nodeId, rest, outputs)
      );
    } else if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value)
    ) {
      processed[key] = processTemplates(
        value as Record<string, unknown>,
        outputs
      );
    } else {
      processed[key] = value;
    }
  }

  return processed;
}

/**
 * Resolve a display-format template (e.g. "Label.field") by searching outputs
 * for a node whose label matches, then resolving the field path from its data.
 * Uses case-insensitive label matching to stay consistent with the UI-side
 * findNodeOutputByLabel in lib/utils/template.ts.
 */
export function resolveDisplayTemplate(
  displayRef: string,
  outputs: NodeOutputs
): unknown {
  const dotIndex = displayRef.indexOf(".");
  const label =
    dotIndex === -1 ? displayRef : displayRef.substring(0, dotIndex);
  const fieldPath = dotIndex === -1 ? "" : displayRef.substring(dotIndex + 1);

  const entry = findOutputByLabel(label, outputs);
  if (!entry) {
    return null;
  }

  if (entry.data === null || entry.data === undefined) {
    return null;
  }

  return resolveFromOutputData(entry.data, fieldPath) ?? null;
}

/**
 * Extract template references from a SQL query string and convert them to
 * PostgreSQL parameterized query placeholders ($1, $2, ...).
 * Returns the parameterized SQL and an ordered array of resolved values,
 * preserving native types for proper SQL parameterization.
 *
 * Handles both stored format {{@nodeId:Label.field}} and display format
 * {{Label.field}} (fallback when the editor doesn't convert to stored format).
 * Surrounding SQL single quotes are consumed during replacement (e.g.
 * '{{...}}' -> $N) so the parameter is bound correctly.
 */
export function extractTemplateParameters(
  query: string,
  outputs: NodeOutputs
): { parameterizedQuery: string; paramValues: unknown[] } {
  const paramValues: unknown[] = [];
  let paramIndex = 0;

  // First pass: handle stored format '?{{@nodeId:Label.field}}'? (optional quotes)
  let result = query.replace(
    /'?\{\{@([^:]+):([^}]+)\}\}'?/g,
    (_match: string, nodeId: string, rest: string) => {
      const resolved = resolveTemplateToRawValue(nodeId, rest, outputs);
      paramIndex++;
      paramValues.push(resolved);
      return `$${paramIndex}`;
    }
  );

  // Second pass: handle display format '?{{Label.field}}'? (optional quotes)
  result = result.replace(
    /'?\{\{([^@}][^}]*)\}\}'?/g,
    (_match: string, displayRef: string) => {
      const resolved = resolveDisplayTemplate(displayRef, outputs);
      paramIndex++;
      paramValues.push(resolved);
      return `$${paramIndex}`;
    }
  );

  return { parameterizedQuery: result, paramValues };
}

/**
 * Find a node output by case-insensitive label matching.
 * Used as a fallback when direct node ID lookup fails.
 */
function findOutputByLabel(
  label: string,
  outputs: NodeOutputs
): { label: string; data: unknown } | undefined {
  const normalizedLabel = label.toLowerCase().trim();
  for (const entry of Object.values(outputs)) {
    if (entry.label.toLowerCase().trim() === normalizedLabel) {
      return entry;
    }
  }
  return;
}

/**
 * Resolve a single template to its raw value (preserving native type).
 * Unlike replaceConfigTemplate which stringifies, this returns the native
 * type (number, string, boolean, etc.) for proper SQL parameterization.
 *
 * Falls back to case-insensitive label matching when the node ID lookup
 * fails, keeping parity with the display-format resolution path.
 */
export function resolveTemplateToRawValue(
  nodeId: string,
  rest: string,
  outputs: NodeOutputs
): unknown {
  const trimmedNodeId = nodeId.trim();
  const sanitizedNodeId = trimmedNodeId.replace(/[^a-zA-Z0-9]/g, "_");
  const output = outputs[sanitizedNodeId] ?? outputs[trimmedNodeId];
  const fieldPath = rest.includes(".")
    ? rest.substring(rest.indexOf(".") + 1).trim()
    : "";

  const resolvedOutput = output ?? findOutputByLabelFallback(rest, outputs);

  if (!resolvedOutput) {
    return null;
  }

  const data = resolvedOutput.data;
  if (data === null || data === undefined) {
    return null;
  }

  return resolveFromOutputData(data, fieldPath) ?? null;
}

/**
 * Attempt label-based fallback lookup when node ID is not found in outputs.
 */
function findOutputByLabelFallback(
  rest: string,
  outputs: NodeOutputs
): { label: string; data: unknown } | undefined {
  const dotIndex = rest.indexOf(".");
  const label = dotIndex === -1 ? rest : rest.substring(0, dotIndex);
  return findOutputByLabel(label, outputs);
}
// end keeperhub code //

/**
 * Main workflow executor function
 */
export async function executeWorkflow(input: WorkflowExecutionInput) {
  "use workflow";

  console.log("[Workflow Executor] Starting workflow execution");

  const { nodes, edges, triggerInput = {}, executionId, workflowId } = input;

  console.log("[Workflow Executor] Input:", {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    hasExecutionId: !!executionId,
    workflowId: workflowId || "none",
  });

  const outputs: NodeOutputs = {};
  const results: Record<string, ExecutionResult> = {};

  // Build node and edge maps
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const edgesBySource = new Map<string, string[]>();
  for (const edge of edges) {
    const targets = edgesBySource.get(edge.source) || [];
    targets.push(edge.target);
    edgesBySource.set(edge.source, targets);
  }

  // Find trigger nodes
  const nodesWithIncoming = new Set(edges.map((e) => e.target));
  const triggerNodes = nodes.filter(
    (node) => node.data.type === "trigger" && !nodesWithIncoming.has(node.id)
  );

  console.log(
    "[Workflow Executor] Found",
    triggerNodes.length,
    "trigger nodes"
  );

  // Helper to get a meaningful node name
  function getNodeName(node: WorkflowNode): string {
    if (node.data.label) {
      return node.data.label;
    }
    if (node.data.type === "action") {
      const actionType = node.data.config?.actionType as string;
      if (actionType) {
        // Look up the human-readable label from the step registry;
        // fall back to actionType itself (system actions like "HTTP Request",
        // "Database Query", "Condition" use their type name as the label)
        return getActionLabel(actionType) ?? actionType;
      }
      return "Action";
    }
    if (node.data.type === "trigger") {
      return (node.data.config?.triggerType as string) || "Trigger";
    }
    return node.data.type;
  }

  // Helper to execute a single node
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Node execution requires type checking and error handling
  async function executeNode(nodeId: string, visited: Set<string> = new Set()) {
    console.log("[Workflow Executor] Executing node:", nodeId);

    if (visited.has(nodeId)) {
      console.log("[Workflow Executor] Node already visited, skipping");
      return; // Prevent cycles
    }
    visited.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (!node) {
      console.log("[Workflow Executor] Node not found:", nodeId);
      return;
    }

    // Skip disabled nodes
    if (node.data.enabled === false) {
      console.log("[Workflow Executor] Skipping disabled node:", nodeId);

      // Store null output for disabled nodes so downstream templates don't fail
      const sanitizedNodeId = nodeId.replace(/[^a-zA-Z0-9]/g, "_");
      outputs[sanitizedNodeId] = {
        label: getNodeName(node),
        data: null,
      };

      const nextNodes = edgesBySource.get(nodeId) || [];
      await Promise.all(
        nextNodes.map((nextNodeId) => executeNode(nextNodeId, visited))
      );
      return;
    }

    try {
      let result: ExecutionResult;

      if (node.data.type === "trigger") {
        console.log("[Workflow Executor] Executing trigger node");

        const config = node.data.config || {};
        const triggerType = config.triggerType as string;
        let triggerData: Record<string, unknown> = {
          triggered: true,
          timestamp: Date.now(),
        };

        // Handle webhook mock request for test runs
        if (
          triggerType === "Webhook" &&
          config.webhookMockRequest &&
          (!triggerInput || Object.keys(triggerInput).length === 0)
        ) {
          try {
            const mockData = JSON.parse(config.webhookMockRequest as string);
            triggerData = { ...triggerData, ...mockData };
            console.log(
              "[Workflow Executor] Using webhook mock request data:",
              mockData
            );
          } catch (error) {
            console.error(
              "[Workflow Executor] Failed to parse webhook mock request:",
              error
            );
          }
        } else if (triggerInput && Object.keys(triggerInput).length > 0) {
          // Use provided trigger input
          // start custom keeperhub code //
          // For Event triggers, deserialize { value: string, type: string } objects
          // back to appropriate types (BigInt for uint/int, boolean for bool, etc.)
          if (triggerType === "Event") {
            const deserialized = deserializeEventTriggerData(triggerInput);
            triggerData = {
              ...triggerData,
              ...deserialized,
            };
          } else {
            // For other trigger types, use as-is
            triggerData = { ...triggerData, ...triggerInput };
          }
          // end custom keeperhub code //
        }

        // Build context for logging
        const triggerContext: StepContext = {
          executionId,
          nodeId: node.id,
          nodeName: getNodeName(node),
          nodeType: node.data.type,
        };

        // Execute trigger step (handles logging internally)
        const triggerResult = await triggerStep({
          triggerData,
          _context: triggerContext,
        });

        result = {
          success: triggerResult.success,
          data: triggerResult.data,
        };
      } else if (node.data.type === "action") {
        const config = node.data.config || {};
        const actionType = config.actionType as string | undefined;

        console.log("[Workflow Executor] Executing action node:", actionType);

        // Check if action type is defined
        if (!actionType) {
          result = {
            success: false,
            error: `Action node "${node.data.label || node.id}" has no action type configured`,
          };
          results[nodeId] = result;
          return;
        }

        // Process templates in config, but keep condition and dbQuery unprocessed for special handling
        const configWithoutSpecial = { ...config };
        const originalCondition = config.condition;
        configWithoutSpecial.condition = undefined;
        // start custom keeperhub code //
        const originalDbQuery = config.dbQuery;
        if (actionType === "Database Query") {
          configWithoutSpecial.dbQuery = undefined;
        }
        // end keeperhub code //

        const processedConfig = processTemplates(configWithoutSpecial, outputs);

        // Add back the original condition (unprocessed)
        if (originalCondition !== undefined) {
          processedConfig.condition = originalCondition;
        }

        // start custom keeperhub code //
        // For Database Query, use parameterized queries instead of raw interpolation
        if (
          actionType === "Database Query" &&
          typeof originalDbQuery === "string"
        ) {
          const { parameterizedQuery, paramValues } = extractTemplateParameters(
            originalDbQuery,
            outputs
          );
          processedConfig.dbQuery = parameterizedQuery;
          processedConfig._dbParams = paramValues;
        } else if (
          actionType === "Database Query" &&
          originalDbQuery !== undefined
        ) {
          processedConfig.dbQuery = originalDbQuery;
        }
        // end keeperhub code //

        // Build step context for logging (stepHandler will handle the logging)
        const stepContext: StepContext = {
          executionId,
          nodeId: node.id,
          nodeName: getNodeName(node),
          nodeType: actionType,
        };

        // Execute the action step with stepHandler (logging is handled inside)
        // IMPORTANT: We pass integrationId via config, not actual credentials
        // Steps fetch credentials internally using fetchCredentials(integrationId)
        console.log("[Workflow Executor] Calling executeActionStep");
        const stepResult = await executeActionStep({
          actionType,
          config: processedConfig,
          outputs,
          context: stepContext,
        });

        console.log("[Workflow Executor] Step result received:", {
          hasResult: !!stepResult,
          resultType: typeof stepResult,
        });

        // Check if the step returned an error result
        const isErrorResult =
          stepResult &&
          typeof stepResult === "object" &&
          "success" in stepResult &&
          (stepResult as { success: boolean }).success === false;

        if (isErrorResult) {
          const errorResult = stepResult as { success: false; error?: string };
          result = {
            success: false,
            error:
              errorResult.error ||
              `Step "${actionType}" in node "${node.data.label || node.id}" failed without a specific error message.`,
          };
        } else {
          result = {
            success: true,
            data: stepResult,
          };
        }
      } else {
        console.log("[Workflow Executor] Unknown node type:", node.data.type);
        result = {
          success: false,
          error: `Unknown node type "${node.data.type}" in node "${node.data.label || node.id}". Expected "trigger" or "action".`,
        };
      }

      // Store results
      results[nodeId] = result;

      // Store outputs with sanitized nodeId for template variable lookup
      const sanitizedNodeId = nodeId.replace(/[^a-zA-Z0-9]/g, "_");
      outputs[sanitizedNodeId] = {
        label: getNodeName(node),
        data: result.data,
      };

      console.log("[Workflow Executor] Node execution completed:", {
        nodeId,
        success: result.success,
      });

      // Execute next nodes
      if (result.success) {
        // Check if this is a condition node
        const isConditionNode =
          node.data.type === "action" &&
          node.data.config?.actionType === "Condition";

        if (isConditionNode) {
          // For condition nodes, only execute next nodes if condition is true
          const conditionResult = (result.data as { condition?: boolean })
            ?.condition;
          console.log(
            "[Workflow Executor] Condition node result:",
            conditionResult
          );

          if (conditionResult === true) {
            const nextNodes = edgesBySource.get(nodeId) || [];
            console.log(
              "[Workflow Executor] Condition is true, executing",
              nextNodes.length,
              "next nodes in parallel"
            );
            // Execute all next nodes in parallel
            await Promise.all(
              nextNodes.map((nextNodeId) => executeNode(nextNodeId, visited))
            );
          } else {
            console.log(
              "[Workflow Executor] Condition is false, skipping next nodes"
            );
          }
        } else {
          // For non-condition nodes, execute all next nodes in parallel
          const nextNodes = edgesBySource.get(nodeId) || [];
          console.log(
            "[Workflow Executor] Executing",
            nextNodes.length,
            "next nodes in parallel"
          );
          // Execute all next nodes in parallel
          await Promise.all(
            nextNodes.map((nextNodeId) => executeNode(nextNodeId, visited))
          );
        }
      }
    } catch (error) {
      console.error("[Workflow Executor] Error executing node:", nodeId, error);
      const errorMessage = await getErrorMessageAsync(error);
      const errorResult = {
        success: false,
        error: errorMessage,
      };
      results[nodeId] = errorResult;
      // Note: stepHandler already logged the error for action steps
      // Trigger steps don't throw, so this catch is mainly for unexpected errors
    }
  }

  // Execute from each trigger node in parallel
  try {
    console.log("[Workflow Executor] Starting execution from trigger nodes");
    const workflowStartTime = Date.now();

    // start custom keeperhub code //
    const triggerType = detectTriggerType(nodes);
    const metrics = getMetricsCollector();
    metrics.incrementCounter(MetricNames.WORKFLOW_EXECUTIONS_TOTAL, {
      [LabelKeys.TRIGGER_TYPE]: triggerType,
      ...(workflowId && { [LabelKeys.WORKFLOW_ID]: workflowId }),
    });
    incrementConcurrentExecutions();
    // end keeperhub code //

    await Promise.all(triggerNodes.map((trigger) => executeNode(trigger.id)));

    const finalSuccess = Object.values(results).every((r) => r.success);
    const duration = Date.now() - workflowStartTime;

    // start custom keeperhub code //
    recordWorkflowComplete({
      workflowId,
      executionId,
      triggerType,
      durationMs: duration,
      success: finalSuccess,
      error: Object.values(results).find((r) => !r.success)?.error,
    });
    decrementConcurrentExecutions();
    // end keeperhub code //

    console.log("[Workflow Executor] Workflow execution completed:", {
      success: finalSuccess,
      resultCount: Object.keys(results).length,
      duration,
    });

    // Update execution record if we have an executionId
    if (executionId) {
      try {
        await triggerStep({
          triggerData: {},
          _workflowComplete: {
            executionId,
            status: finalSuccess ? "success" : "error",
            output: Object.values(results).at(-1)?.data,
            error: Object.values(results).find((r) => !r.success)?.error,
            startTime: workflowStartTime,
          },
        });
        console.log("[Workflow Executor] Updated execution record");
      } catch (error) {
        console.error(
          "[Workflow Executor] Failed to update execution record:",
          error
        );
      }
    }

    return {
      success: finalSuccess,
      results,
      outputs,
    };
  } catch (error) {
    console.error(
      "[Workflow Executor] Fatal error during workflow execution:",
      error
    );

    const errorMessage = await getErrorMessageAsync(error);

    // start custom keeperhub code //
    recordWorkflowComplete({
      workflowId,
      executionId,
      triggerType: detectTriggerType(nodes),
      durationMs: 0, // Unknown duration on fatal error
      success: false,
      error: errorMessage,
    });
    decrementConcurrentExecutions();
    // end keeperhub code //

    // Update execution record with error if we have an executionId
    if (executionId) {
      try {
        await triggerStep({
          triggerData: {},
          _workflowComplete: {
            executionId,
            status: "error",
            error: errorMessage,
            startTime: Date.now(),
          },
        });
      } catch (logError) {
        console.error("[Workflow Executor] Failed to log error:", logError);
      }
    }

    return {
      success: false,
      results,
      outputs,
      error: errorMessage,
    };
  }
}
