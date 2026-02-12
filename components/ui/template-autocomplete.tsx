"use client";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BUILTIN_NODE_ID, BUILTIN_NODE_LABEL, BUILTIN_VARIABLE_FIELDS } from "@/keeperhub/lib/builtin-variables";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  getAvailableFields,
  type NodeOutputs,
} from "@/lib/utils/template";
import {
  currentWorkflowIdAtom,
  edgesAtom,
  executionLogsAtom,
  type ExecutionLogEntry,
  lastExecutionLogsAtom,
  nodesAtom,
  WorkflowTriggerEnum,
  type WorkflowNode,
} from "@/lib/workflow-store";
import { findActionById } from "@/plugins";
import { getTriggerOutputFields } from "@/keeperhub/lib/trigger-output-fields";
// start custom keeperhub code //
import { getReadContractOutputFields } from "@/keeperhub/lib/action-output-fields";

/** Map of nodeId -> execution log entry. Used for last-run fallback in template autocomplete. */
type ExecutionLogsByNodeId = Record<string, ExecutionLogEntry>;

/** Build nodeId -> log entry map from API execution logs response. */
function buildExecutionLogsMap(
  logs: Array<{
    nodeId: string;
    nodeName: string;
    nodeType: string;
    status: "pending" | "running" | "success" | "error";
    output?: unknown;
  }>
): ExecutionLogsByNodeId {
  const map: ExecutionLogsByNodeId = {};
  for (const log of logs) {
    map[log.nodeId] = {
      nodeId: log.nodeId,
      nodeName: log.nodeName,
      nodeType: log.nodeType,
      status: log.status,
      output: log.output,
    };
  }
  return map;
}
// end custom keeperhub code //

type TemplateAutocompleteProps = {
  isOpen: boolean;
  position: { top: number; left: number };
  onSelect: (template: string) => void;
  onClose: () => void;
  currentNodeId?: string;
  filter?: string;
};

type SchemaField = {
  name: string;
  type: "string" | "number" | "boolean" | "array" | "object";
  itemType?: "string" | "number" | "boolean" | "object";
  fields?: SchemaField[];
  description?: string;
};

// Helper to get a display name for a node
const getNodeDisplayName = (node: WorkflowNode): string => {
  if (node.data.label) {
    return node.data.label;
  }

  if (node.data.type === "action") {
    const actionType = node.data.config?.actionType as string | undefined;
    if (actionType) {
      // Look up human-readable label from plugin registry
      const action = findActionById(actionType);
      if (action?.label) {
        return action.label;
      }
    }
    return actionType || "HTTP Request";
  }

  if (node.data.type === "trigger") {
    const triggerType = node.data.config?.triggerType as string | undefined;
    return triggerType || "Manual";
  }

  return "Node";
};

// Convert schema fields to field descriptions
const schemaToFields = (
  schema: SchemaField[],
  prefix = ""
): Array<{ field: string; description: string }> => {
  const fields: Array<{ field: string; description: string }> = [];

  for (const schemaField of schema) {
    const fieldPath = prefix
      ? `${prefix}.${schemaField.name}`
      : schemaField.name;
    const typeLabel =
      schemaField.type === "array"
        ? `${schemaField.itemType}[]`
        : schemaField.type;
    const description = schemaField.description || `${typeLabel}`;

    fields.push({ field: fieldPath, description });

    // Add nested fields for objects
    if (
      schemaField.type === "object" &&
      schemaField.fields &&
      schemaField.fields.length > 0
    ) {
      fields.push(...schemaToFields(schemaField.fields, fieldPath));
    }

    // Add nested fields for array items that are objects
    if (
      schemaField.type === "array" &&
      schemaField.itemType === "object" &&
      schemaField.fields &&
      schemaField.fields.length > 0
    ) {
      const arrayItemPath = `${fieldPath}[0]`;
      fields.push(...schemaToFields(schemaField.fields, arrayItemPath));
    }
  }

  return fields;
};

// Helper to check if action type matches (supports both namespaced IDs and legacy labels)
const isActionType = (
  actionType: string | undefined,
  ...matches: string[]
): boolean => {
  if (!actionType) return false;
  return matches.some(
    (match) =>
      actionType === match ||
      actionType.endsWith(`/${match.toLowerCase().replace(/\s+/g, "-")}`)
  );
};

