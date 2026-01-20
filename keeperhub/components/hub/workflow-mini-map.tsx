import type { CSSProperties, ReactNode } from "react";
import {
  Bot,
  Clock,
  Code,
  GitBranch,
  Globe,
  Hash,
  Mail,
  Play,
  Send,
  User,
  Webhook,
  Zap,
  Box,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { WorkflowEdge, WorkflowNode } from "@/lib/workflow-store";
import { DiscordIcon } from "@/keeperhub/plugins/discord/icon";
import { WebhookIcon } from "@/keeperhub/plugins/webhook/icon";
import { Web3Icon } from "@/keeperhub/plugins/web3/icon";

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

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

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

type IconComponent =
  | LucideIcon
  | (({ className, style }: { className?: string; style?: CSSProperties }) => ReactNode);

function getNodeIcon(node: WorkflowNode): IconComponent {
  const isTrigger = node.type === "trigger" || node.data?.type === "trigger";

  if (isTrigger) {
    const triggerType = node.data?.config?.triggerType as string | undefined;
    switch (triggerType) {
      case "Schedule":
        return Clock;
      case "Webhook":
        return Zap;
      case "Manual":
      default:
        return Play;
    }
  }

  // Action nodes - check actionType
  const actionType = node.data?.config?.actionType as string | undefined;
  if (!actionType) return Box;

  // Check for slug format first (e.g., "web3/check-balance")
  if (actionType.includes("/")) {
    const integrationType = actionType.split("/")[0];
    switch (integrationType) {
      case "web3":
        return Web3Icon;
      case "discord":
        return DiscordIcon;
      case "slack":
        return Hash;
      case "sendgrid":
        return Mail;
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

  // Check for label format (e.g., "Check Balance", "Send Slack Message")
  const lowerActionType = actionType.toLowerCase();

  // Web3 actions
  if (
    lowerActionType.includes("balance") ||
    lowerActionType.includes("transfer") ||
    lowerActionType.includes("contract")
  ) {
    return Web3Icon;
  }

  // Messaging
  if (lowerActionType.includes("slack")) {
    return Hash;
  }
  if (lowerActionType.includes("discord")) {
    return DiscordIcon;
  }

  // Email
  if (lowerActionType.includes("email") || lowerActionType.includes("sendgrid")) {
    return Mail;
  }

  // Webhook
  if (lowerActionType.includes("webhook")) {
    return WebhookIcon;
  }

  // HTTP
  if (lowerActionType.includes("http") || lowerActionType.includes("request")) {
    return Code;
  }

  // Condition
  if (lowerActionType === "condition") {
    return GitBranch;
  }

  return Box;
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
  const width = NODE_WIDTH * scale;
  const height = NODE_HEIGHT * scale;
  const IconComponent = getNodeIcon(node);

  // Calculate icon size (50% of node size)
  const iconSize = Math.min(width, height) * 0.5;

  return (
    <g>
      {/* Node background */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={width * 0.15}
        ry={height * 0.15}
        className="fill-slate-400"
      />
      {/* Icon using foreignObject */}
      <foreignObject
        x={x}
        y={y}
        width={width}
        height={height}
      >
        <div className="flex h-full w-full items-center justify-center">
          <IconComponent
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

  if (!sourceNode || !targetNode) {
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
      d={`M ${sourceX} ${sourceY} C ${midX} ${sourceY}, ${midX} ${targetY}, ${targetX} ${targetY}`}
      className="fill-none stroke-slate-300"
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
        viewBox={`0 0 ${width} ${height}`}
        className={`${className}`}
        width={width}
        height={height}
      >
        <rect
          x={width / 2 - 30}
          y={height / 2 - 15}
          width={60}
          height={30}
          rx={6}
          className="fill-slate-300"
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
      viewBox={`0 0 ${width} ${height}`}
      className={`${className}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Dotted background pattern */}
      <defs>
        <pattern
          id="dots"
          x="0"
          y="0"
          width="10"
          height="10"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="1" cy="1" r="0.5" className="fill-slate-600/30" />
        </pattern>
      </defs>
      <rect x="0" y="0" width="100%" height="100%" fill="url(#dots)" />

      {/* Render edges first (behind nodes) */}
      {edges.map((edge) => (
        <MiniEdge
          key={edge.id}
          edge={edge}
          nodes={nodes}
          bounds={bounds}
          scale={scale}
          offsetX={offsetX}
          offsetY={offsetY}
        />
      ))}
      {/* Render nodes */}
      {nodes
        .filter((node) => node.type !== "add")
        .map((node) => (
          <MiniNode
            key={node.id}
            node={node}
            bounds={bounds}
            scale={scale}
            offsetX={offsetX}
            offsetY={offsetY}
          />
        ))}
    </svg>
  );
}
