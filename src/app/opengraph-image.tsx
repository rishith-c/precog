import { ImageResponse } from "next/og";

/* nodejs, not edge: on this Next build the edge variant returned a 200 with a
   zero-byte body in production. ImageResponse renders fine on nodejs. */
export const runtime = "nodejs";
export const alt = "Precog — see the click before you ship the page";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/* Monochrome, like the site. The serif is the system's; shipping Instrument
   Serif here would mean bundling the font file for one image. */
export default function OG() {
  return new ImageResponse(
    (
      <div style={{
        width: "100%", height: "100%", background: "#fbfbfd", color: "#1d1d1f",
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        padding: 72, fontFamily: "Georgia, serif",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 4, fontSize: 28 }}>
          <span>Precog</span><span style={{ fontSize: 14, fontFamily: "monospace" }}>®</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", gap: 22, fontSize: 96, lineHeight: 0.98, letterSpacing: -3 }}>
            <span>See the click</span><span style={{ fontStyle: "italic" }}>before</span>
          </div>
          <div style={{ fontSize: 96, lineHeight: 0.98, letterSpacing: -3 }}>you ship the page.</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "monospace", fontSize: 18, color: "#6e6e73", letterSpacing: 2 }}>
          <span>NEURAL PRE-FLIGHT · EVERY COEFFICIENT PRINTED</span>
          <span>precog-tau.vercel.app</span>
        </div>
      </div>
    ),
    size,
  );
}
