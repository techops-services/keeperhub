import { ImageResponse } from "@vercel/og";
import { eq } from "drizzle-orm";
import type { ReactNode } from "react";
import { db } from "@/lib/db";
import { workflows } from "@/lib/db/schema";

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const DOT_SPACING = 32;

const LOGO_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 318 500' fill='none'%3E%3Cpath d='M317.77 204.279H226.98V295.069H317.77V204.279Z' fill='%2300FF4F'/%3E%3Cpath d='M204.28 90.79V0H113.49V90.79C113.456 120.879 101.488 149.725 80.2115 171.002C58.9355 192.278 30.0889 204.246 0 204.28V295.07C30.0889 295.104 58.9355 307.072 80.2115 328.348C101.488 349.625 113.456 378.471 113.49 408.56V499.35H204.28V408.56C204.28 378.075 197.445 347.977 184.279 320.482C171.113 292.987 151.95 268.793 128.2 249.68C151.948 230.563 171.109 206.367 184.275 178.871C197.441 151.374 204.277 121.276 204.28 90.79Z' fill='%2300FF4F'/%3E%3C/svg%3E";

const NODE_BORDER_GREEN = "rgba(0,255,79,0.45)";
const NODE_BORDER_GREEN_BRIGHT = "rgba(0,255,79,0.65)";
const EDGE_COLOR = "rgba(0,255,79,0.15)";

const BG_COLOR = "#111827";
const CARD_COLOR = "#1e293b";
const DOT_COLOR = "rgba(255,255,255,0.35)";
const VIGNETTE =
  "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%)";
const GRADIENT =
  "linear-gradient(180deg, rgba(17,24,39,0.95) 0%, rgba(17,24,39,0.85) 15%, rgba(17,24,39,0.4) 35%, rgba(17,24,39,0.3) 50%, rgba(17,24,39,0.4) 65%, rgba(17,24,39,0.6) 80%, rgba(17,24,39,0.95) 100%)";

// ---------------------------------------------------------------------------
// Shared icon SVG data URIs
// ---------------------------------------------------------------------------

const ICON_CLOCK =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23aaaaaa' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='M12 6v6l4 2'/%3E%3C/svg%3E";

const ICON_GLOBE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23aaaaaa' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='M2 12h20'/%3E%3Cpath d='M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'/%3E%3C/svg%3E";

const ICON_ZAP =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23aaaaaa' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M13 2L3 14h9l-1 8 10-12h-9l1-8z'/%3E%3C/svg%3E";

const ICON_BRANCH =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23aaaaaa' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 3v12'/%3E%3Ccircle cx='18' cy='6' r='3'/%3E%3Ccircle cx='6' cy='18' r='3'/%3E%3Cpath d='M18 9c0 6-6 6-12 6'/%3E%3C/svg%3E";

const ICON_BELL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23aaaaaa' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9'/%3E%3Cpath d='M13.73 21a2 2 0 0 1-3.46 0'/%3E%3C/svg%3E";

const ICON_SWAP =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23aaaaaa' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M8 3L4 7l4 4'/%3E%3Cpath d='M4 7h16'/%3E%3Cpath d='M16 21l4-4-4-4'/%3E%3Cpath d='M20 17H4'/%3E%3C/svg%3E";

const ICON_SEND =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23aaaaaa' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M22 2L11 13'/%3E%3Cpath d='M22 2l-7 20-4-9-9-4z'/%3E%3C/svg%3E";

const ICON_FILE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23aaaaaa' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'/%3E%3Cpath d='M14 2v6h6'/%3E%3Cpath d='M16 13H8'/%3E%3Cpath d='M16 17H8'/%3E%3C/svg%3E";

const ICON_LINK =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23aaaaaa' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71'/%3E%3Cpath d='M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'/%3E%3C/svg%3E";

const ICON_PLAY =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23aaaaaa' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpolygon points='10 8 16 12 10 16 10 8'/%3E%3C/svg%3E";

const ICON_DOLLAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23aaaaaa' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 1v22'/%3E%3Cpath d='M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'/%3E%3C/svg%3E";

const ICON_MAIL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23aaaaaa' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='2' y='4' width='20' height='16' rx='2'/%3E%3Cpath d='m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7'/%3E%3C/svg%3E";

