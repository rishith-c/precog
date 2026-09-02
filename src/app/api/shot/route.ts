import { NextRequest } from "next/server";
import { capture } from "@/lib/capture";

export const runtime = "nodejs";
export const maxDuration = 120;

/* Proxies a live capture so the browser can read it back off a canvas — a
   cross-origin image taints the canvas and getImageData throws. Saved runs
   do not come through here; they serve the frame they measured, from
   /api/capture. */
export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get("url");
  if (!target) return new Response("missing url", { status: 400 });
  const width = Number(req.nextUrl.searchParams.get("w") ?? 1280);

  try {
    const png = await capture(target, width);
    return new Response(png as BodyInit, {
      headers: { "content-type": "image/png", "cache-control": "public, max-age=3600" },
    });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "capture failed", { status: 502 });
  }
}
