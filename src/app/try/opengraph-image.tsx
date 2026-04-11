import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "LCA Desk — Try the Live Demo";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0B1B18",
          fontFamily: "system-ui",
        }}
      >
        {/* Top accent line */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg, #19544c, #71b59a, #8b6914)" }} />

        {/* Logo area */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: "#19544c", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: "#71b59a" }}>LC</span>
          </div>
          <span style={{ fontSize: 32, fontWeight: 700, color: "white", letterSpacing: -1 }}>LCA Desk</span>
        </div>

        {/* Main text */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 52, fontWeight: 800, color: "white", letterSpacing: -2 }}>
            Try the Live Demo
          </span>
          <span style={{ fontSize: 22, color: "rgba(255,255,255,0.6)", maxWidth: 700, textAlign: "center", lineHeight: 1.5 }}>
            See how regulators review filings and contractors submit compliance reports. Full interactive demo — no signup required.
          </span>
        </div>

        {/* Role pills */}
        <div style={{ display: "flex", gap: 16, marginTop: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: "rgba(113,181,154,0.15)", border: "1px solid rgba(113,181,154,0.3)", borderRadius: 12, padding: "10px 20px" }}>
            <span style={{ fontSize: 16, color: "#71b59a", fontWeight: 600 }}>Contractor Dashboard</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: "rgba(139,105,20,0.15)", border: "1px solid rgba(139,105,20,0.3)", borderRadius: 12, padding: "10px 20px" }}>
            <span style={{ fontSize: 16, color: "#D4AF37", fontWeight: 600 }}>Secretariat Review</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: "rgba(113,181,154,0.15)", border: "1px solid rgba(113,181,154,0.3)", borderRadius: 12, padding: "10px 20px" }}>
            <span style={{ fontSize: 16, color: "#71b59a", fontWeight: 600 }}>Job Seeker Portal</span>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{ position: "absolute", bottom: 24, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, color: "rgba(255,255,255,0.3)" }}>app.lcadesk.com/try</span>
          <span style={{ fontSize: 14, color: "rgba(255,255,255,0.15)" }}>•</span>
          <span style={{ fontSize: 14, color: "rgba(255,255,255,0.3)" }}>No signup required</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