const ICON_RULES: Array<{ keywords: string[]; icon: string }> = [
  { keywords: ["schedule", "cron", "timer", "interval"], icon: ICON_CLOCK },
  { keywords: ["webhook", "http", "api", "request"], icon: ICON_LINK },
  { keywords: ["on-chain", "event", "monitor", "watch"], icon: ICON_ZAP },
  { keywords: ["condition", "filter", "branch", "if"], icon: ICON_BRANCH },
  {
    keywords: ["discord", "slack", "notify", "alert", "notification"],
    icon: ICON_BELL,
  },
  { keywords: ["swap", "exchange", "trade"], icon: ICON_SWAP },
  { keywords: ["transfer", "send discord", "send report"], icon: ICON_SEND },
  { keywords: ["email", "sendgrid", "mail"], icon: ICON_MAIL },
  { keywords: ["log", "record", "report"], icon: ICON_FILE },
  {
    keywords: ["price", "balance", "fee", "spread", "cost"],
    icon: ICON_DOLLAR,
  },
  {
    keywords: ["check", "fetch", "read", "position", "liquidity", "web3"],
    icon: ICON_GLOBE,
  },
  { keywords: ["manual", "trigger"], icon: ICON_PLAY },
];

const HUB_ICONS: Record<string, string> = {
  Schedule: ICON_CLOCK,
  Swap: ICON_SWAP,
  Transfer: ICON_SEND,
  Monitor: ICON_ZAP,
  Notify: ICON_BELL,
  Condition: ICON_BRANCH,
};

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

type DotPosition = { x: number; y: number };

function generateDots(
  width: number,
  height: number,
  spacing: number
): DotPosition[] {
  const dots: DotPosition[] = [];
  for (let x = spacing; x < width; x += spacing) {
    for (let y = spacing; y < height; y += spacing) {
      dots.push({ x, y });
    }
  }
  return dots;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function getNodeIcon(label: string): string {
  const lower = label.toLowerCase();
  const match = ICON_RULES.find((rule) =>
    rule.keywords.some((kw) => lower.includes(kw))
  );
  return match?.icon ?? ICON_PLAY;
}

const DOTS = generateDots(OG_WIDTH, OG_HEIGHT, DOT_SPACING);

// ---------------------------------------------------------------------------
// Shared base layout - background, dots, vignette, gradient
// ---------------------------------------------------------------------------

function OGBase({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        backgroundColor: BG_COLOR,
      }}
    >
      {DOTS.map((dot) => (
        <div
          key={`dot-${dot.x}-${dot.y}`}
          style={{
            position: "absolute",
            left: dot.x - 1,
            top: dot.y - 1,
            width: 2,
            height: 2,
            borderRadius: 1,
            backgroundColor: DOT_COLOR,
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: VIGNETTE,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: GRADIENT,
        }}
      />
      {children}
    </div>
  );
}

function renderOGImage(
  content: React.JSX.Element,
  cacheSeconds: number
): ImageResponse {
  return new ImageResponse(content, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    headers: {
      "Cache-Control": `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds * 24}`,
    },
  });
}

// ---------------------------------------------------------------------------
// Default OG
// ---------------------------------------------------------------------------

export function generateDefaultOGImage(): ImageResponse {
  return renderOGImage(
    <OGBase>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
        }}
      >
        {/* biome-ignore lint/a11y/useAltText: OG image render context */}
        {/* biome-ignore lint/performance/noImgElement: Satori requires img */}
        <img
          height={75}
          src={LOGO_SVG}
          style={{ width: 48, height: 75 }}
          width={48}
        />
        <div
          style={{
            display: "flex",
            fontSize: 64,
            fontWeight: 700,
            color: "#ffffff",
            marginTop: 8,
          }}
        >
          KeeperHub
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 24,
            color: "rgba(255,255,255,0.45)",
          }}
        >
          Automate anything onchain
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 18,
            color: "rgba(255,255,255,0.3)",
            marginTop: 4,
          }}
        >
          Build, deploy, and manage Web3 workflow automations
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          top: 40,
          right: 56,
          display: "flex",
          fontSize: 16,
          color: "rgba(255,255,255,0.3)",
        }}
      >
        app.keeperhub.com
      </div>
    </OGBase>,
    86_400
  );
}

// ---------------------------------------------------------------------------
// Hub OG
// ---------------------------------------------------------------------------

