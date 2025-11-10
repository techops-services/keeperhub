"use client";

import { ReactFlowProvider } from "@xyflow/react";
import { useAtom, useSetAtom } from "jotai";
import { useRouter, useSearchParams } from "next/navigation";
import { use, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { generate } from "@/app/actions/ai/generate";
import { NodeConfigPanel } from "@/components/workflow/node-config-panel";
import { WorkflowCanvas } from "@/components/workflow/workflow-canvas";
import { WorkflowToolbar } from "@/components/workflow/workflow-toolbar";
import { Button } from "@/components/ui/button";
import { workflowApi } from "@/lib/workflow-api";
import {
  currentVercelProjectIdAtom,
  currentVercelProjectNameAtom,
  currentWorkflowIdAtom,
  currentWorkflowNameAtom,
  edgesAtom,
  hasUnsavedChangesAtom,
  isExecutingAtom,
  isGeneratingAtom,
  isSavingAtom,
  nodesAtom,
  selectedNodeAtom,
  updateNodeDataAtom,
  workflowNotFoundAtom,
} from "@/lib/workflow-store";

type WorkflowPageProps = {
  params: Promise<{ workflowId: string }>;
};

const WorkflowEditor = ({ params }: WorkflowPageProps) => {
  const { workflowId } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useAtom(isGeneratingAtom);
  const [isExecuting, setIsExecuting] = useAtom(isExecutingAtom);
  const [isSaving, setIsSaving] = useAtom(isSavingAtom);
  const [nodes] = useAtom(nodesAtom);
  const [edges] = useAtom(edgesAtom);
  const [currentWorkflowId] = useAtom(currentWorkflowIdAtom);
  const setNodes = useSetAtom(nodesAtom);
  const setEdges = useSetAtom(edgesAtom);
  const setCurrentWorkflowId = useSetAtom(currentWorkflowIdAtom);
  const setCurrentWorkflowName = useSetAtom(currentWorkflowNameAtom);
  const setCurrentVercelProjectId = useSetAtom(currentVercelProjectIdAtom);
  const setCurrentVercelProjectName = useSetAtom(currentVercelProjectNameAtom);
  const updateNodeData = useSetAtom(updateNodeDataAtom);
  const setSelectedNodeId = useSetAtom(selectedNodeAtom);
  const setHasUnsavedChanges = useSetAtom(hasUnsavedChangesAtom);
  const [workflowNotFound, setWorkflowNotFound] = useAtom(workflowNotFoundAtom);

  useEffect(() => {
    const loadWorkflowData = async () => {
      const isGeneratingParam = searchParams?.get("generating") === "true";
      const storedPrompt = sessionStorage.getItem("ai-prompt");
      const storedWorkflowId = sessionStorage.getItem("generating-workflow-id");

      // Check if state is already loaded for this workflow (e.g., after creation)
      // If currentWorkflowId matches and we have nodes, the state is fresh
      if (currentWorkflowId === workflowId && nodes.length > 0) {
        // State is already loaded, no need to fetch from server
        return;
      }

      // Check if we should generate
      if (
        isGeneratingParam &&
        storedPrompt &&
        storedWorkflowId === workflowId
      ) {
        // Clear session storage
        sessionStorage.removeItem("ai-prompt");
        sessionStorage.removeItem("generating-workflow-id");

        // Set generating state
        setIsGenerating(true);
        setCurrentWorkflowId(workflowId);
        setCurrentWorkflowName("AI Generated Workflow");

        try {
          // Generate workflow using AI
          const workflowData = await generate(storedPrompt);

          // Update nodes and edges as they come in
          setNodes(workflowData.nodes || []);
          setEdges(workflowData.edges || []);
          setCurrentWorkflowName(workflowData.name || "AI Generated Workflow");

          // Sync selected node if any node is selected
          const selectedNode = workflowData.nodes?.find(
            (n: { selected?: boolean }) => n.selected
          );
          if (selectedNode) {
            setSelectedNodeId(selectedNode.id);
          }

          // Save to database
          await workflowApi.update(workflowId, {
            name: workflowData.name,
            description: workflowData.description,
            nodes: workflowData.nodes,
            edges: workflowData.edges,
          });
        } catch (error) {
          console.error("Failed to generate workflow:", error);
          alert("Failed to generate workflow");
        } finally {
          setIsGenerating(false);
        }
      } else {
        // Normal workflow loading
        try {
          const workflow = await workflowApi.getById(workflowId);
          
          // Check if workflow was not found
          if (!workflow) {
            setWorkflowNotFound(true);
            return;
          }
          
          setNodes(workflow.nodes);
          setEdges(workflow.edges);
          setCurrentWorkflowId(workflow.id);
          setCurrentWorkflowName(workflow.name);
          setCurrentVercelProjectId(workflow.vercelProjectId || null);
          setCurrentVercelProjectName(workflow.vercelProject?.name || null);
          
          // Reset unsaved changes flag after loading
          setHasUnsavedChanges(false);
          
          // Reset workflow not found state on successful load
          setWorkflowNotFound(false);

          // Sync selected node if any node is selected
          const selectedNode = workflow.nodes.find((n) => n.selected);
          if (selectedNode) {
            setSelectedNodeId(selectedNode.id);
          }
        } catch (error) {
          console.error("Failed to load workflow:", error);
          // For other errors, show a toast
          toast.error("Failed to load workflow");
        }
      }
    };

    loadWorkflowData();
  }, [
    workflowId,
    searchParams,
    currentWorkflowId,
    setCurrentWorkflowId,
    setCurrentWorkflowName,
    setCurrentVercelProjectId,
    setCurrentVercelProjectName,
    setNodes,
    setEdges,
    setIsGenerating,
    setSelectedNodeId,
    setHasUnsavedChanges,
    setWorkflowNotFound,
  ]);

  // Keyboard shortcuts
  const handleSave = useCallback(async () => {
    if (!currentWorkflowId || isGenerating) return;
    setIsSaving(true);
    try {
      await workflowApi.update(currentWorkflowId, { nodes, edges });
      setHasUnsavedChanges(false);
      toast.success("Workflow saved");
    } catch (error) {
      console.error("Failed to save workflow:", error);
      toast.error("Failed to save workflow");
    } finally {
      setIsSaving(false);
    }
  }, [currentWorkflowId, nodes, edges, isGenerating, setIsSaving, setHasUnsavedChanges]);

  const handleRun = useCallback(async () => {
    if (isExecuting || nodes.length === 0 || isGenerating || !currentWorkflowId)
      return;

    setIsExecuting(true);

    // Set all nodes to idle first
    nodes.forEach((node) => {
      updateNodeData({ id: node.id, data: { status: "idle" } });
    });

    try {
      // Call the server API to execute the workflow
      const response = await fetch(
        `/api/workflows/${currentWorkflowId}/execute`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: {} }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to execute workflow");
      }

      const result = await response.json();

      // Update all nodes based on result
      nodes.forEach((node) => {
        updateNodeData({
          id: node.id,
          data: { status: result.status === "error" ? "error" : "success" },
        });
      });
    } catch (error) {
      console.error("Failed to execute workflow:", error);

      // Mark all nodes as error
      nodes.forEach((node) => {
        updateNodeData({ id: node.id, data: { status: "error" } });
      });
    } finally {
      setIsExecuting(false);
    }
  }, [
    isExecuting,
    nodes,
    isGenerating,
    currentWorkflowId,
    setIsExecuting,
    updateNodeData,
  ]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA";

      // Cmd+S or Ctrl+S to save (works everywhere, including inputs)
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        e.stopPropagation();
        handleSave();
        return;
      }

      // Cmd+Enter or Ctrl+Enter to run (skip if typing in input/textarea)
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        if (!isInput) {
          e.preventDefault();
          e.stopPropagation();
          handleRun();
        }
        return;
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [handleSave, handleRun]);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden">
          <WorkflowToolbar workflowId={workflowId} />
          <main className="relative size-full overflow-hidden">
            <ReactFlowProvider>
              <WorkflowCanvas />
            </ReactFlowProvider>
        
        {workflowNotFound && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-lg border bg-background p-8 text-center shadow-lg">
              <h1 className="mb-2 font-semibold text-2xl">Workflow Not Found</h1>
              <p className="mb-6 text-muted-foreground">
                The workflow you're looking for doesn't exist or has been deleted.
              </p>
              <Button onClick={() => router.push("/")}>New Workflow</Button>
            </div>
          </div>
        )}
          </main>
          <NodeConfigPanel />
    </div>
  );
};

const WorkflowPage = ({ params }: WorkflowPageProps) => (
  <WorkflowEditor params={params} />
);

export default WorkflowPage;
