import { NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { getCapture, getShare } from "@/lib/db";

export const runtime = "nodejs";

/* Serves the frame a saved run actually measured. Re-rendering the page
   here would show it as it looks today, which would quietly turn a history
   feature into a lie. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const token = req.nextUrl.searchParams.get("t");

  let ownerId: string | null = null;
  if (token) {
    const share = await getShare(token);
    if (share && share.runId === id) ownerId = share.userId;
  } else {
    ownerId = (await currentUser())?.id ?? null;
  }
  if (!ownerId) return new Response("not found", { status: 404 });

  const png = await getCapture(ownerId, id);
  if (!png) return new Response("not found", { status: 404 });

  return new Response(png as BodyInit, {
    headers: {
      "content-type": "image/png",
      /* immutable: the bytes for a given run never change */
      "cache-control": token ? "public, max-age=31536000, immutable" : "private, max-age=31536000, immutable",
    },
  });
}
