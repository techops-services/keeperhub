import type { WorkflowEdge, WorkflowNode } from "@/lib/workflow-store";

type WorkflowMiniMapProps = {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  width?: number;
  height?: number;
  className?: string;
};

type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
};

const FIXED_NODE_SIZE = 18;
const PADDING = 20;

function calculateBounds(nodes: WorkflowNode[]): Bounds {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 100, maxY: 100, width: 100, height: 100 };
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const node of nodes) {
    const x = node.position?.x ?? 0;
    const y = node.position?.y ?? 0;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function MiniNode({
  node,
  bounds,
  posScale,
  offsetX,
  offsetY,
}: {
  node: WorkflowNode;
  bounds: Bounds;
  posScale: number;
  offsetX: number;
  offsetY: number;
}) {
  const x = ((node.position?.x ?? 0) - bounds.minX) * posScale + offsetX;
  const y = ((node.position?.y ?? 0) - bounds.minY) * posScale + offsetY;
  const isTrigger = node.type === "trigger" || node.data?.type === "trigger";

  return (
    <rect
      className={isTrigger ? "fill-[#09fd67]/60" : "fill-[#3d4f63]"}
      height={FIXED_NODE_SIZE}
      rx={FIXED_NODE_SIZE * 0.15}
      ry={FIXED_NODE_SIZE * 0.15}
      width={FIXED_NODE_SIZE}
      x={x}
      y={y}
    />
  );
}

function MiniEdge({
  edge,
  nodes,
  bounds,
  posScale,
  offsetX,
  offsetY,
}: {
  edge: WorkflowEdge;
  nodes: WorkflowNode[];
  bounds: Bounds;
  posScale: number;
  offsetX: number;
  offsetY: number;
}) {
  const sourceNode = nodes.find((n) => n.id === edge.source);
  const targetNode = nodes.find((n) => n.id === edge.target);

  if (!(sourceNode && targetNode)) {
    return null;
  }

  const sourceX =
    ((sourceNode.position?.x ?? 0) - bounds.minX) * posScale +
    offsetX +
    FIXED_NODE_SIZE;
  const sourceY =
    ((sourceNode.position?.y ?? 0) - bounds.minY) * posScale +
    offsetY +
    FIXED_NODE_SIZE / 2;

  const targetX =
    ((targetNode.position?.x ?? 0) - bounds.minX) * posScale + offsetX;
  const targetY =
    ((targetNode.position?.y ?? 0) - bounds.minY) * posScale +
    offsetY +
    FIXED_NODE_SIZE / 2;

  const midX = (sourceX + targetX) / 2;

  return (
    <path
      className="fill-none stroke-[#2a3342]"
      d={`M ${sourceX} ${sourceY} C ${midX} ${sourceY}, ${midX} ${targetY}, ${targetX} ${targetY}`}
      strokeWidth={0.4}
    />
  );
}

export function WorkflowMiniMap({
  nodes,
  edges,
  width = 280,
  height = 160,
  className = "",
}: WorkflowMiniMapProps) {
  if (!nodes || nodes.length === 0) {
    return (
      <svg
        aria-label="Empty workflow diagram"
        className={`${className}`}
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
      >
        <rect
          className="fill-slate-300"
          height={FIXED_NODE_SIZE}
          rx={6}
          width={FIXED_NODE_SIZE * 2}
          x={width / 2 - FIXED_NODE_SIZE}
          y={height / 2 - FIXED_NODE_SIZE / 2}
        />
      </svg>
    );
  }

  const bounds = calculateBounds(nodes);

  const availW = width - PADDING * 2 - FIXED_NODE_SIZE;
  const availH = height - PADDING * 2 - FIXED_NODE_SIZE;
  const posScaleX = bounds.width > 0 ? availW / bounds.width : 1;
  const posScaleY = bounds.height > 0 ? availH / bounds.height : 1;
  const posScale = Math.min(posScaleX, posScaleY);

  const scaledContentW = bounds.width * posScale + FIXED_NODE_SIZE;
  const scaledContentH = bounds.height * posScale + FIXED_NODE_SIZE;
  const offsetX = (width - scaledContentW) / 2;
  const offsetY = (height - scaledContentH) / 2;

  return (
    <svg
      aria-label="Workflow diagram"
      className={`${className}`}
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
    >
      {edges.map((edge) => (
        <MiniEdge
          bounds={bounds}
          edge={edge}
          key={edge.id}
          nodes={nodes}
          offsetX={offsetX}
          offsetY={offsetY}
          posScale={posScale}
        />
      ))}
      {nodes
        .filter((node) => node.type !== "add")
        .map((node) => (
          <MiniNode
            bounds={bounds}
            key={node.id}
            node={node}
            offsetX={offsetX}
            offsetY={offsetY}
            posScale={posScale}
          />
        ))}
    </svg>
  );
}
