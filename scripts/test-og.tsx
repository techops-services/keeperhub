import { writeFileSync } from "node:fs";
import { ImageResponse } from "@vercel/og";

const LOGO_SVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 318 500' fill='none'%3E%3Cpath d='M317.77 204.279H226.98V295.069H317.77V204.279Z' fill='%2300FF4F'/%3E%3Cpath d='M204.28 90.79V0H113.49V90.79C113.456 120.879 101.488 149.725 80.2115 171.002C58.9355 192.278 30.0889 204.246 0 204.28V295.07C30.0889 295.104 58.9355 307.072 80.2115 328.348C101.488 349.625 113.456 378.471 113.49 408.56V499.35H204.28V408.56C204.28 378.075 197.445 347.977 184.279 320.482C171.113 292.987 151.95 268.793 128.2 249.68C151.948 230.563 171.109 206.367 184.275 178.871C197.441 151.374 204.277 121.276 204.28 90.79Z' fill='%2300FF4F'/%3E%3C/svg%3E`;

const DOT_SPACING = 32;

const NODE_BORDER_GREEN = "rgba(0,255,79,0.45)";
const NODE_BORDER_GREEN_BRIGHT = "rgba(0,255,79,0.65)";
const EDGE_COLOR = "rgba(0,255,79,0.15)";

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

function getNodeIcon(label: string): string {
  const lower = label.toLowerCase();
  const match = ICON_RULES.find((rule) =>
    rule.keywords.some((kw) => lower.includes(kw))
  );
  return match?.icon ?? ICON_PLAY;
}

type NodeData = {
  id: string;
  position: { x: number; y: number };
  data: { type: "trigger" | "action" | "add"; label?: string };
};

type TestCase = {
  name: string;
  description: string | null;
  nodes: Array<{
    id: string;
    data: { type: "trigger" | "action" | "add"; label?: string };
  }>;
  edges: Array<{ source: string; target: string }>;
  category: string | null;
  protocol: string | null;
  filename: string;
};

function layoutNodes(simpleNodes: TestCase["nodes"]): NodeData[] {
  const maxPerRow = 5;
  const xSpacing = 200;
  const ySpacing = 160;
  const rows = Math.ceil(simpleNodes.length / maxPerRow);
  const centerY = 460;
  const startY = centerY - ((rows - 1) * ySpacing) / 2;

  return simpleNodes.map((n, i) => {
    const row = Math.floor(i / maxPerRow);
    const col = i % maxPerRow;
    const nodesInRow = Math.min(
      maxPerRow,
      simpleNodes.length - row * maxPerRow
    );
    const rowOffset = ((maxPerRow - nodesInRow) * xSpacing) / 2;

    return {
      ...n,
      position: {
        x: rowOffset + col * xSpacing,
        y: startY + row * ySpacing,
      },
    };
  });
}