// Get common fields based on node action type
const getCommonFields = (node: WorkflowNode) => {
  const actionType = node.data.config?.actionType as string | undefined;

  // Special handling for dynamic outputs (system actions and schema-based)
  if (actionType === "HTTP Request") {
    return [
      { field: "data", description: "Response data" },
      { field: "status", description: "HTTP status code" },
    ];
  }

  if (actionType === "Database Query") {
    const dbSchema = node.data.config?.dbSchema as string | undefined;
    if (dbSchema) {
      try {
        const schema = JSON.parse(dbSchema) as SchemaField[];
        if (schema.length > 0) {
          return schemaToFields(schema);
        }
      } catch {
        // If schema parsing fails, fall through to default fields
      }
    }
    return [
      { field: "rows", description: "Query result rows" },
      { field: "count", description: "Number of rows" },
    ];
  }

  // AI Gateway generate-text has dynamic output based on format/schema
  if (isActionType(actionType, "Generate Text", "ai-gateway/generate-text")) {
    const aiFormat = node.data.config?.aiFormat as string | undefined;
    const aiSchema = node.data.config?.aiSchema as string | undefined;

    if (aiFormat === "object" && aiSchema) {
      try {
        const schema = JSON.parse(aiSchema) as SchemaField[];
        if (schema.length > 0) {
          return schemaToFields(schema, "object");
        }
      } catch {
        // If schema parsing fails, fall through to default fields
      }
    }
    return [{ field: "text", description: "Generated text" }];
  }

  // start custom keeperhub code //
  // Check for Read Contract action with dynamic outputs based on ABI
  // This must be BEFORE the plugin outputFields check to override static fields
  if (isActionType(actionType, "Read Contract", "web3/read-contract")) {
    const abi = node.data.config?.abi as string | undefined;
    const abiFunction = node.data.config?.abiFunction as string | undefined;
    const dynamicFields = getReadContractOutputFields(abi, abiFunction);
    if (dynamicFields.length > 0) {
      return dynamicFields;
    }
  }
  // end keeperhub code //

  // Check if the plugin defines output fields
  if (actionType) {
    const action = findActionById(actionType);
    if (action?.outputFields && action.outputFields.length > 0) {
      return action.outputFields;
    }
  }

  // Trigger fields
  if (node.data.type === "trigger") {
    const triggerType = node.data.config?.triggerType as string | undefined;
    const webhookSchema = node.data.config?.webhookSchema as string | undefined;

    // start custom keeperhub code //
    // Use keeperhub trigger output fields function for Event triggers
    if (triggerType === WorkflowTriggerEnum.EVENT) {
      const outputFields = getTriggerOutputFields(
        triggerType,
        node.data.config || {}
      );
      if (outputFields.length > 0) {
        return outputFields;
      }
    }
    // end custom keeperhub code //

    if (triggerType === "Webhook" && webhookSchema) {
      try {
        const schema = JSON.parse(webhookSchema) as SchemaField[];
        if (schema.length > 0) {
          return schemaToFields(schema);
        }
      } catch {
        // If schema parsing fails, fall through to default fields
      }
    }

    // start custom keeperhub code //
    // Use keeperhub trigger output fields function for other trigger types
    if (triggerType) {
      const outputFields = getTriggerOutputFields(
        triggerType,
        node.data.config || {}
      );
      if (outputFields.length > 0) {
        return outputFields;
      }
    }
    // end custom keeperhub code //

    return [
      { field: "triggered", description: "Trigger status" },
      { field: "timestamp", description: "Trigger timestamp" },
      { field: "input", description: "Input data" },
    ];
  }

  return [{ field: "data", description: "Output data" }];
};

// Sanitize nodeId the same way as workflow executor for consistent lookup
function sanitizeNodeId(nodeId: string): string {
  return nodeId.replace(/[^a-zA-Z0-9]/g, "_");
}

