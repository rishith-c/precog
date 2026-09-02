import { NextRequest, NextResponse } from "next/server";
import { PRIORS } from "@/lib/forecast";
import { hostOf, runAnalysis, RunError } from "@/lib/pipeline";
import {
  countRun, id, projectForHost, putCapture, quota, saveRun, userForApiKey, type StoredRun,
} from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 120;

/* The public API. One call, whole pipeline, JSON out — the same function
   the app calls, so a scripted run and a run made in the browser cannot
   produce different numbers for the same page. Runs land in the account
   and count against its quota, exactly like one made by hand. */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const key = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!key)
    return NextResponse.json({ error: "missing API key — send Authorization: Bearer pk_…" }, { status: 401 });

  const user = await userForApiKey(key);
  if (!user) return NextResponse.json({ error: "that API key is not valid" }, { status: 401 });

  const q = quota(user);
  if (q.over)
    return NextResponse.json({ error: `quota exhausted — ${q.used}/${q.limit} runs this month` }, { status: 429 });

  const target = req.nextUrl.searchParams.get("url");
  if (!target) return NextResponse.json({ error: "missing url" }, { status: 400 });

  try {
    const { page, bands, enc, fc, png, width, height, ms } = await runAnalysis(target);

    const host = hostOf(page.finalUrl);
    const project = await projectForHost(user.id, host);
    const run: StoredRun = {
      id: id(10), userId: user.id, projectId: project.id,
      label: new URL(page.finalUrl).pathname.replace(/^\/$/, "home"),
      url: page.finalUrl, host, at: Date.now(), ms,
      page, bands, enc, fc, capture: { w: width, h: height },
    };
    await putCapture(user.id, run.id, png);
    await saveRun(run);
    await countRun(user);

    return NextResponse.json({
      id: run.id,
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
      capture: { width, height, bands: bands.length },
      quota: { used: q.used + 1, limit: q.limit },
      ms,
    });
  } catch (e) {
    if (e instanceof RunError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: e instanceof Error ? e.message : "analysis failed" }, { status: 500 });
  }
}
