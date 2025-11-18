"use client";

import { ReactFlowProvider } from "@xyflow/react";
import { useAtomValue, useSetAtom } from "jotai";
import { Plus } from "lucide-react";
import { nanoid } from "nanoid";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WorkflowCanvas } from "@/components/workflow/workflow-canvas";
import { WorkflowToolbar } from "@/components/workflow/workflow-toolbar";
import { authClient, useSession } from "@/lib/auth-client";
import { workflowApi } from "@/lib/workflow-api";
import {
  addNodeAtom,
  currentVercelProjectIdAtom,
  currentVercelProjectNameAtom,
  currentWorkflowIdAtom,
  currentWorkflowNameAtom,
  edgesAtom,
  nodesAtom,
  type WorkflowNode,
} from "@/lib/workflow-store";

// Helper function to create a default trigger node
function createDefaultTriggerNode() {
  return {
    id: nanoid(),
    type: "trigger" as const,
    position: { x: 0, y: 0 },
    data: {
      label: "Trigger",
      description: "Start your workflow",
      type: "trigger" as const,
      config: { triggerType: "Manual" },
      status: "idle" as const,
    },
  };
}

const Home = () => {
  const router = useRouter();
  const { data: session } = useSession();
  const nodes = useAtomValue(nodesAtom);
  const edges = useAtomValue(edgesAtom);
  const currentWorkflowId = useAtomValue(currentWorkflowIdAtom);
  const setNodes = useSetAtom(nodesAtom);
  const setEdges = useSetAtom(edgesAtom);
  const setCurrentWorkflowName = useSetAtom(currentWorkflowNameAtom);
  const setCurrentVercelProjectId = useSetAtom(currentVercelProjectIdAtom);
  const setCurrentVercelProjectName = useSetAtom(currentVercelProjectNameAtom);
  const addNode = useSetAtom(addNodeAtom);
  const hasCreatedWorkflowRef = useRef(false);
  const currentWorkflowName = useAtomValue(currentWorkflowNameAtom);

  // Update page title when workflow name changes
  useEffect(() => {
    document.title = `${currentWorkflowName} - Workflow Builder`;
  }, [currentWorkflowName]);

  // Helper to create anonymous session if needed
  const ensureSession = useCallback(async () => {
    if (!session) {
      await authClient.signIn.anonymous();
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }, [session]);

  // Helper to load project details if workflow has one
  const loadProjectDetails = useCallback(
    async (workflowId: string, _projectId: string) => {
      const fullWorkflow = await workflowApi.getById(workflowId);
      if (fullWorkflow?.vercelProject) {
        setCurrentVercelProjectId(fullWorkflow.vercelProject.id);
        setCurrentVercelProjectName(fullWorkflow.vercelProject.name);
      }
    },
    [setCurrentVercelProjectId, setCurrentVercelProjectName]
  );

  // Initialize with no nodes on mount
  useEffect(() => {
    setNodes([]);
    setEdges([]);
    setCurrentWorkflowName("Untitled Workflow");
    setCurrentVercelProjectId(null);
    setCurrentVercelProjectName(null);
    hasCreatedWorkflowRef.current = false;
  }, [
    setNodes,
    setEdges,
    setCurrentWorkflowName,
    setCurrentVercelProjectId,
    setCurrentVercelProjectName,
  ]);

  // Create workflow when first node is added
  useEffect(() => {
    const createWorkflowAndRedirect = async () => {
      // Only create when we have at least one node and haven't created a workflow yet
      if (nodes.length === 0 || hasCreatedWorkflowRef.current) {
        return;
      }
      hasCreatedWorkflowRef.current = true;

      try {
        await ensureSession();

        // Create workflow with all current nodes
        const newWorkflow = await workflowApi.create({
          name: "Untitled Workflow",
          description: "",
          nodes,
          edges,
        });

        // Load project details if available
        if (newWorkflow.vercelProjectId) {
          await loadProjectDetails(newWorkflow.id, newWorkflow.vercelProjectId);
        }

        // Redirect to the workflow page
        router.replace(`/workflows/${newWorkflow.id}`);
      } catch (error) {
        console.error("Failed to create workflow:", error);
        toast.error("Failed to create workflow");
      }
    };

    createWorkflowAndRedirect();
  }, [nodes, edges, router, ensureSession, loadProjectDetails]);

  // Handler to add the first node
  const handleAddNode = useCallback(() => {
    const newNode: WorkflowNode = createDefaultTriggerNode();
    addNode(newNode);
  }, [addNode]);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden">
      <main className="relative flex size-full overflow-hidden">
        <ReactFlowProvider>
          <div className="relative flex-1 overflow-hidden">
            <WorkflowToolbar
              showSidebar={false}
              workflowId={currentWorkflowId ?? undefined}
            />
            <WorkflowCanvas showMinimap={false} />
            {nodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Button
                  className="h-14 gap-2 text-lg"
                  onClick={handleAddNode}
                  size="lg"
                >
                  <Plus className="h-5 w-5" />
                  Add Node
                </Button>
              </div>
            )}
          </div>
        </ReactFlowProvider>
      </main>
    </div>
  );
};

export default Home;
