/**
 * ---
 * name: precog-preflight
 * version: 0.1.0
 * description: >-
 *   Neural pre-flight for a landing page. Renders the page in real Chrome,
 *   measures its pixels and copy, encodes a six-network cortical response and
 *   forecasts CTA click-through — then ranks what to change, with every
 *   coefficient printed. No account, no credentials; one page in, one report
 *   out. Exit is non-zero when the page grades weak, so it can gate a deploy.
 * author: rishith-c
 * parameters:
 *   url:
 *     type: string
 *     required: true
 *     description: The landing page to pre-flight. Scheme optional.
 *     example: linear.app
 *   host:
 *     type: string
 *     required: false
 *     default: https://precog-tau.vercel.app
 *     description: Precog origin. Only change it to point at a self-hosted instance.
 * effects:
 *   declaredWrites: []
 * requirements:
 *   localTools: [curl, python3]
 * steps:
 *   analyze:
 *     type: process.exec
 *     timeout_ms: 150000
 *     argv:
 *       - curl
 *       - -sS
 *       - --fail-with-body
 *       - --get
 *       - --data-urlencode
 *       - "url=$url"
 *       - "$host/api/analyze"
 *   report:
 *     type: process.exec
 *     timeout_ms: 20000
 *     depends_on: [analyze]
 *     argv:
 *       - python3
 *       - -c
 *       - |
 *         import json, sys
 *         raw = sys.argv[1]
 *         try:
 *             r = json.loads(raw)
 *         except Exception:
 *             print(json.dumps({"ok": False, "error": "precog returned no JSON", "raw": raw[:300]})); sys.exit(1)
 *         if "error" in r:
 *             # Expected absence — a page that cannot be captured is a labelled
 *             # unknown, not a crash; the run stays inspectable.
 *             print(json.dumps({"ok": True, "warning": r["error"], "grade": "unmeasurable"})); sys.exit(0)
 *         bar = lambda v: "█" * round(v / 5) + "·" * (20 - round(v / 5))
 *         lines = [
 *             f"{r['url']}",
 *             f"{r['ctr']}%  predicted CTA click-through   [{r['interval'][0]}% – {r['interval'][1]}%]   {r['grade'].upper()}",
 *             "",
 *         ] + [f"{k:<10} {bar(v)} {v:>3}" for k, v in r["networks"]["peak"].items()] + ["", "what to change"]
 *         for i, f in enumerate(r["fixes"], 1):
 *             lines.append(f"{i}. {f['title']}   +{f['liftPct']}%")
 *         lines += ["", "derivation"] + ["   " + d for d in r["derivation"]]
 *         lines += ["", f"encoder: {r['encoder']}   {r['ms']} ms"]
 *         print(json.dumps({
 *             "ok": True, "url": r["url"], "ctr": r["ctr"], "interval": r["interval"],
 *             "grade": r["grade"], "signals": r["signals"], "peak": r["networks"]["peak"],
 *             "fixes": r["fixes"], "derivation": r["derivation"], "encoder": r["encoder"],
 *             "text": "\n".join(lines),
 *         }))
 *         # Hard fault only on a weak grade: the page ran, the verdict is the failure.
 *         sys.exit(1 if r["grade"] == "weak" else 0)
 *       - "@analyze{$.stdout.text}"
 * ---
 */

/* Presentation. Three views, one canonical result: `result` is the JSON the
   report step printed, `human` is its `text` field, `summary` is one line.
   No fact is dropped from a view that claims to be complete. */

type Report = {
  ok: boolean; warning?: string; error?: string;
  url?: string; ctr?: number; interval?: [number, number]; grade?: string;
  signals?: Record<string, number>; peak?: Record<string, number>;
  fixes?: { title: string; detail: string; liftPct: number; network: string }[];
  derivation?: string[]; encoder?: string; text?: string;
};

export function result(steps: { report: { stdout: { text: string } } }): Report {
  try { return JSON.parse(steps.report.stdout.text); }
  catch { return { ok: false, error: "report step produced no JSON" }; }
}

export function summary(steps: Parameters<typeof result>[0]): string {
  const r = result(steps);
  if (!r.ok) return `precog: ${r.error}`;
  if (r.warning) return `precog: ${r.url ?? "page"} could not be measured — ${r.warning}`;
  return `${r.url} → ${r.ctr}% (${r.grade}); top fix: ${r.fixes?.[0]?.title ?? "none"}`;
}

export function human(steps: Parameters<typeof result>[0]): string {
  const r = result(steps);
  if (!r.ok) return `precog failed: ${r.error}`;
  if (r.warning) return `Could not measure the page.\n${r.warning}\n\nA frame with no structure in it is refused, not analysed.`;
  return r.text ?? summary(steps);
}
