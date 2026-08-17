import { ImageResponse } from "next/og";

export const alt = "Himanshu Kumar — Software Engineer, Agentic AI Engineer, and Data Science portfolio.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "#f1ece2",
          color: "#101714",
          border: "18px solid #101714",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, letterSpacing: 3 }}>
          <span>HK / SOFTWARE ENGINEER</span>
          <span style={{ color: "#00634f" }}>SELECTED PROJECTS / 2026</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 960 }}>
          <div style={{ width: 116, height: 8, marginBottom: 32, background: "#e95638" }} />
          <div style={{ fontFamily: "Georgia, serif", fontSize: 92, lineHeight: 0.94, letterSpacing: -5 }}>
            I build software products end to end.
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20 }}>
          <span>Software Engineer · Agentic AI Engineer · Data Science</span>
          <span>Projects · Features · Tested results</span>
        </div>
      </div>
    ),
    size,
  );
}
