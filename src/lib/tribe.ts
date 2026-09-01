/* ------------------------------------------------------------------
   TIER 0 — the real Meta TRIBE v2 encoder, reached through a public
   Gradio Space that wraps facebook/tribev2 (CC-BY-NC 4.0).

   These Spaces run on shared ZeroGPU quota and fail often. Every call is
   bounded and every failure is reported as a failure — Precog never
   silently relabels its own estimator as TRIBE output.
   ------------------------------------------------------------------ */

const SPACES = [
  "https://vishnuverse-in-ad-brain-scorer.hf.space",
  "https://Lakshita10-instagram-content-impact-predictor.hf.space",
];

export interface TribeResult {
  ok: boolean;
  space?: string;
  scores?: Record<string, number>;
  raw?: string;
  error?: string;
}

export async function callTribe(png: ArrayBuffer, timeoutMs = 110_000): Promise<TribeResult> {
  let lastErr = "no TRIBE endpoint responded";

  for (const base of SPACES) {
    try {
      const fd = new FormData();
      fd.append("files", new Blob([png], { type: "image/png" }), "page.png");
      const up = await fetch(`${base}/gradio_api/upload`, {
        method: "POST", body: fd, signal: AbortSignal.timeout(45_000),
      });
      if (!up.ok) { lastErr = `${base}: upload HTTP ${up.status}`; continue; }
      const paths: string[] = await up.json();
      const path = paths?.[0];
      if (!path) { lastErr = `${base}: upload returned no path`; continue; }

      const call = await fetch(`${base}/gradio_api/call/analyze_single`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          data: [null, null, { path, meta: { _type: "gradio.FileData" } }, "Image"],
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!call.ok) { lastErr = `${base}: call HTTP ${call.status}`; continue; }
      const { event_id } = await call.json();
      if (!event_id) { lastErr = `${base}: no event id`; continue; }

      const stream = await fetch(`${base}/gradio_api/call/analyze_single/${event_id}`, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      const body = await stream.text();

      if (/event:\s*error/.test(body)) {
        lastErr = `${base}: the Space errored while loading TRIBEv2 (shared GPU quota)`;
        continue;
      }
      const complete = body.split("\n").filter((l) => l.startsWith("data: ")).pop();
      if (!complete) { lastErr = `${base}: empty result stream`; continue; }

      const payload = JSON.parse(complete.slice(6));
      const rawScores = payload?.[3];
      const table = payload?.[2];
      const scores: Record<string, number> = {};
      if (table?.data) for (const row of table.data) {
        const k = String(row[0]).toLowerCase().trim();
        const v = Number(row[1]);
        if (k && Number.isFinite(v)) scores[k] = v;
      }
      if (!Object.keys(scores).length && typeof rawScores === "string") {
        try {
          const j = JSON.parse(rawScores);
          for (const [k, v] of Object.entries(j)) if (typeof v === "number") scores[k.toLowerCase()] = v;
        } catch { /* raw was not json; keep it for display */ }
      }
      if (!Object.keys(scores).length) { lastErr = `${base}: no parseable scores`; continue; }

      return { ok: true, space: base, scores, raw: typeof rawScores === "string" ? rawScores : undefined };
    } catch (e) {
      lastErr = `${base}: ${e instanceof Error ? e.message : "unreachable"}`;
    }
  }
  return { ok: false, error: lastErr };
}
