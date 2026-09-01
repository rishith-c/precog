import { NextRequest, NextResponse } from "next/server";
import { callTribe } from "@/lib/tribe";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const { url } = await req.json();
  if (!url) return NextResponse.json({ ok: false, error: "missing url" }, { status: 400 });

  const origin = req.nextUrl.origin;
  const shot = await fetch(`${origin}/api/shot?url=${encodeURIComponent(url)}`);
  if (!shot.ok) return NextResponse.json({ ok: false, error: "capture unavailable" });

  return NextResponse.json(await callTribe(await shot.arrayBuffer()));
}
