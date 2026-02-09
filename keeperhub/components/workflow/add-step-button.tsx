"use client";

import { useEdges, useInternalNode, useNodes } from "@xyflow/react";
import { useSetAtom } from "jotai";
import { Plus } from "lucide-react";
import { nanoid } from "nanoid";
import { useCallback } from "react";
import {
  addNodeAtom,
  autosaveAtom,
  edgesAtom,
  hasUnsavedChangesAtom,
  nodesAtom,
  propertiesPanelActiveTabAtom,
  type WorkflowNode,
} from "@/lib/workflow-store";

const NODE_SIZE = 192;
const NODE_GAP = 80;

type AddStepButtonProps = {
  sourceNodeId: string;
};

export function AddStepButton({
  sourceNodeId,
}: AddStepButtonProps): React.ReactNode {
  const edges = useEdges();
  const nodes = useNodes();
  const sourceNode = useInternalNode(sourceNodeId);
  const addNode = useSetAtom(addNodeAtom);
  const setEdges = useSetAtom(edgesAtom);
  const setNodes = useSetAtom(nodesAtom);
  const setActiveTab = useSetAtom(propertiesPanelActiveTabAtom);
  const setHasUnsavedChanges = useSetAtom(hasUnsavedChangesAtom);
  const triggerAutosave = useSetAtom(autosaveAtom);

  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      if (!sourceNode) {
        return;
      }

      const sourceX =
        sourceNode.internals.positionAbsolute.x + NODE_SIZE + NODE_GAP;
      const sourceY = sourceNode.internals.positionAbsolute.y;

      // Find existing target nodes to avoid overlap
      const outgoingEdges = edges.filter((e) => e.source === sourceNodeId);
      let newY = sourceY;

      if (outgoingEdges.length > 0) {
        const targetIds = new Set(outgoingEdges.map((e) => e.target));
        const targetNodes = nodes.filter((n) => targetIds.has(n.id));
        if (targetNodes.length > 0) {
          const maxY = Math.max(...targetNodes.map((n) => n.position.y));
          newY = maxY + NODE_SIZE + NODE_GAP;
        }
      }

      const newNodeId = nanoid();
      const newNode: WorkflowNode = {
        id: newNodeId,
        type: "action",
        position: { x: sourceX, y: newY },
        data: {
          label: "",
          description: "",
          type: "action",
          config: {},
          status: "idle",
        },
        selected: true,
      };

      addNode(newNode);
      setActiveTab("properties");

      setTimeout(() => {
        setNodes((currentNodes) =>
          currentNodes.map((n) => ({
            ...n,
            selected: n.id === newNodeId,
          }))
        );
      }, 50);

      const newEdge = {
        id: nanoid(),
        source: sourceNodeId,
        target: newNodeId,
        type: "animated",
      };
      setEdges((currentEdges) => [...currentEdges, newEdge]);
      setHasUnsavedChanges(true);
      triggerAutosave({ immediate: true });
    },
    [
      sourceNode,
      sourceNodeId,
      edges,
      nodes,
      addNode,
      setEdges,
      setNodes,
      setActiveTab,
      setHasUnsavedChanges,
      triggerAutosave,
    ]
  );

  return (
    <button
      className="add-step-button group nopan nodrag absolute top-1/2 -translate-y-1/2"
      onClick={handleClick}
      style={{ left: "calc(100% + 12px)" }}
      title="Add step"
      type="button"
    >
      <span className="add-step-line" />
      <span className="flex size-7 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground transition-all duration-150 group-hover:scale-110 group-hover:border-primary group-hover:bg-primary/10 group-hover:text-primary">
        <Plus className="size-4" strokeWidth={2} />
      </span>
    </button>
  );
}
