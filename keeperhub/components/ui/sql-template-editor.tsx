"use client";

import type { Monaco, OnMount } from "@monaco-editor/react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { AlertTriangle } from "lucide-react";
import {
  type MutableRefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { CodeEditor } from "@/components/ui/code-editor";
import { getReadContractOutputFields } from "@/keeperhub/lib/action-output-fields";
import { getTriggerOutputFields } from "@/keeperhub/lib/trigger-output-fields";
import { api } from "@/lib/api-client";
import { getAvailableFields, type NodeOutputs } from "@/lib/utils/template";
import {
  currentWorkflowIdAtom,
  type ExecutionLogEntry,
  edgesAtom,
  executionLogsAtom,
  lastExecutionLogsAtom,
  nodesAtom,
  selectedNodeAtom,
  type WorkflowNode,
  WorkflowTriggerEnum,
} from "@/lib/workflow-store";
import { findActionById } from "@/plugins";

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Returns a ref that always holds the latest value of `state`.
 * Useful for reading current React state inside Monaco callbacks
 * without re-registering the callback on every state change.
 */
function useStableRef<T>(state: T): MutableRefObject<T> {
  const ref = useRef(state);
  useEffect(() => {
    ref.current = state;
  }, [state]);
  return ref;
}

// ---------------------------------------------------------------------------
// Helpers (same logic as template-autocomplete.tsx to keep upstream node
// discovery and field extraction consistent)
// ---------------------------------------------------------------------------

type ExecutionLogsByNodeId = Record<string, ExecutionLogEntry>;

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

function getNodeDisplayName(node: WorkflowNode): string {
  if (node.data.label) {
    return node.data.label;
  }
  if (node.data.type === "action") {
    const actionType = node.data.config?.actionType as string | undefined;
    if (actionType) {
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
}

/**
 * Find display-format template labels that are shared by multiple workflow
 * nodes, which would cause ambiguous resolution at runtime.
 */
function findDuplicateTemplateLabels(
  displayValue: string,
  nodes: WorkflowNode[]
): string[] {
  const displayRefs = [...displayValue.matchAll(/\{\{([^@}][^}]*)\}\}/g)];
  if (displayRefs.length === 0) {
    return [];
  }

  const labelCounts = new Map<string, number>();
  for (const node of nodes) {
    const name = getNodeDisplayName(node).toLowerCase().trim();
    labelCounts.set(name, (labelCounts.get(name) ?? 0) + 1);
  }

  const warnings = new Set<string>();
  for (const match of displayRefs) {
    const ref = match[1];
    const dotIndex = ref.indexOf(".");
    const label = (dotIndex === -1 ? ref : ref.substring(0, dotIndex))
      .toLowerCase()
      .trim();
    const count = labelCounts.get(label);
    if (count && count > 1) {
      const displayLabel = dotIndex === -1 ? ref : ref.substring(0, dotIndex);
      warnings.add(displayLabel.trim());
    }
  }
  return [...warnings];
}

type SchemaField = {
  name: string;
  type: "string" | "number" | "boolean" | "array" | "object";
  itemType?: "string" | "number" | "boolean" | "object";
  fields?: SchemaField[];
  description?: string;
};

function schemaToFields(
  schema: SchemaField[],
  prefix = ""
): Array<{ field: string; description: string }> {
  const fields: Array<{ field: string; description: string }> = [];
  for (const f of schema) {
    const fieldPath = prefix ? `${prefix}.${f.name}` : f.name;
    const typeLabel = f.type === "array" ? `${f.itemType}[]` : f.type;
    fields.push({ field: fieldPath, description: f.description || typeLabel });
    if (f.type === "object" && f.fields && f.fields.length > 0) {
      fields.push(...schemaToFields(f.fields, fieldPath));
    }
    if (
      f.type === "array" &&
      f.itemType === "object" &&
      f.fields &&
      f.fields.length > 0
    ) {
      fields.push(...schemaToFields(f.fields, `${fieldPath}[0]`));
    }
  }
  return fields;
}

type FieldEntry = { field: string; description: string };

function isActionType(
  actionType: string | undefined,
  ...matches: string[]
): boolean {
  if (!actionType) {
    return false;
  }
  return matches.some(
    (m) =>
      actionType === m ||
      actionType.endsWith(`/${m.toLowerCase().replace(/\s+/g, "-")}`)
  );
}

function tryParseSchemaFields(
  raw: string | undefined,
  prefix?: string
): FieldEntry[] | null {
  if (!raw) {
    return null;
  }
  try {
    const schema = JSON.parse(raw) as SchemaField[];
    if (schema.length > 0) {
      return schemaToFields(schema, prefix);
    }
  } catch {
    // invalid JSON, fall through
  }
  return null;
}

function getActionFields(node: WorkflowNode): FieldEntry[] | null {
  const actionType = node.data.config?.actionType as string | undefined;

  if (actionType === "HTTP Request") {
    return [
      { field: "data", description: "Response data" },
      { field: "status", description: "HTTP status code" },
    ];
  }

  if (actionType === "Database Query") {
    const dbSchema = node.data.config?.dbSchema as string | undefined;
    return (
      tryParseSchemaFields(dbSchema) ?? [
        { field: "rows", description: "Query result rows" },
        { field: "count", description: "Number of rows" },
      ]
    );
  }

  if (isActionType(actionType, "Generate Text", "ai-gateway/generate-text")) {
    const aiSchema = node.data.config?.aiSchema as string | undefined;
    const aiFormat = node.data.config?.aiFormat as string | undefined;
    if (aiFormat === "object") {
      return (
        tryParseSchemaFields(aiSchema, "object") ?? [
          { field: "text", description: "Generated text" },
        ]
      );
    }
    return [{ field: "text", description: "Generated text" }];
  }

  if (isActionType(actionType, "Read Contract", "web3/read-contract")) {
    const abi = node.data.config?.abi as string | undefined;
    const abiFunction = node.data.config?.abiFunction as string | undefined;
    const dynamicFields = getReadContractOutputFields(abi, abiFunction);
    if (dynamicFields.length > 0) {
      return dynamicFields;
    }
  }

  if (actionType) {
    const action = findActionById(actionType);
    if (action?.outputFields && action.outputFields.length > 0) {
      return action.outputFields;
    }
  }

  return null;
}

function getTriggerFields(node: WorkflowNode): FieldEntry[] {
  const triggerType = node.data.config?.triggerType as string | undefined;
  const webhookSchema = node.data.config?.webhookSchema as string | undefined;
  const config = node.data.config || {};

  if (triggerType === WorkflowTriggerEnum.EVENT) {
    const fields = getTriggerOutputFields(triggerType, config);
    if (fields.length > 0) {
      return fields;
    }
  }

  if (triggerType === "Webhook") {
    const parsed = tryParseSchemaFields(webhookSchema);
    if (parsed) {
      return parsed;
    }
  }

  if (triggerType) {
    const fields = getTriggerOutputFields(triggerType, config);
    if (fields.length > 0) {
      return fields;
    }
  }

  return [
    { field: "triggered", description: "Trigger status" },
    { field: "timestamp", description: "Trigger timestamp" },
    { field: "input", description: "Input data" },
  ];
}

function getCommonFields(node: WorkflowNode): FieldEntry[] {
  if (node.data.type === "action") {
    return (
      getActionFields(node) ?? [{ field: "data", description: "Output data" }]
    );
  }
  if (node.data.type === "trigger") {
    return getTriggerFields(node);
  }
  return [{ field: "data", description: "Output data" }];
}

function sanitizeNodeId(nodeId: string): string {
  return nodeId.replace(/[^a-zA-Z0-9]/g, "_");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export type SqlTemplateEditorProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  height?: string;
};

export function SqlTemplateEditor({
  value,
  onChange,
  disabled,
  height = "150px",
}: SqlTemplateEditorProps) {
  const [nodes] = useAtom(nodesAtom);
  const [edges] = useAtom(edgesAtom);
  const [selectedNodeId] = useAtom(selectedNodeAtom);
  const executionLogs = useAtomValue(executionLogsAtom);
  const currentWorkflowId = useAtomValue(currentWorkflowIdAtom);
  const lastExecutionLogs = useAtomValue(lastExecutionLogsAtom);
  const setLastExecutionLogs = useSetAtom(lastExecutionLogsAtom);

  // Stable refs for Monaco provider access to current React state
  const nodesRef = useStableRef(nodes);
  const edgesRef = useStableRef(edges);
  const selectedNodeRef = useStableRef(selectedNodeId);
  const executionLogsRef = useStableRef(executionLogs);
  const lastExecutionLogsRef = useStableRef(lastExecutionLogs);
  const currentWorkflowIdRef = useStableRef(currentWorkflowId);
  const lastFetchWorkflowIdRef = useRef<string | null>(null);

  // Template mapping: "Label.field" -> nodeId (for display <-> stored conversion)
  const templateMapRef = useRef(new Map<string, string>());

  // Editor + decoration refs
  // biome-ignore lint/suspicious/noExplicitAny: Monaco editor types are complex and vary across versions
  const editorRef = useRef<any>(null);
  const decorationIdsRef = useRef<string[]>([]);

  // Convert stored value -> display value.
  // Display format: {{Label.field}} (user-friendly, no node IDs)
  // Stored format: {{@nodeId:Label.field}} (used at runtime)
  const displayValue = useMemo(
    () => value.replace(/\{\{@[^:]+:([^}]+)\}\}/g, "{{$1}}"),
    [value]
  );

  // Rebuild template map from stored value (kept separate from useMemo to
  // avoid side effects in a pure computation)
  useEffect(() => {
    const map = new Map<string, string>();
    const pattern = /\{\{@([^:]+):([^}]+)\}\}/g;
    for (const match of value.matchAll(pattern)) {
      map.set(match[2], match[1]);
    }
    templateMapRef.current = map;
  }, [value]);

  // Convert display value -> stored value using template map
  const handleEditorChange = useCallback(
    (newDisplay: string) => {
      const stored = newDisplay.replace(
        /\{\{([^@}][^}]*)\}\}/g,
        (full: string, displayPart: string) => {
          const nodeId = templateMapRef.current.get(displayPart);
          return nodeId ? `{{@${nodeId}:${displayPart}}}` : full;
        }
      );
      onChange(stored);
    },
    [onChange]
  );

  // Lazy-load last execution logs (same pattern as template-autocomplete.tsx)
  // biome-ignore lint/correctness/useExhaustiveDependencies: currentWorkflowIdRef is a stable ref read at async resolution time, not a reactive dependency
  useEffect(() => {
    const alreadyHaveLogs = lastExecutionLogs.workflowId === currentWorkflowId;
    const fetchAlreadyInProgress =
      lastFetchWorkflowIdRef.current === currentWorkflowId;
    if (!currentWorkflowId || alreadyHaveLogs || fetchAlreadyInProgress) {
      return;
    }

    const workflowId = currentWorkflowId;
    lastFetchWorkflowIdRef.current = workflowId;
    let cancelled = false;

    const fetchLogs = async (): Promise<void> => {
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
        const isStillRelevant =
          !cancelled && currentWorkflowIdRef.current === workflowId;
        if (isStillRelevant) {
          setLastExecutionLogs({ workflowId, logs: logsByNodeId });
        }
      } catch {
        // non-blocking
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
  }, [currentWorkflowId, lastExecutionLogs.workflowId, setLastExecutionLogs]);

  // Get upstream nodes for the currently selected node
  function getUpstreamNodes(): WorkflowNode[] {
    const nodeId = selectedNodeRef.current;
    if (!nodeId) {
      return [];
    }
    const allNodes = nodesRef.current;
    const allEdges = edgesRef.current;
    const visited = new Set<string>();
    const upstream: string[] = [];
    const traverse = (id: string): void => {
      if (visited.has(id)) {
        return;
      }
      visited.add(id);
      for (const edge of allEdges) {
        if (edge.target === id) {
          upstream.push(edge.source);
          traverse(edge.source);
        }
      }
    };
    traverse(nodeId);
    return allNodes.filter((n) => upstream.includes(n.id));
  }

  type Suggestion = {
    label: string;
    insertText: string;
    detail?: string;
    nodeId: string;
    field?: string;
  };

  // Resolve the best available output for a node (runtime > last-run > null)
  function resolveNodeOutput(nodeId: string): unknown {
    const runtimeOutput = executionLogsRef.current[nodeId]?.output;
    if (runtimeOutput !== undefined && runtimeOutput !== null) {
      return runtimeOutput;
    }
    const lastLogs =
      lastExecutionLogsRef.current.workflowId === currentWorkflowIdRef.current
        ? lastExecutionLogsRef.current.logs
        : {};
    const lastRunOutput = lastLogs[nodeId]?.output;
    if (lastRunOutput !== undefined && lastRunOutput !== null) {
      return lastRunOutput;
    }
    return null;
  }

  // Build suggestions from runtime/last-run output data.
  // Uses display format for insertText and updates the template map.
  function suggestionsFromOutput(
    node: WorkflowNode,
    nodeName: string,
    output: unknown
  ): Suggestion[] {
    const sanitizedId = sanitizeNodeId(node.id);
    const nodeOutputs: NodeOutputs = {
      [sanitizedId]: { label: nodeName, data: output },
    };
    const runtimeFields = getAvailableFields(nodeOutputs);
    const result: Suggestion[] = [];
    for (const entry of runtimeFields) {
      const fieldPath = entry.fieldPath || entry.field;
      if (!fieldPath) {
        continue;
      }
      const displayKey = `${nodeName}.${fieldPath}`;
      templateMapRef.current.set(displayKey, node.id);
      result.push({
        label: displayKey,
        insertText: `{{${displayKey}}}`,
        nodeId: node.id,
        field: fieldPath,
      });
    }
    return result;
  }

  // Build suggestions from static field definitions.
  // Uses display format for insertText and updates the template map.
  function suggestionsFromStaticFields(
    node: WorkflowNode,
    nodeName: string
  ): Suggestion[] {
    const fields = getCommonFields(node);
    const result: Suggestion[] = [];
    for (const f of fields) {
      const displayKey = `${nodeName}.${f.field}`;
      templateMapRef.current.set(displayKey, node.id);
      result.push({
        label: displayKey,
        insertText: `{{${displayKey}}}`,
        detail: f.description,
        nodeId: node.id,
        field: f.field,
      });
    }
    return result;
  }

  // Build completion suggestions from upstream nodes
  function buildSuggestions(): Suggestion[] {
    const upstreamNodes = getUpstreamNodes();
    const suggestions: Suggestion[] = [];

    for (const node of upstreamNodes) {
      const nodeName = getNodeDisplayName(node);
      const output = resolveNodeOutput(node.id);
      const nodeSuggestions =
        output !== null
          ? suggestionsFromOutput(node, nodeName, output)
          : suggestionsFromStaticFields(node, nodeName);
      suggestions.push(...nodeSuggestions);
    }

    return suggestions;
  }

  // Update decorations for display-format template patterns {{...}}
  const updateDecorations = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    const model = editor.getModel();
    if (!model) {
      return;
    }

    const text = model.getValue();
    const templatePattern = /\{\{([^}]+)\}\}/g;
    // biome-ignore lint/suspicious/noExplicitAny: Monaco decoration types vary across versions
    const newDecorations: any[] = [];

    for (const match of text.matchAll(templatePattern)) {
      const start = model.getPositionAt(match.index);
      const end = model.getPositionAt(match.index + match[0].length);
      newDecorations.push({
        range: {
          startLineNumber: start.lineNumber,
          startColumn: start.column,
          endLineNumber: end.lineNumber,
          endColumn: end.column,
        },
        options: {
          inlineClassName: "sql-template-badge",
          hoverMessage: { value: `Template: ${match[1]}` },
        },
      });
    }

    decorationIdsRef.current = editor.deltaDecorations(
      decorationIdsRef.current,
      newDecorations
    );
  }, []);

  useEffect(() => {
    updateDecorations();
  }, [updateDecorations]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: buildSuggestions reads from refs to always get current state; adding it would cause Monaco to re-mount on every render
  const handleMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;

      // Initial decoration pass
      updateDecorations();

      // Update decorations on every content change
      editor.onDidChangeModelContent(() => {
        updateDecorations();
      });

      // Register completion provider for @ trigger
      const disposable = monaco.languages.registerCompletionItemProvider(
        "sql",
        {
          triggerCharacters: ["@"],
          provideCompletionItems: (
            model: ReturnType<Monaco["editor"]["createModel"]>,
            position: { lineNumber: number; column: number }
          ) => {
            // Only provide suggestions for our editor instance (the
            // provider is registered at the language level, not per-editor)
            if (model !== editorRef.current?.getModel()) {
              return { suggestions: [] };
            }

            const textUntilPosition = model.getValueInRange({
              startLineNumber: position.lineNumber,
              startColumn: 1,
              endLineNumber: position.lineNumber,
              endColumn: position.column,
            });

            // Find the last @ that is not inside a completed template
            const atIndex = findActiveAtIndex(textUntilPosition);
            if (atIndex === -1) {
              return { suggestions: [] };
            }

            const range = {
              startLineNumber: position.lineNumber,
              startColumn: atIndex + 1, // 1-based
              endLineNumber: position.lineNumber,
              endColumn: position.column,
            };

            const items = buildSuggestions();
            const suggestions = items.map((item) => ({
              label: item.label,
              kind: monaco.languages.CompletionItemKind.Variable,
              insertText: item.insertText,
              detail: item.detail || "",
              range,
              filterText: `@${item.label}`,
              sortText: `0-${item.label}`,
            }));

            return { suggestions };
          },
        }
      );

      // Cleanup on unmount
      editor.onDidDispose(() => {
        disposable.dispose();
      });
    },
    [updateDecorations]
  );

  // Detect display-format templates referencing labels shared by multiple
  // nodes in the workflow (ambiguous resolution when nodes keep default labels).
  const duplicateLabelWarnings = useMemo(
    () => findDuplicateTemplateLabels(displayValue, nodes),
    [displayValue, nodes]
  );

  return (
    <>
      <div className="overflow-hidden rounded-md border">
        <CodeEditor
          defaultLanguage="sql"
          height={height}
          onChange={(v) => handleEditorChange(v || "")}
          onMount={handleMount}
          options={{
            minimap: { enabled: false },
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            fontSize: 12,
            readOnly: disabled,
            wordWrap: "off",
          }}
          value={displayValue}
        />
      </div>
      {duplicateLabelWarnings.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-2 text-xs text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Multiple nodes share the label{" "}
            {duplicateLabelWarnings.map((label, i) => (
              <span key={label}>
                {i > 0 && ", "}
                <strong>{label}</strong>
              </span>
            ))}
            . Rename nodes to unique labels to ensure correct value resolution.
          </span>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Utility: find the position of an active "@" that is not inside a completed
// template pattern ({{...}}).
// ---------------------------------------------------------------------------
function findActiveAtIndex(text: string): number {
  const templatePattern = /\{\{[^}]+\}\}/g;
  const ranges: Array<{ start: number; end: number }> = [];
  for (const m of text.matchAll(templatePattern)) {
    ranges.push({ start: m.index, end: m.index + m[0].length });
  }

  // Walk backwards to find the last @ not inside any template
  for (let i = text.length - 1; i >= 0; i--) {
    if (text[i] === "@") {
      const isInsideTemplate = ranges.some((r) => i >= r.start && i < r.end);
      if (!isInsideTemplate) {
        return i;
      }
    }
  }
  return -1;
}
