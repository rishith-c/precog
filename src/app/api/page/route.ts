import { NextRequest, NextResponse } from "next/server";
import { extractPage } from "@/lib/page";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "missing url" }, { status: 400 });
  try {
    return NextResponse.json(await extractPage(url));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "could not read the page" },
      { status: 502 }
    );
  }
}
