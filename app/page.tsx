"use client";

import { ReactFlowProvider } from "@xyflow/react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { NodeConfigPanel } from "@/components/workflow/node-config-panel";
import { WorkflowCanvas } from "@/components/workflow/workflow-canvas";
import { WorkflowToolbar } from "@/components/workflow/workflow-toolbar";
import { workflowApi } from "@/lib/workflow-api";
import {
  currentVercelProjectIdAtom,
  currentVercelProjectNameAtom,
  currentWorkflowIdAtom,
  currentWorkflowNameAtom,
  edgesAtom,
  isExecutingAtom,
  isSavingAtom,
  nodesAtom,
  updateNodeDataAtom,
} from "@/lib/workflow-store";

const Home = () => {
  const [isExecuting, setIsExecuting] = useAtom(isExecutingAtom);
  const setIsSaving = useSetAtom(isSavingAtom);
  const nodes = useAtomValue(nodesAtom);
  const edges = useAtomValue(edgesAtom);
  const [currentWorkflowId, setCurrentWorkflowId] = useAtom(
    currentWorkflowIdAtom
  );
  const setNodes = useSetAtom(nodesAtom);
  const setEdges = useSetAtom(edgesAtom);
  const setCurrentWorkflowName = useSetAtom(currentWorkflowNameAtom);
  const setCurrentVercelProjectId = useSetAtom(currentVercelProjectIdAtom);
  const setCurrentVercelProjectName = useSetAtom(currentVercelProjectNameAtom);
  const updateNodeData = useSetAtom(updateNodeDataAtom);

  // Ensure state is cleared on mount (landing page should always be empty)
  useEffect(() => {
    setNodes([]);
    setEdges([]);
    setCurrentWorkflowId(null);
    setCurrentWorkflowName("Untitled Workflow");
    setCurrentVercelProjectId(null);
    setCurrentVercelProjectName(null);
  }, [
    setNodes,
    setEdges,
    setCurrentWorkflowId,
    setCurrentWorkflowName,
    setCurrentVercelProjectId,
    setCurrentVercelProjectName,
  ]);

  // Keyboard shortcuts
  const handleSave = useCallback(async () => {
    if (!currentWorkflowId) {
      return;
    }
    setIsSaving(true);
    try {
      await workflowApi.update(currentWorkflowId, { nodes, edges });
    } catch (error) {
      console.error("Failed to save workflow:", error);
      toast.error("Failed to save workflow");
    } finally {
      setIsSaving(false);
    }
  }, [currentWorkflowId, nodes, edges, setIsSaving]);

  // Helper to update node statuses
  const updateAllNodeStatuses = useCallback(
    (status: "idle" | "error" | "success") => {
      for (const node of nodes) {
        updateNodeData({ id: node.id, data: { status } });
      }
    },
    [nodes, updateNodeData]
  );

  // Helper to execute workflow API call
  const executeWorkflowApi = useCallback(async (workflowId: string) => {
    const response = await fetch(`/api/workflows/${workflowId}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: {} }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to execute workflow");
    }

    return await response.json();
  }, []);

  const handleRun = useCallback(async () => {
    if (isExecuting || nodes.length === 0 || !currentWorkflowId) {
      return;
    }

    setIsExecuting(true);

    // Set all nodes to idle first
    updateAllNodeStatuses("idle");

    try {
      const result = await executeWorkflowApi(currentWorkflowId);

      // Update all nodes based on result
      const resultStatus = result.status === "error" ? "error" : "success";
      updateAllNodeStatuses(resultStatus);
    } catch (error) {
      console.error("Failed to execute workflow:", error);
      updateAllNodeStatuses("error");
    } finally {
      setIsExecuting(false);
    }
  }, [
    isExecuting,
    nodes.length,
    currentWorkflowId,
    setIsExecuting,
    updateAllNodeStatuses,
    executeWorkflowApi,
  ]);

  // Helper to check if target is an input element
  const isInputElement = useCallback(
    (target: HTMLElement) =>
      target.tagName === "INPUT" || target.tagName === "TEXTAREA",
    []
  );

  // Helper to check if we're in Monaco editor
  const isInMonacoEditor = useCallback(
    (target: HTMLElement) => target.closest(".monaco-editor") !== null,
    []
  );

  // Helper to handle save shortcut
  const handleSaveShortcut = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        e.stopPropagation();
        handleSave();
        return true;
      }
      return false;
    },
    [handleSave]
  );

  // Helper to handle run shortcut
  const handleRunShortcut = useCallback(
    (e: KeyboardEvent, target: HTMLElement) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        if (!(isInputElement(target) || isInMonacoEditor(target))) {
          e.preventDefault();
          e.stopPropagation();
          handleRun();
        }
        return true;
      }
      return false;
    },
    [handleRun, isInputElement, isInMonacoEditor]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;

      // Handle save shortcut
      if (handleSaveShortcut(e)) {
        return;
      }

      // Handle run shortcut
      if (handleRunShortcut(e, target)) {
        return;
      }
    };

    // Use capture phase only to ensure we can intercept before other handlers
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [handleSaveShortcut, handleRunShortcut]);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden">
      <main className="relative size-full overflow-hidden">
        <ReactFlowProvider>
          <WorkflowToolbar workflowId={currentWorkflowId ?? undefined} />
          <WorkflowCanvas />
        </ReactFlowProvider>
      </main>
      <NodeConfigPanel />
    </div>
  );
};

export default Home;
