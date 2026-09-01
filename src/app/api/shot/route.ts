import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

/* Proxies the rendered page capture so the browser can read it back off a
   canvas — a cross-origin image taints the canvas and getImageData throws.
   Primary renderer is real headless Chrome; thum.io is a fallback because it
   silently returns a nav-only frame on JS-heavy pages. */

function sources(url: string, width: number) {
  const enc = encodeURIComponent(url);
  return [
    // real Chrome, waits for the network to settle, 1x so the buffer stays sane
    `https://api.microlink.io/?url=${enc}&screenshot=true&meta=false&embed=screenshot.url` +
      `&viewport.width=${width}&viewport.height=1600&viewport.deviceScaleFactor=1` +
      `&waitUntil=networkidle2&screenshot.type=png`,
    `https://image.thum.io/get/width/${width}/crop/1600/noanimate/${url}`,
  ];
}

export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get("url");
  if (!target) return new Response("missing url", { status: 400 });

  const url = /^https?:\/\//i.test(target) ? target : `https://${target}`;
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return new Response("bad protocol", { status: 400 });
  } catch { return new Response("bad url", { status: 400 }); }

  const width = Number(req.nextUrl.searchParams.get("w") ?? 1280);
  let last = "no renderer responded";

  for (const src of sources(url, width)) {
    try {
      const res = await fetch(src, { signal: AbortSignal.timeout(75_000), redirect: "follow" });
      if (!res.ok) { last = `renderer returned HTTP ${res.status}`; continue; }
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("image")) { last = "renderer did not return an image"; continue; }
      const buf = await res.arrayBuffer();
      if (buf.byteLength < 4000) { last = "renderer returned an empty frame"; continue; }
      return new Response(buf, {
        headers: { "content-type": "image/png", "cache-control": "public, max-age=3600" },
      });
    } catch {
      last = "renderer timed out";
    }
  }
  return new Response(last, { status: 502 });
}
