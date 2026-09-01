import { NextRequest, NextResponse } from "next/server";
import { extractPage } from "@/lib/page";
import { decodePng } from "@/lib/png";
import { computeBands, captureQuality } from "@/lib/bandstats";
import { encode } from "@/lib/encoder";
import { forecast, PRIORS } from "@/lib/forecast";

export const runtime = "nodejs";
export const maxDuration = 120;

/* One call, whole pipeline, JSON out. This is the endpoint a script or an
   agent drives; the browser UI runs the identical maths client-side. */
export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get("url");
  if (!target) return NextResponse.json({ error: "missing url" }, { status: 400 });
  const t0 = Date.now();

  try {
    const shotUrl = `${req.nextUrl.origin}/api/shot?url=${encodeURIComponent(target)}&w=1280`;
    const [pageRes, shotRes] = await Promise.allSettled([
      extractPage(target),
      fetch(shotUrl, { signal: AbortSignal.timeout(60_000) }),
    ]);

    if (pageRes.status === "rejected")
      return NextResponse.json({ error: `could not read the page: ${pageRes.reason?.message ?? "unreachable"}` }, { status: 502 });
    const page = pageRes.value;

    if (shotRes.status === "rejected" || !shotRes.value.ok)
      return NextResponse.json({ error: "could not capture the rendered page" }, { status: 502 });

    const png = Buffer.from(await shotRes.value.arrayBuffer());
    const { data, width, height } = decodePng(png);
    const bands = computeBands(data, width, height, 12);

    const q = captureQuality(bands);
    if (!q.ok) return NextResponse.json({ error: `capture is not measurable: ${q.reason}` }, { status: 422 });

    const enc = encode(bands, page);
    const fc = forecast(enc, page);

    return NextResponse.json({
      url: page.finalUrl,
      ctr: Number(fc.ctr.toFixed(2)),
      interval: [Number(fc.ctrLow.toFixed(2)), Number(fc.ctrHigh.toFixed(2))],
      grade: fc.grade,
      signals: {
        noticeability: Number(fc.noticeability.toFixed(3)),
        intent: Number(fc.intent.toFixed(3)),
        friction: Number(fc.friction.toFixed(3)),
        scrollDepth: Math.round(fc.scrollDepth),
        recall: Number(fc.recall.toFixed(3)),
      },
      networks: { peak: enc.peak, sustained: enc.mean },
      fixes: fc.fixes,
      derivation: fc.derivation,
      priors: PRIORS,
      encoder: enc.source,
      notes: enc.notes,
      stimulus: {
        words: page.words, avgWordLen: Number(page.avgWordLen.toFixed(2)),
        headings: page.headings, ctas: page.ctas, ctaCount: page.ctaCount,
        links: page.links, images: page.images, formFields: page.formFields,
        valueWords: page.valueWords, socialProof: page.socialProof,
        urgencyWords: page.urgencyWords, frictionWords: page.frictionWords,
        jargonWords: page.jargonWords, hasPricing: page.hasPricing,
      },
      capture: { width, height, bands: bands.length, informative: Number(q.informative.toFixed(2)) },
      ms: Date.now() - t0,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "analysis failed" }, { status: 500 });
  }
}
