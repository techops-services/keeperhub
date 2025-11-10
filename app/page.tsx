"use client";

import { ReactFlowProvider } from "@xyflow/react";
import { useAtom, useSetAtom } from "jotai";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { NodeConfigPanel } from "@/components/workflow/node-config-panel";
import { WorkflowCanvas } from "@/components/workflow/workflow-canvas";
import { WorkflowSkeleton } from "@/components/workflow/workflow-skeleton";
import { WorkflowToolbar } from "@/components/workflow/workflow-toolbar";
import { workflowApi } from "@/lib/workflow-api";
import {
  currentVercelProjectNameAtom,
  currentWorkflowIdAtom,
  currentWorkflowNameAtom,
  edgesAtom,
  isExecutingAtom,
  isLoadingAtom,
  nodesAtom,
  selectedNodeAtom,
  updateNodeDataAtom,
} from "@/lib/workflow-store";

const Home = () => {
  const router = useRouter();
  const [isExecuting, setIsExecuting] = useAtom(isExecutingAtom);
  const [isLoading, setIsLoading] = useAtom(isLoadingAtom);
  const [nodes] = useAtom(nodesAtom);
  const [edges] = useAtom(edgesAtom);
  const [currentWorkflowId, setCurrentWorkflowId] = useAtom(
    currentWorkflowIdAtom
  );
  const setNodes = useSetAtom(nodesAtom);
  const setEdges = useSetAtom(edgesAtom);
  const setCurrentWorkflowName = useSetAtom(currentWorkflowNameAtom);
  const setCurrentVercelProjectName = useSetAtom(currentVercelProjectNameAtom);
  const updateNodeData = useSetAtom(updateNodeDataAtom);
  const setSelectedNodeId = useSetAtom(selectedNodeAtom);
  const hasRedirectedRef = useRef(false);

  // Create a new workflow on mount
  useEffect(() => {
    const createNewWorkflow = async () => {
      try {
        setIsLoading(true);
        const newWorkflow = await workflowApi.create({
          name: "Untitled",
          description: "",
          nodes: [],
          edges: [],
        });
        setCurrentWorkflowId(newWorkflow.id);
        setCurrentWorkflowName(newWorkflow.name);
        setNodes([]);
        setEdges([]);
      } catch (error) {
        console.error("Failed to create workflow:", error);
        toast.error("Failed to create workflow");
      } finally {
        setIsLoading(false);
      }
    };

    createNewWorkflow();
  }, [
    setCurrentWorkflowId,
    setCurrentWorkflowName,
    setNodes,
    setEdges,
    setIsLoading,
  ]);

  // Watch for nodes being added and redirect
  useEffect(() => {
    if (nodes.length > 0 && currentWorkflowId && !hasRedirectedRef.current) {
      hasRedirectedRef.current = true;
      router.push(`/workflows/${currentWorkflowId}`);
    }
  }, [nodes, currentWorkflowId, router]);

  // Keyboard shortcuts
  const handleSave = useCallback(async () => {
    if (!currentWorkflowId) return;
    try {
      await workflowApi.update(currentWorkflowId, { nodes, edges });
      toast.success("Workflow saved");
    } catch (error) {
      console.error("Failed to save workflow:", error);
      toast.error("Failed to save workflow");
    }
  }, [currentWorkflowId, nodes, edges]);

  const handleRun = useCallback(async () => {
    if (isExecuting || nodes.length === 0 || !currentWorkflowId) return;

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
  }, [isExecuting, nodes, currentWorkflowId, setIsExecuting, updateNodeData]);

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
    <AnimatePresence mode="wait">
      {isLoading ? (
        <AnimatePresence mode="popLayout">
          <motion.div
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            initial={{ opacity: 1 }}
            key="skeleton"
            transition={{ duration: 0.15 }}
          >
            <WorkflowSkeleton />
          </motion.div>
        </AnimatePresence>
      ) : (
        <motion.div
          animate={{ opacity: 1 }}
          className="flex h-screen w-full flex-col overflow-hidden"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          key="canvas"
          transition={{ duration: 0.15 }}
        >
          <WorkflowToolbar workflowId={currentWorkflowId ?? undefined} />
          <main className="relative size-full overflow-hidden">
            <ReactFlowProvider>
              <WorkflowCanvas />
            </ReactFlowProvider>
          </main>
          <NodeConfigPanel />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Home;
