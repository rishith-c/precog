import { NextRequest, NextResponse } from "next/server";
import { PRIORS } from "@/lib/forecast";
import { runAnalysis, RunError } from "@/lib/pipeline";
import { clientKey, limit, limitHeaders } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 120;

/* The keyless endpoint. Same pipeline as the account API, nothing saved,
   rate-limited by client. It exists so a stranger — or a published Play —
   can run one page without making an account first, which is the whole
   time-to-first-value argument. */
export async function GET(req: NextRequest) {
  const v = limit(`anon:${clientKey(req)}`, 6, 60_000);
  if (!v.ok)
    return NextResponse.json(
      { error: `rate limited — ${v.limit} anonymous runs a minute; make an API key for more` },
      { status: 429, headers: limitHeaders(v) },
    );

  const target = req.nextUrl.searchParams.get("url");
  if (!target) return NextResponse.json({ error: "missing url" }, { status: 400, headers: limitHeaders(v) });

  try {
    const { page, bands, enc, fc, width, height, informative, ms } = await runAnalysis(target);
    return NextResponse.json(
      {
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
        networks: { peak: enc.peak, sustained: enc.mean, focus: Number(enc.focus.toFixed(3)), frames: enc.frames.map((f) => f.values) },
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
        capture: { width, height, bands: bands.length, informative: Number(informative.toFixed(2)) },
        saved: false,
        ms,
      },
      { headers: { ...limitHeaders(v), "cache-control": "no-store" } },
    );
  } catch (e) {
    if (e instanceof RunError) return NextResponse.json({ error: e.message }, { status: e.status, headers: limitHeaders(v) });
    return NextResponse.json({ error: e instanceof Error ? e.message : "analysis failed" }, { status: 500, headers: limitHeaders(v) });
  }
}