export function TemplateAutocomplete({
  isOpen,
  position,
  onSelect,
  onClose,
  currentNodeId,
  filter = "",
}: TemplateAutocompleteProps) {
  const [nodes] = useAtom(nodesAtom);
  const [edges] = useAtom(edgesAtom);
  // start custom keeperhub code //
  const executionLogs = useAtomValue(executionLogsAtom);
  const currentWorkflowId = useAtomValue(currentWorkflowIdAtom);
  const lastExecutionLogs = useAtomValue(lastExecutionLogsAtom);
  const setLastExecutionLogs = useSetAtom(lastExecutionLogsAtom);
  const currentWorkflowIdRef = useRef<string | null>(null);
  const lastFetchWorkflowIdRef = useRef<string | null>(null);
  currentWorkflowIdRef.current = currentWorkflowId;
  // end custom keeperhub code //
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  // Ensure we're mounted before trying to use portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // start custom keeperhub code //
  // Lazy-load last execution logs when autocomplete opens and we have no logs for this workflow.
  // Race guards: (1) lastFetchWorkflowIdRef prevents double-fetch for same workflow;
  // (2) only set state when currentWorkflowIdRef.current === workflowId so we never apply stale data after navigation.
  useEffect(() => {
    const alreadyHaveLogs =
      lastExecutionLogs.workflowId === currentWorkflowId;
    const fetchAlreadyInProgress =
      lastFetchWorkflowIdRef.current === currentWorkflowId;
    const shouldNotFetch =
      !isOpen ||
      !currentWorkflowId ||
      alreadyHaveLogs ||
      fetchAlreadyInProgress;

    if (shouldNotFetch) return;

    const workflowId = currentWorkflowId;
    lastFetchWorkflowIdRef.current = workflowId;

    let cancelled = false;

    const fetchLogs = async () => {
      try {
        const executions = await api.workflow.getExecutions(workflowId);
        if (cancelled) {
          return;
        }
        const latest = executions[0];
        if (!latest?.id) {
          lastFetchWorkflowIdRef.current = null;
          return;
        }

        const { logs } = await api.workflow.getExecutionLogs(latest.id);
        if (cancelled) {
          return;
        }

        const logsByNodeId = buildExecutionLogsMap(logs);

        if (
          !cancelled &&
          currentWorkflowIdRef.current === workflowId
        ) {
          setLastExecutionLogs({ workflowId, logs: logsByNodeId });
        }
      } catch {
        // Non-blocking: keep getCommonFields fallback
      } finally {
        if (lastFetchWorkflowIdRef.current === workflowId) {
          lastFetchWorkflowIdRef.current = null;
        }
      }
    };

    fetchLogs();

    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    currentWorkflowId,
    lastExecutionLogs.workflowId,
    setLastExecutionLogs,
  ]);
  // end custom keeperhub code //

  // Find all nodes that come before the current node
  const getUpstreamNodes = () => {
    if (!currentNodeId) {
      return [];
    }

    const visited = new Set<string>();
    const upstream: string[] = [];

    const traverse = (nodeId: string) => {
      if (visited.has(nodeId)) {
        return;
      }
      visited.add(nodeId);

      const incomingEdges = edges.filter((edge) => edge.target === nodeId);
      for (const edge of incomingEdges) {
        upstream.push(edge.source);
        traverse(edge.source);
      }
    };

    traverse(currentNodeId);

    return nodes.filter((node) => upstream.includes(node.id));
  };

  const upstreamNodes = getUpstreamNodes();

  // Build list of all available options (nodes + their fields)
  const options: Array<{
    type: "node" | "field";
    nodeId: string;
    nodeName: string;
    field?: string;
    description?: string;
    template: string;
  }> = [];

  for (const node of upstreamNodes) {
    const nodeName = getNodeDisplayName(node);
    // start custom keeperhub code //
    // 1) Prefer current execution in runtime; 2) else last execution output; 3) else getCommonFields
    const runtimeOutput = executionLogs[node.id]?.output;
    const hasRuntimeOutput =
      runtimeOutput !== undefined && runtimeOutput !== null;
    const lastLogsForWorkflow =
      lastExecutionLogs.workflowId === currentWorkflowId
        ? lastExecutionLogs.logs
        : {};
    const lastRunOutput = lastLogsForWorkflow[node.id]?.output;
    const hasLastRunOutput =
      lastRunOutput !== undefined && lastRunOutput !== null;

    const outputToUse = hasRuntimeOutput
      ? runtimeOutput
      : hasLastRunOutput
        ? lastRunOutput
        : null;

    if (outputToUse !== null) {
      const sanitizedId = sanitizeNodeId(node.id);
      const nodeOutputs: NodeOutputs = {
        [sanitizedId]: {
          label: nodeName,
          data: outputToUse,
        },
      };
      const runtimeFields = getAvailableFields(nodeOutputs);

      options.push({
        type: "node",
        nodeId: node.id,
        nodeName,
        template: `{{@${node.id}:${nodeName}}}`,
      });

      for (const entry of runtimeFields) {
        if (entry.fieldPath === "" && entry.field === "") {
          continue;
        }
        const fieldPath = entry.fieldPath || entry.field;
        options.push({
          type: "field",
          nodeId: node.id,
          nodeName,
          field: fieldPath,
          description: undefined,
          template: `{{@${node.id}:${nodeName}.${fieldPath}}}`,
        });
      }
      // end custom keeperhub code //
    } else {
      const fields = getCommonFields(node);

      // Add node itself
      options.push({
        type: "node",
        nodeId: node.id,
        nodeName,
        template: `{{@${node.id}:${nodeName}}}`,
      });

      // Add fields
      for (const field of fields) {
        options.push({
          type: "field",
          nodeId: node.id,
          nodeName,
          field: field.field,
          description: field.description,
          template: `{{@${node.id}:${nodeName}.${field.field}}}`,
        });
      }
    }
  }

  // start custom keeperhub code //
  // Built-in system variables (available to all nodes, evaluated at execution time)
  for (const field of BUILTIN_VARIABLE_FIELDS) {
    options.push({
      type: "field",
      nodeId: BUILTIN_NODE_ID,
      nodeName: BUILTIN_NODE_LABEL,
      field: field.field,
      description: field.description,
      template: `{{@${BUILTIN_NODE_ID}:${BUILTIN_NODE_LABEL}.${field.field}}}`,
    });
  }
  // end keeperhub code //

  // Filter options based on search term
  const filteredOptions = filter
    ? options.filter(
        (opt) =>
          opt.nodeName.toLowerCase().includes(filter.toLowerCase()) ||
          (opt.field && opt.field.toLowerCase().includes(filter.toLowerCase()))
      )
    : options;

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredOptions.length - 1 ? prev + 1 : prev
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        case "Enter":
          e.preventDefault();
          if (filteredOptions[selectedIndex]) {
            onSelect(filteredOptions[selectedIndex].template);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredOptions, selectedIndex, onSelect, onClose]);

  // Scroll selected item into view (options live inside the scrollable list, not menuRef)
  useEffect(() => {
    const list = listRef.current;
    if (!list) {
      return
    };
    const selectedElement = list.children[selectedIndex] as HTMLElement;
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex]);

  if (!isOpen || filteredOptions.length === 0 || !mounted) {
    return null;
  }

  // Ensure position is within viewport
  const adjustedPosition = {
    top: Math.min(position.top, window.innerHeight - 300), // Keep 300px from bottom
    left: Math.min(position.left, window.innerWidth - 320), // Keep menu (320px wide) within viewport
  };

  const menuContent = (
    <div
      className="fixed z-9999 w-80 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
      ref={menuRef}
      style={{
        top: `${adjustedPosition.top}px`,
        left: `${adjustedPosition.left}px`,
      }}
    >
      <div ref={listRef} className="max-h-60 overflow-y-auto">
        {filteredOptions.map((option, index) => (
          <div
            className={cn(
              "flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-sm transition-colors",
              index === selectedIndex
                ? "bg-accent text-accent-foreground"
                : "hover:bg-accent/50"
            )}
            key={`${option.nodeId}-${option.field || "root"}`}
            onClick={() => onSelect(option.template)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <div className="flex-1">
              <div className="font-medium">
                {option.type === "node" ? (
                  option.nodeName
                ) : (
                  <>
                    <span className="text-muted-foreground">
                      {option.nodeName}.
                    </span>
                    {option.field}
                  </>
                )}
              </div>
              {option.description && (
                <div className="text-muted-foreground text-xs">
                  {option.description}
                </div>
              )}
            </div>
            {index === selectedIndex && <Check className="h-4 w-4" />}
          </div>
        ))}
      </div>
    </div>
  );

  // Use portal to render at document root to avoid clipping issues
  return createPortal(menuContent, document.body);
}