type HubCard = { label: string; x: number; y: number };

const HUB_CARDS: HubCard[] = [
  { label: "Schedule", x: 140, y: 360 },
  { label: "Swap", x: 310, y: 360 },
  { label: "Transfer", x: 480, y: 360 },
  { label: "Monitor", x: 650, y: 360 },
  { label: "Notify", x: 820, y: 360 },
  { label: "Condition", x: 990, y: 360 },
];

export function generateHubOGImage(): ImageResponse {
  return renderOGImage(
    <OGBase>
      {/* Edge lines connecting cards */}
      {HUB_CARDS.slice(0, -1).map((card, i) => {
        const next = HUB_CARDS[i + 1];
        return (
          <div
            key={`edge-${card.label}`}
            style={{
              position: "absolute",
              left: card.x + 68,
              top: card.y + 34,
              width: next.x - card.x - 68,
              height: 2,
              backgroundColor: EDGE_COLOR,
            }}
          />
        );
      })}

      {/* Preview workflow cards */}
      {HUB_CARDS.map((card) => (
        <div
          key={card.label}
          style={{
            position: "absolute",
            left: card.x,
            top: card.y,
            width: 68,
            height: 68,
            borderRadius: 10,
            backgroundColor: CARD_COLOR,
            border: `1.5px solid ${NODE_BORDER_GREEN}`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
            gap: 4,
          }}
        >
          {/* biome-ignore lint/a11y/useAltText: OG image render context */}
          {/* biome-ignore lint/performance/noImgElement: Satori requires img */}
          <img
            height={20}
            src={HUB_ICONS[card.label] ?? ICON_ZAP}
            style={{ width: 20, height: 20 }}
            width={20}
          />
          <div
            style={{
              fontSize: 8,
              color: "rgba(255,255,255,0.55)",
              fontWeight: 600,
              textAlign: "center",
            }}
          >
            {card.label}
          </div>
        </div>
      ))}

      {/* Top content */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "60%",
          display: "flex",
          flexDirection: "column",
          padding: "40px 56px 0",
        }}
      >
        <Header />
        <div
          style={{
            display: "flex",
            fontSize: 52,
            fontWeight: 700,
            color: "#ffffff",
            marginTop: 36,
            lineHeight: 1.15,
          }}
        >
          Workflow Hub
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 22,
            color: "rgba(255,255,255,0.5)",
            marginTop: 14,
            lineHeight: 1.4,
          }}
        >
          Discover and deploy community-built blockchain automations
        </div>
      </div>

      <Footer>
        <div style={{ display: "flex" }}>Featured workflows</div>
        <div style={{ display: "flex" }}>Community templates</div>
        <div style={{ display: "flex" }}>One-click deploy</div>
      </Footer>
    </OGBase>,
    86_400
  );
}

// ---------------------------------------------------------------------------
// Workflow OG
// ---------------------------------------------------------------------------

type WorkflowNode = {
  id: string;
  position: { x: number; y: number };
  data: { type: "trigger" | "action" | "add"; label?: string };
};

type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
};

type Viewport = { scale: number; offsetX: number; offsetY: number };

type EdgeLine = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  midY: number;
};

function calculateViewport(
  nodes: WorkflowNode[],
  paddingTop: number,
  paddingBottom: number,
  paddingSides: number
): Viewport {
  if (nodes.length === 0) {
    return { scale: 1, offsetX: OG_WIDTH / 2, offsetY: OG_HEIGHT / 2 };
  }

  const nodeSize = 192;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const node of nodes) {
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + nodeSize);
    maxY = Math.max(maxY, node.position.y + nodeSize);
  }

  const contentWidth = maxX - minX || 1;
  const contentHeight = maxY - minY || 1;
  const availableWidth = OG_WIDTH - paddingSides * 2;
  const availableHeight = OG_HEIGHT - paddingTop - paddingBottom;

  const scale = Math.min(
    availableWidth / contentWidth,
    availableHeight / contentHeight,
    0.8
  );

  const scaledWidth = contentWidth * scale;
  const scaledHeight = contentHeight * scale;

  return {
    scale,
    offsetX: (OG_WIDTH - scaledWidth) / 2 - minX * scale,
    offsetY: paddingTop + (availableHeight - scaledHeight) / 2 - minY * scale,
  };
}

