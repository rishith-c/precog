import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/* Proxies the rendered page capture so the browser can read it back off a
   canvas. A cross-origin image taints the canvas and getImageData throws,
   which would kill the entire visual analysis. */
export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get("url");
  if (!target) return new Response("missing url", { status: 400 });

  const url = /^https?:\/\//i.test(target) ? target : `https://${target}`;
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return new Response("bad protocol", { status: 400 });
  } catch { return new Response("bad url", { status: 400 }); }

  const width = req.nextUrl.searchParams.get("w") ?? "1280";
  const shot = `https://image.thum.io/get/width/${width}/crop/2200/noanimate/${url}`;

  try {
    const res = await fetch(shot, { signal: AbortSignal.timeout(45000) });
    if (!res.ok) return new Response(`capture failed: HTTP ${res.status}`, { status: 502 });
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 2000) return new Response("capture returned an empty frame", { status: 502 });
    return new Response(buf, {
      headers: {
        "content-type": res.headers.get("content-type") ?? "image/png",
        "cache-control": "public, max-age=3600",
      },
    });
  } catch {
    return new Response("capture timed out", { status: 504 });
  }
}
