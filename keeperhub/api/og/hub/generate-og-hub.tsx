import { ImageResponse } from "@vercel/og";

const LOGO_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 318 500' fill='none'%3E%3Cpath d='M317.77 204.279H226.98V295.069H317.77V204.279Z' fill='%2300FF4F'/%3E%3Cpath d='M204.28 90.79V0H113.49V90.79C113.456 120.879 101.488 149.725 80.2115 171.002C58.9355 192.278 30.0889 204.246 0 204.28V295.07C30.0889 295.104 58.9355 307.072 80.2115 328.348C101.488 349.625 113.456 378.471 113.49 408.56V499.35H204.28V408.56C204.28 378.075 197.445 347.977 184.279 320.482C171.113 292.987 151.95 268.793 128.2 249.68C151.948 230.563 171.109 206.367 184.275 178.871C197.441 151.374 204.277 121.276 204.28 90.79Z' fill='%2300FF4F'/%3E%3C/svg%3E";

const DOT_SPACING = 32;
const NODE_BORDER_GREEN = "rgba(0,255,79,0.45)";
const EDGE_COLOR = "rgba(0,255,79,0.15)";

const ICON_CLOCK =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23aaaaaa' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='M12 6v6l4 2'/%3E%3C/svg%3E";
const ICON_SWAP =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23aaaaaa' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M8 3L4 7l4 4'/%3E%3Cpath d='M4 7h16'/%3E%3Cpath d='M16 21l4-4-4-4'/%3E%3Cpath d='M20 17H4'/%3E%3C/svg%3E";
const ICON_SEND =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23aaaaaa' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M22 2L11 13'/%3E%3Cpath d='M22 2l-7 20-4-9-9-4z'/%3E%3C/svg%3E";
const ICON_ZAP =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23aaaaaa' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M13 2L3 14h9l-1 8 10-12h-9l1-8z'/%3E%3C/svg%3E";
const ICON_BELL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23aaaaaa' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9'/%3E%3Cpath d='M13.73 21a2 2 0 0 1-3.46 0'/%3E%3C/svg%3E";
const ICON_BRANCH =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23aaaaaa' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 3v12'/%3E%3Ccircle cx='18' cy='6' r='3'/%3E%3Ccircle cx='6' cy='18' r='3'/%3E%3Cpath d='M18 9c0 6-6 6-12 6'/%3E%3C/svg%3E";

const HUB_ICONS: Record<string, string> = {
  Schedule: ICON_CLOCK,
  Swap: ICON_SWAP,
  Transfer: ICON_SEND,
  Monitor: ICON_ZAP,
  Notify: ICON_BELL,
  Condition: ICON_BRANCH,
};

type DotPosition = {
  x: number;
  y: number;
};

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

type CardData = {
  label: string;
  x: number;
  y: number;
};

const PREVIEW_CARDS: CardData[] = [
  { label: "Schedule", x: 140, y: 360 },
  { label: "Swap", x: 310, y: 360 },
  { label: "Transfer", x: 480, y: 360 },
  { label: "Monitor", x: 650, y: 360 },
  { label: "Notify", x: 820, y: 360 },
  { label: "Condition", x: 990, y: 360 },
];

export function generateHubOGImage(): ImageResponse {
  const width = 1200;
  const height = 630;
  const dots = generateDots(width, height, DOT_SPACING);

  return new ImageResponse(
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

      {/* Edge lines connecting cards */}
      {PREVIEW_CARDS.slice(0, -1).map((card, i) => {
        const next = PREVIEW_CARDS[i + 1];
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
      {PREVIEW_CARDS.map((card) => (
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
          background:
            "linear-gradient(180deg, rgba(17,24,39,0.95) 0%, rgba(17,24,39,0.85) 30%, rgba(17,24,39,0.4) 65%, transparent 100%)",
        }}
      >
        {/* Header */}
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

        {/* Title */}
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

        {/* Subtitle */}
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
          background:
            "linear-gradient(0deg, rgba(17,24,39,0.95) 0%, rgba(17,24,39,0.6) 50%, transparent 100%)",
        }}
      >
        <div style={{ display: "flex" }}>Featured workflows</div>
        <div style={{ display: "flex" }}>Community templates</div>
        <div style={{ display: "flex" }}>One-click deploy</div>
      </div>
    </div>,
    {
      width,
      height,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=604800",
      },
    }
  );
}