function transformPosition(
  x: number,
  y: number,
  viewport: Viewport
): { x: number; y: number } {
  return {
    x: x * viewport.scale + viewport.offsetX,
    y: y * viewport.scale + viewport.offsetY,
  };
}

function buildEdgeLines(
  edges: WorkflowEdge[],
  nodeCenters: Map<string, { x: number; y: number }>
): EdgeLine[] {
  const lines: EdgeLine[] = [];
  for (const edge of edges) {
    const src = nodeCenters.get(edge.source);
    const tgt = nodeCenters.get(edge.target);
    if (src && tgt) {
      lines.push({
        id: edge.id,
        x1: src.x,
        y1: src.y,
        x2: tgt.x,
        y2: tgt.y,
        midY: (src.y + tgt.y) / 2,
      });
    }
  }
  return lines;
}

type OGRenderData = {
  nodes: WorkflowNode[];
  edges: EdgeLine[];
  viewport: Viewport;
  ns: number;
  title: string;
  description: string | null;
  triggerLabel: string | undefined;
  actionCount: number;
  category: string | null;
  protocol: string | null;
};

function prepareRenderData(workflowData: {
  name: string;
  description: string | null;
  nodes: unknown[];
  edges: unknown[];
  category: string | null;
  protocol: string | null;
}): OGRenderData {
  const allNodes = (workflowData.nodes ?? []) as WorkflowNode[];
  const nodes = allNodes.filter((n) => n.data?.type !== "add" && n.position);
  const rawEdges = (workflowData.edges ?? []) as WorkflowEdge[];

  const viewport = calculateViewport(nodes, 260, 120, 100);
  const ns = 192 * viewport.scale;

  const nodeCenters = new Map<string, { x: number; y: number }>();
  for (const node of nodes) {
    const pos = transformPosition(node.position.x, node.position.y, viewport);
    nodeCenters.set(node.id, { x: pos.x + ns / 2, y: pos.y + ns / 2 });
  }

  const triggerNode = nodes.find((n) => n.data.type === "trigger");

  return {
    nodes,
    edges: buildEdgeLines(rawEdges, nodeCenters),
    viewport,
    ns,
    title: workflowData.name,
    description: workflowData.description,
    triggerLabel: triggerNode?.data.label,
    actionCount: nodes.filter((n) => n.data.type === "action").length,
    category: workflowData.category,
    protocol: workflowData.protocol,
  };
}

