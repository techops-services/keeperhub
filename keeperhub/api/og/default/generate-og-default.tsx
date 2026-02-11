import { ImageResponse } from "@vercel/og";

const LOGO_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 318 500' fill='none'%3E%3Cpath d='M317.77 204.279H226.98V295.069H317.77V204.279Z' fill='%2300FF4F'/%3E%3Cpath d='M204.28 90.79V0H113.49V90.79C113.456 120.879 101.488 149.725 80.2115 171.002C58.9355 192.278 30.0889 204.246 0 204.28V295.07C30.0889 295.104 58.9355 307.072 80.2115 328.348C101.488 349.625 113.456 378.471 113.49 408.56V499.35H204.28V408.56C204.28 378.075 197.445 347.977 184.279 320.482C171.113 292.987 151.95 268.793 128.2 249.68C151.948 230.563 171.109 206.367 184.275 178.871C197.441 151.374 204.277 121.276 204.28 90.79Z' fill='%2300FF4F'/%3E%3C/svg%3E";

const DOT_SPACING = 32;

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

export function generateDefaultOGImage(): ImageResponse {
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

      {/* Subtle vignette overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%)",
        }}
      />

      {/* Centered content */}
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

      {/* Domain - top right */}
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
    {
      width,
      height,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=604800",
      },
    }
  );
}
