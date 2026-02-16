"use client";

import {
  getSimpleBezierPath,
  Position,
  useEdges,
  useInternalNode,
  useNodes,
} from "@xyflow/react";
import { useSetAtom } from "jotai";
import { Plus } from "lucide-react";
import { nanoid } from "nanoid";
import { useCallback, useMemo } from "react";
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

// How far the button sits from the node edge (px)
const BUTTON_DISTANCE = 12;
// Cubic bezier Y displacement factor at the button's horizontal distance
// Button is ~30px from handle, typical edge span ~270px, t ~0.11
// At t=0.11: 3t^2(1-t) + t^3 ≈ 0.035
const BEZIER_FACTOR = 0.035;
// Clearance past the nearest edge approximation (px)
const EDGE_CLEARANCE = 20;
// Max offset from center so the button stays visually tied to the node
const MAX_OFFSET = 25;

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

  const outgoingEdges = useMemo(
    () => edges.filter((e) => e.source === sourceNodeId),
    [edges, sourceNodeId]
  );

  // Calculate vertical offset so the button clears all outgoing edge paths
  const buttonOffsetY = useMemo(() => {
    if (outgoingEdges.length === 0 || !sourceNode) {
      return 0;
    }

    const sourceAbsY = sourceNode.internals.positionAbsolute.y;

    // Find the largest downward and upward edge displacement at the button position
    let maxDown = 0;
    let maxUp = 0;

    for (const edge of outgoingEdges) {
      const target = nodes.find((n) => n.id === edge.target);
      if (target) {
        const deltaY = target.position.y - sourceAbsY;
        const displacement = deltaY * BEZIER_FACTOR;
        if (displacement > 0) {
          maxDown = Math.max(maxDown, displacement);
        } else {
          maxUp = Math.min(maxUp, displacement);
        }
      }
    }

    // Offset away from the dominant edge direction, clamped to stay on the node
    if (maxDown >= Math.abs(maxUp)) {
      return Math.max(-(maxDown + EDGE_CLEARANCE), -MAX_OFFSET);
    }
    return Math.min(Math.abs(maxUp) + EDGE_CLEARANCE, MAX_OFFSET);
  }, [outgoingEdges, nodes, sourceNode]);

  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      if (!sourceNode) {
        return;
      }

      const sourceX =
        sourceNode.internals.positionAbsolute.x + NODE_SIZE + NODE_GAP;
      const sourceY = sourceNode.internals.positionAbsolute.y;

      // Place below existing targets to avoid overlap
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
      outgoingEdges,
      nodes,
      addNode,
      setEdges,
      setNodes,
      setActiveTab,
      setHasUnsavedChanges,
      triggerAutosave,
    ]
  );

  const isLeaf = outgoingEdges.length === 0;
  const distance = isLeaf ? BUTTON_DISTANCE : BUTTON_DISTANCE;

  // Generate a curved bezier path from the handle to the button
  const [connectorPath] = getSimpleBezierPath({
    sourceX: 0,
    sourceY: 0,
    sourcePosition: Position.Right,
    targetX: distance,
    targetY: buttonOffsetY,
    targetPosition: Position.Left,
  });

  return (
    <>
      <button
        className="add-step-button group nopan nodrag -translate-y-1/2 absolute"
        onClick={handleClick}
        style={{
          left: `calc(100% + ${distance}px)`,
          top: `calc(50% + ${buttonOffsetY}px)`,
        }}
        title={isLeaf ? "Add step" : "Add branch"}
        type="button"
      >
        <span className="flex size-7 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground transition-all duration-150 group-hover:scale-110 group-hover:border-primary group-hover:bg-primary/10 group-hover:text-primary">
          <Plus className="size-4" strokeWidth={2} />
        </span>
      </button>
      <svg
        aria-hidden="true"
        className="add-step-connector pointer-events-none absolute"
        role="presentation"
        style={{
          left: "100%",
          top: "50%",
          overflow: "visible",
          width: 1,
          height: 1,
        }}
      >
        <path
          d={connectorPath}
          fill="none"
          stroke="var(--border)"
          strokeDasharray="4 3"
          strokeWidth="1.5"
        />
      </svg>
    </>
  );
}