function renderWorkflowOG(data: OGRenderData): ImageResponse {
  const { nodes, edges, viewport, ns } = data;

  return renderOGImage(
    <OGBase>
      {/* Edge lines - vertical from source */}
      {edges.map((line) => (
        <div
          key={`${line.id}-v1`}
          style={{
            position: "absolute",
            left: line.x1 - 1,
            top: Math.min(line.y1, line.midY),
            width: 2,
            height: Math.abs(line.midY - line.y1) || 1,
            backgroundColor: EDGE_COLOR,
          }}
        />
      ))}

      {/* Edge lines - horizontal */}
      {edges
        .filter((line) => Math.abs(line.x2 - line.x1) >= 2)
        .map((line) => (
          <div
            key={`${line.id}-h`}
            style={{
              position: "absolute",
              left: Math.min(line.x1, line.x2),
              top: line.midY - 1,
              width: Math.abs(line.x2 - line.x1),
              height: 2,
              backgroundColor: EDGE_COLOR,
            }}
          />
        ))}

      {/* Edge lines - vertical to target */}
      {edges.map((line) => (
        <div
          key={`${line.id}-v2`}
          style={{
            position: "absolute",
            left: line.x2 - 1,
            top: Math.min(line.y2, line.midY),
            width: 2,
            height: Math.abs(line.y2 - line.midY) || 1,
            backgroundColor: EDGE_COLOR,
          }}
        />
      ))}

      {/* Workflow nodes */}
      {nodes.map((node) => {
        const pos = transformPosition(
          node.position.x,
          node.position.y,
          viewport
        );
        const nodeSquare = Math.max(ns * 0.55, 88);
        const isTrigger = node.data.type === "trigger";
        const label = node.data.label ?? "";
        const iconSize = Math.max(nodeSquare * 0.28, 22);

        return (
          <div
            key={node.id}
            style={{
              position: "absolute",
              left: pos.x + (ns - nodeSquare) / 2,
              top: pos.y + (ns - nodeSquare) / 2,
              width: nodeSquare,
              height: nodeSquare,
              borderRadius: 12,
              backgroundColor: CARD_COLOR,
              border: `2px solid ${isTrigger ? NODE_BORDER_GREEN_BRIGHT : NODE_BORDER_GREEN}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
              gap: 6,
            }}
          >
            {/* biome-ignore lint/a11y/useAltText: OG image render context */}
            {/* biome-ignore lint/performance/noImgElement: Satori requires img */}
            <img
              height={iconSize}
              src={getNodeIcon(label)}
              style={{ width: iconSize, height: iconSize }}
              width={iconSize}
            />
            <div
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.55)",
                fontWeight: 500,
                textAlign: "center",
                padding: "0 6px",
              }}
            >
              {truncate(label, 14)}
            </div>
          </div>
        );
      })}

      {/* Top content */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "55%",
          display: "flex",
          flexDirection: "column",
          padding: "40px 56px 0",
        }}
      >
        <Header />
        <div
          style={{
            display: "flex",
            fontSize: 52,
            fontWeight: 700,
            color: "#ffffff",
            marginTop: 36,
            lineHeight: 1.15,
          }}
        >
          {truncate(data.title, 50)}
        </div>
        {data.description ? (
          <div
            style={{
              display: "flex",
              fontSize: 22,
              color: "rgba(255,255,255,0.5)",
              marginTop: 14,
              lineHeight: 1.4,
            }}
          >
            {truncate(data.description, 120)}
          </div>
        ) : null}
      </div>

      <Footer>
        {data.triggerLabel ? (
          <div style={{ display: "flex" }}>{data.triggerLabel}</div>
        ) : null}
        <div style={{ display: "flex" }}>
          {data.actionCount} {data.actionCount === 1 ? "action" : "actions"}
        </div>
        {data.category ? (
          <div style={{ display: "flex" }}>{data.category}</div>
        ) : null}
        {data.protocol ? (
          <div style={{ display: "flex" }}>{data.protocol}</div>
        ) : null}
      </Footer>
    </OGBase>,
    3600
  );
}

export async function generateWorkflowOGImage(
  workflowId: string
): Promise<Response> {
  try {
    const workflow = await db.query.workflows.findFirst({
      where: eq(workflows.id, workflowId),
      columns: {
        name: true,
        description: true,
        nodes: true,
        edges: true,
        visibility: true,
        category: true,
        protocol: true,
      },
    });

    if (!workflow) {
      return new Response("Workflow not found", { status: 404 });
    }

    if (workflow.visibility !== "public") {
      return new Response("Workflow is private", { status: 403 });
    }

    const data = prepareRenderData({
      name: workflow.name,
      description: workflow.description,
      // biome-ignore lint/suspicious/noExplicitAny: JSONB column type from Drizzle schema
      nodes: workflow.nodes as any[],
      // biome-ignore lint/suspicious/noExplicitAny: JSONB column type from Drizzle schema
      edges: workflow.edges as any[],
      category: workflow.category ?? null,
      protocol: workflow.protocol ?? null,
    });

    return renderWorkflowOG(data);
  } catch {
    return new Response("Failed to generate image", { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Shared layout components
// ---------------------------------------------------------------------------

function Header(): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        {/* biome-ignore lint/a11y/useAltText: OG image render context */}
        {/* biome-ignore lint/performance/noImgElement: Satori requires img */}
        <img
          height={28}
          src={LOGO_SVG}
          style={{ width: 18, height: 28 }}
          width={18}
        />
        <div
          style={{
            display: "flex",
            fontSize: 20,
            fontWeight: 600,
            color: "rgba(255,255,255,0.85)",
          }}
        >
          KeeperHub
        </div>
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 16,
          color: "rgba(255,255,255,0.3)",
        }}
      >
        app.keeperhub.com
      </div>
    </div>
  );
}

function Footer({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: "18%",
        display: "flex",
        flexDirection: "row",
        alignItems: "flex-end",
        padding: "0 56px 36px",
        gap: 32,
        fontSize: 18,
        fontWeight: 500,
        color: "rgba(255,255,255,0.45)",
      }}
    >
      {children}
    </div>
  );
}
