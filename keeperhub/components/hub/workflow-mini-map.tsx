import type { LucideIcon } from "lucide-react";
import {
  Bot,
  Box,
  Clock,
  Code,
  GitBranch,
  Hash,
  Mail,
  Play,
  User,
  Zap,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { DiscordIcon } from "@/keeperhub/plugins/discord/icon";
import { Web3Icon } from "@/keeperhub/plugins/web3/icon";
import { WebhookIcon } from "@/keeperhub/plugins/webhook/icon";
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

const NODE_WIDTH = 80;
const NODE_HEIGHT = 80;
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
    maxX = Math.max(maxX, x + NODE_WIDTH);
    maxY = Math.max(maxY, y + NODE_HEIGHT);
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

type NodeIconType =
  | LucideIcon
  | (({
      className,
      style,
    }: {
      className?: string;
      style?: CSSProperties;
    }) => ReactNode);

function getTriggerIcon(triggerType: string | undefined): NodeIconType {
  switch (triggerType) {
    case "Schedule":
      return Clock;
    case "Webhook":
      return Zap;
    default:
      return Play;
  }
}

function getActionIconBySlug(integrationType: string): NodeIconType {
  switch (integrationType) {
    case "web3":
      return Web3Icon;
    case "discord":
      return DiscordIcon;
    case "slack":
      return Hash;
    case "sendgrid":
    case "resend":
      return Mail;
    case "webhook":
      return WebhookIcon;
    case "ai-gateway":
      return Bot;
    case "clerk":
      return User;
    default:
      return Box;
  }
}

function getActionIconByLabel(lowerActionType: string): NodeIconType {
  if (
    lowerActionType.includes("balance") ||
    lowerActionType.includes("transfer") ||
    lowerActionType.includes("contract")
  ) {
    return Web3Icon;
  }
  if (lowerActionType.includes("slack")) {
    return Hash;
  }
  if (lowerActionType.includes("discord")) {
    return DiscordIcon;
  }
  if (
    lowerActionType.includes("email") ||
    lowerActionType.includes("sendgrid")
  ) {
    return Mail;
  }
  if (lowerActionType.includes("webhook")) {
    return WebhookIcon;
  }
  if (lowerActionType.includes("http") || lowerActionType.includes("request")) {
    return Code;
  }
  if (lowerActionType === "condition") {
    return GitBranch;
  }
  return Box;
}

function getNodeIcon(node: WorkflowNode): NodeIconType {
  const isTrigger = node.type === "trigger" || node.data?.type === "trigger";

  if (isTrigger) {
    const triggerType = node.data?.config?.triggerType as string | undefined;
    return getTriggerIcon(triggerType);
  }

  const actionType = node.data?.config?.actionType as string | undefined;
  if (!actionType) {
    return Box;
  }

  if (actionType.includes("/")) {
    const integrationType = actionType.split("/")[0];
    return getActionIconBySlug(integrationType);
  }

  return getActionIconByLabel(actionType.toLowerCase());
}

function MiniNode({
  node,
  bounds,
  scale,
  offsetX,
  offsetY,
}: {
  node: WorkflowNode;
  bounds: Bounds;
  scale: number;
  offsetX: number;
  offsetY: number;
}) {
  const x = ((node.position?.x ?? 0) - bounds.minX) * scale + offsetX;
  const y = ((node.position?.y ?? 0) - bounds.minY) * scale + offsetY;
  const nodeWidth = NODE_WIDTH * scale;
  const nodeHeight = NODE_HEIGHT * scale;
  const Icon = getNodeIcon(node);

  // Calculate icon size (50% of node size)
  const iconSize = Math.min(nodeWidth, nodeHeight) * 0.5;

  return (
    <g>
      {/* Node background */}
      <rect
        className="fill-slate-400"
        height={nodeHeight}
        rx={nodeWidth * 0.15}
        ry={nodeHeight * 0.15}
        width={nodeWidth}
        x={x}
        y={y}
      />
      {/* Icon using foreignObject */}
      <foreignObject height={nodeHeight} width={nodeWidth} x={x} y={y}>
        <div className="flex h-full w-full items-center justify-center">
          <Icon
            className="text-slate-100"
            style={{ width: iconSize, height: iconSize }}
          />
        </div>
      </foreignObject>
    </g>
  );
}

function MiniEdge({
  edge,
  nodes,
  bounds,
  scale,
  offsetX,
  offsetY,
}: {
  edge: WorkflowEdge;
  nodes: WorkflowNode[];
  bounds: Bounds;
  scale: number;
  offsetX: number;
  offsetY: number;
}) {
  const sourceNode = nodes.find((n) => n.id === edge.source);
  const targetNode = nodes.find((n) => n.id === edge.target);

  if (!(sourceNode && targetNode)) {
    return null;
  }

  // Calculate center-right of source node
  const sourceX =
    ((sourceNode.position?.x ?? 0) - bounds.minX + NODE_WIDTH) * scale +
    offsetX;
  const sourceY =
    ((sourceNode.position?.y ?? 0) - bounds.minY + NODE_HEIGHT / 2) * scale +
    offsetY;

  // Calculate center-left of target node
  const targetX =
    ((targetNode.position?.x ?? 0) - bounds.minX) * scale + offsetX;
  const targetY =
    ((targetNode.position?.y ?? 0) - bounds.minY + NODE_HEIGHT / 2) * scale +
    offsetY;

  // Create a smooth bezier curve
  const midX = (sourceX + targetX) / 2;

  return (
    <path
      className="fill-none stroke-slate-300"
      d={`M ${sourceX} ${sourceY} C ${midX} ${sourceY}, ${midX} ${targetY}, ${targetX} ${targetY}`}
      strokeWidth={2}
    />
  );
}

export function WorkflowMiniMap({
  nodes,
  edges,
  width = 200,
  height = 120,
  className = "",
}: WorkflowMiniMapProps) {
  if (!nodes || nodes.length === 0) {
    // Empty state - show placeholder
    return (
      <svg
        aria-label="Empty workflow diagram"
        className={`${className}`}
        height={height}
        role="img"
        viewBox={`0 0 ${width} ${height}`}
        width={width}
      >
        <rect
          className="fill-slate-300"
          height={30}
          rx={6}
          width={60}
          x={width / 2 - 30}
          y={height / 2 - 15}
        />
      </svg>
    );
  }

  const bounds = calculateBounds(nodes);

  // Calculate scale to fit within the viewport with padding
  const availableWidth = width - PADDING * 2;
  const availableHeight = height - PADDING * 2;
  const scaleX = availableWidth / bounds.width;
  const scaleY = availableHeight / bounds.height;
  const scale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down

  // Center the content
  const scaledWidth = bounds.width * scale;
  const scaledHeight = bounds.height * scale;
  const offsetX = (width - scaledWidth) / 2;
  const offsetY = (height - scaledHeight) / 2;

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
      
      {/* Render edges first (behind nodes) */}
      {edges.map((edge) => (
        <MiniEdge
          bounds={bounds}
          edge={edge}
          key={edge.id}
          nodes={nodes}
          offsetX={offsetX}
          offsetY={offsetY}
          scale={scale}
        />
      ))}
      {/* Render nodes */}
      {nodes
        .filter((node) => node.type !== "add")
        .map((node) => (
          <MiniNode
            bounds={bounds}
            key={node.id}
            node={node}
            offsetX={offsetX}
            offsetY={offsetY}
            scale={scale}
          />
        ))}
    </svg>
  );
}
