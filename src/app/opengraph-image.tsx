import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AoE2Meta — Age of Empires II Statistics & Meta";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0f0f0f",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
        }}
      >
        {/* Orange top border */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 6, background: "#f97316" }} />

        {/* Logo area */}
        <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 32 }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 16,
              background: "#1a1a1a",
              border: "2px solid #f97316",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
            }}
          >
            ⚔️
          </div>
          <div style={{ color: "#f97316", fontSize: 64, fontWeight: 800, letterSpacing: -2 }}>
            AoE2Meta
          </div>
        </div>

        {/* Tagline */}
        <div style={{ color: "#ffffff", fontSize: 28, fontWeight: 500, textAlign: "center", maxWidth: 800 }}>
          Age of Empires II Statistics, Meta & Leaderboards
        </div>
        <div style={{ color: "#888888", fontSize: 20, marginTop: 16, textAlign: "center" }}>
          Civilization win rates · Player rankings · Match history
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 48, marginTop: 48 }}>
          {["Civ Win Rates", "Live Leaderboards", "Player Profiles", "Match History"].map((label) => (
            <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div style={{ color: "#f97316", fontSize: 16, fontWeight: 600 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* URL */}
        <div style={{ position: "absolute", bottom: 32, color: "#f97316", fontSize: 20, fontWeight: 600 }}>
          aoe2meta.com
        </div>
      </div>
    ),
    { ...size }
  );
}