function calculateViewport(
  nodes: NodeData[],
  width: number,
  height: number,
  paddingTop: number,
  paddingBottom: number,
  paddingSides: number
): { scale: number; offsetX: number; offsetY: number } {
  if (nodes.length === 0) {
    return { scale: 1, offsetX: width / 2, offsetY: height / 2 };
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
  const cw = maxX - minX || 1;
  const ch = maxY - minY || 1;
  const aw = width - paddingSides * 2;
  const ah = height - paddingTop - paddingBottom;
  const scale = Math.min(aw / cw, ah / ch, 0.8);
  const sw = cw * scale;
  const sh = ch * scale;
  return {
    scale,
    offsetX: (width - sw) / 2 - minX * scale,
    offsetY: paddingTop + (ah - sh) / 2 - minY * scale,
  };
}

function tp(
  x: number,
  y: number,
  vp: { scale: number; offsetX: number; offsetY: number }
) {
  return { x: x * vp.scale + vp.offsetX, y: y * vp.scale + vp.offsetY };
}

function generateDots(
  w: number,
  h: number,
  s: number
): Array<{ x: number; y: number }> {
  const dots: Array<{ x: number; y: number }> = [];
  for (let x = s; x < w; x += s) {
    for (let y = s; y < h; y += s) {
      dots.push({ x, y });
    }
  }
  return dots;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

async function renderOG(tc: TestCase): Promise<void> {
  const nodes = layoutNodes(tc.nodes);
  const width = 1200;
  const height = 630;
  const vp = calculateViewport(nodes, width, height, 260, 120, 100);
  const ns = 192 * vp.scale;
  const dots = generateDots(width, height, DOT_SPACING);

  const nodeCenters = new Map<string, { x: number; y: number }>();
  for (const node of nodes) {
    const pos = tp(node.position.x, node.position.y, vp);
    nodeCenters.set(node.id, { x: pos.x + ns / 2, y: pos.y + ns / 2 });
  }

  type EdgeLine = {
    key: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    midY: number;
  };

  const edgeLines: EdgeLine[] = [];
  for (const edge of tc.edges) {
    const src = nodeCenters.get(edge.source);
    const tgt = nodeCenters.get(edge.target);
    if (src && tgt) {
      edgeLines.push({
        key: `${edge.source}-${edge.target}`,
        x1: src.x,
        y1: src.y,
        x2: tgt.x,
        y2: tgt.y,
        midY: (src.y + tgt.y) / 2,
      });
    }
  }

  const triggerLabel = tc.nodes.find((n) => n.data.type === "trigger")?.data
    .label;
  const actionCount = tc.nodes.filter((n) => n.data.type === "action").length;

  const img = new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        backgroundColor: "#111827",
      }}
    >
      {/* Dot pattern background */}
      {dots.map((dot) => (
        <div
          key={`dot-${dot.x}-${dot.y}`}
          style={{
            position: "absolute",
            left: dot.x - 1,
            top: dot.y - 1,
            width: 2,
            height: 2,
            borderRadius: 1,
            backgroundColor: "rgba(255,255,255,0.18)",
          }}
        />
      ))}

      {/* Vignette + top/bottom fade in a single overlay to avoid seam lines */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background:
            "linear-gradient(180deg, rgba(17,24,39,0.95) 0%, rgba(17,24,39,0.85) 15%, rgba(17,24,39,0.4) 35%, rgba(17,24,39,0.3) 50%, rgba(17,24,39,0.4) 65%, rgba(17,24,39,0.6) 80%, rgba(17,24,39,0.95) 100%)",
        }}
      />

      {/* Edge lines - vertical from source */}
      {edgeLines.map((line) => (
        <div
          key={`${line.key}-v1`}
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
      {edgeLines
        .filter((line) => Math.abs(line.x2 - line.x1) >= 2)
        .map((line) => (
          <div
            key={`${line.key}-h`}
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
      {edgeLines.map((line) => (
        <div
          key={`${line.key}-v2`}
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

      {/* Workflow nodes - icon + label inside card */}
      {nodes.map((node) => {
        const pos = tp(node.position.x, node.position.y, vp);
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
              backgroundColor: "#1e293b",
              border: `2px solid ${isTrigger ? NODE_BORDER_GREEN_BRIGHT : NODE_BORDER_GREEN}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
              gap: 6,
            }}
          >
            {/* biome-ignore lint/a11y/useAltText: test script OG render */}
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
            {/* biome-ignore lint/a11y/useAltText: test script */}
            {/* biome-ignore lint/performance/noImgElement: Satori */}
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
          {truncate(tc.name, 50)}
        </div>
        {tc.description ? (
          <div
            style={{
              display: "flex",
              fontSize: 22,
              color: "rgba(255,255,255,0.5)",
              marginTop: 14,
              lineHeight: 1.4,
            }}
          >
            {truncate(tc.description, 120)}
          </div>
        ) : null}
      </div>

      {/* Footer pinned to bottom */}
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
        {triggerLabel ? (
          <div style={{ display: "flex" }}>{triggerLabel}</div>
        ) : null}
        <div style={{ display: "flex" }}>
          {actionCount} {actionCount === 1 ? "action" : "actions"}
        </div>
        {tc.category ? (
          <div style={{ display: "flex" }}>{tc.category}</div>
        ) : null}
        {tc.protocol ? (
          <div style={{ display: "flex" }}>{tc.protocol}</div>
        ) : null}
      </div>
    </div>,
    { width, height }
  );

  const buf = Buffer.from(await img.arrayBuffer());
  writeFileSync(`/tmp/${tc.filename}`, buf);
  console.log(`${tc.filename}: ${buf.length} bytes -> /tmp/${tc.filename}`);
}

async function renderDefaultOG(): Promise<void> {
  const width = 1200;
  const height = 630;
  const dots = generateDots(width, height, DOT_SPACING);

  const img = new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        backgroundColor: "#111827",
      }}
    >
      {dots.map((dot) => (
        <div
          key={`dot-${dot.x}-${dot.y}`}
          style={{
            position: "absolute",
            left: dot.x - 1,
            top: dot.y - 1,
            width: 2,
            height: 2,
            borderRadius: 1,
            backgroundColor: "rgba(255,255,255,0.18)",
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%)",
        }}
      />
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
        {/* biome-ignore lint/a11y/useAltText: test script */}
        {/* biome-ignore lint/performance/noImgElement: Satori */}
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
    </div>,
    { width, height }
  );

  const buf = Buffer.from(await img.arrayBuffer());
  writeFileSync("/tmp/og-default.png", buf);
  console.log(`og-default.png: ${buf.length} bytes -> /tmp/og-default.png`);
}

const cases: TestCase[] = [
  {
    name: "Monitor Large USDC Transfers",
    description:
      "Watches for USDC transfers over $100k on Ethereum and sends Discord alerts with transaction details.",
    nodes: [
      { id: "t1", data: { type: "trigger", label: "On-Chain Event" } },
      { id: "a1", data: { type: "action", label: "Check Balance" } },
      { id: "a2", data: { type: "action", label: "Condition" } },
      { id: "a3", data: { type: "action", label: "Send Discord" } },
    ],
    edges: [
      { source: "t1", target: "a1" },
      { source: "a1", target: "a2" },
      { source: "a2", target: "a3" },
    ],
    category: "DeFi",
    protocol: "Ethereum",
    filename: "og-workflow.png",
  },
  {
    name: "Complex DeFi Strategy Pipeline",
    description:
      "Multi-step DeFi automation that monitors prices, swaps, manages liquidity, and reports.",
    nodes: [
      { id: "t1", data: { type: "trigger", label: "Price Monitor" } },
      { id: "a1", data: { type: "action", label: "Fetch Prices" } },
      { id: "a2", data: { type: "action", label: "Calc Spread" } },
      { id: "a3", data: { type: "action", label: "Swap Tokens" } },
      { id: "a4", data: { type: "action", label: "Add Liquidity" } },
      { id: "a5", data: { type: "action", label: "Check Position" } },
      { id: "a6", data: { type: "action", label: "Send Report" } },
      { id: "a7", data: { type: "action", label: "Log Results" } },
    ],
    edges: [
      { source: "t1", target: "a1" },
      { source: "a1", target: "a2" },
      { source: "a2", target: "a3" },
      { source: "a3", target: "a4" },
      { source: "a4", target: "a5" },
      { source: "a5", target: "a6" },
      { source: "a6", target: "a7" },
    ],
    category: "DeFi",
    protocol: "Polygon",
    filename: "og-many-nodes.png",
  },
  {
    name: "Simple Webhook Listener",
    description: null,
    nodes: [{ id: "t1", data: { type: "trigger", label: "Webhook" } }],
    edges: [],
    category: null,
    protocol: null,
    filename: "og-minimal.png",
  },
];

const HUB_ICONS: Record<string, string> = {
  Schedule: ICON_CLOCK,
  Swap: ICON_SWAP,
  Transfer: ICON_SEND,
  Monitor: ICON_ZAP,
  Notify: ICON_BELL,
  Condition: ICON_BRANCH,
};

type HubCard = {
  label: string;
  x: number;
  y: number;
};

const HUB_CARDS: HubCard[] = [
  { label: "Schedule", x: 140, y: 360 },
  { label: "Swap", x: 310, y: 360 },
  { label: "Transfer", x: 480, y: 360 },
  { label: "Monitor", x: 650, y: 360 },
  { label: "Notify", x: 820, y: 360 },
  { label: "Condition", x: 990, y: 360 },
];

async function renderHubOG(): Promise<void> {
  const width = 1200;
  const height = 630;
  const dots = generateDots(width, height, DOT_SPACING);

  const img = new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        backgroundColor: "#111827",
      }}
    >
      {dots.map((dot) => (
        <div
          key={`dot-${dot.x}-${dot.y}`}
          style={{
            position: "absolute",
            left: dot.x - 1,
            top: dot.y - 1,
            width: 2,
            height: 2,
            borderRadius: 1,
            backgroundColor: "rgba(255,255,255,0.18)",
          }}
        />
      ))}
      {/* Vignette + top/bottom fade in a single overlay to avoid seam lines */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background:
            "linear-gradient(180deg, rgba(17,24,39,0.95) 0%, rgba(17,24,39,0.85) 15%, rgba(17,24,39,0.4) 35%, rgba(17,24,39,0.3) 50%, rgba(17,24,39,0.4) 65%, rgba(17,24,39,0.6) 80%, rgba(17,24,39,0.95) 100%)",
        }}
      />

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
            backgroundColor: "#1e293b",
            border: `1.5px solid ${NODE_BORDER_GREEN}`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
            gap: 4,
          }}
        >
          {/* biome-ignore lint/a11y/useAltText: test script OG render */}
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
            {/* biome-ignore lint/a11y/useAltText: test script */}
            {/* biome-ignore lint/performance/noImgElement: Satori */}
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

      {/* Footer */}
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
        <div style={{ display: "flex" }}>Featured workflows</div>
        <div style={{ display: "flex" }}>Community templates</div>
        <div style={{ display: "flex" }}>One-click deploy</div>
      </div>
    </div>,
    { width, height }
  );

  const buf = Buffer.from(await img.arrayBuffer());
  writeFileSync("/tmp/og-hub.png", buf);
  console.log(`og-hub.png: ${buf.length} bytes -> /tmp/og-hub.png`);
}

async function main(): Promise<void> {
  for (const tc of cases) {
    await renderOG(tc);
  }
  await renderDefaultOG();
  await renderHubOG();
  process.exit(0);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
