/**
 * Precog pre-flight
 *
 * Will anyone click this page? Renders the landing page in real Chrome,
 * measures its pixels and copy, encodes a six-network cortical response and
 * forecasts CTA click-through — then ranks what to change, with every
 * coefficient printed. No account, no credentials; one page in, one report out.
 *
 * @rote-frontmatter
 * ---
 * name: precog-preflight
 * description: 'Neural pre-flight for a landing page: renders it in real Chrome, measures pixels and copy, forecasts CTA click-through with every coefficient printed, and ranks what to change. Exits non-zero on a weak grade so it can gate a deploy.'
 * provenance:
 *   author: Rishith Chennupati <rishithchennupati@gmail.com>
 * metadata:
 *   version: 0.1.0
 *   rote_version: 0.78.0
 *   status: released
 *   kind: atomic
 *   flow_type: sequential
 *   execution_model: steps_with_presentation
 *   format: typescript
 *   requires_endpoints: []
 *   requires_sessions: false
 *   discoverability:
 *     tags:
 *     - precog
 *     - landing-page
 *     - ctr
 *     - neuroscience
 *     - pre-flight
 * parameters:
 * - name: url
 *   param_type: string
 *   required: true
 *   description: Landing page to pre-flight; scheme optional (sent as the url query field of GET /api/analyze)
 * - name: host
 *   param_type: string
 *   required: false
 *   default: https://precog-tau.vercel.app
 *   description: Precog origin; change only to point at a self-hosted instance
 * presentation_fixtures:
 *   analyze: resources/presentation-fixtures/analyze/fixture.yaml
 *   report: resources/presentation-fixtures/report/fixture.yaml
 * steps:
 *   analyze:
 *     type: process.exec
 *     timeout_ms: 150000
 *     argv:
 *     - curl
 *     - -sS
 *     - --get
 *     - --data-urlencode
 *     - url=$url
 *     - $host/api/analyze
 *   report:
 *     type: process.exec
 *     timeout_ms: 20000
 *     depends_on:
 *     - analyze
 *     argv:
 *     - python3
 *     - '@resource{report.py}'
 *     - '@analyze{$.stdout.text}'
 * ---
 */

// Presentation plane: deprivileged; imports ONLY the presentation SDK; owns no effects.
const { FlowOutput, isProcessExecBody, loadPresentationContext, stepName } =
  await import("__ROTE_PRESENTATION_SDK__");

const out = new FlowOutput();
const ctx = await loadPresentationContext();

const url = ctx.params.url;
if (typeof url !== "string" || url.length === 0) throw new Error("url parameter is required");

type Report = {
  ok: boolean; available?: boolean; warning?: string;
  url?: string; ctr?: number; interval?: [number, number]; grade?: string;
  signals?: Record<string, number>; peak?: Record<string, number>; focus?: number;
  fixes?: { title: string; detail: string; liftPct: number; network: string }[];
  derivation?: string[]; encoder?: string; text?: string;
};

// Presentation also runs after an effect failure so it can render evidence.
// A true network fault (DNS, timeout) fails `analyze`, blocks `report`, and
// lands here: say what happened instead of throwing a stack at the reader.
if (ctx.run.status === "failed") {
  // Two ways to fail, and they mean opposite things: the report step exiting 1
  // is the gate saying the page grades weak (a verdict); the analyze step
  // failing is a network fault (no verdict at all).
  const rep = ctx.step(stepName("report")).outcome;
  const gate = rep.status === "failed" && rep.output.diagnostic?.exit.kind === "code" && rep.output.diagnostic.exit.code === 1;
  if (gate) {
    const detail = rep.status === "failed" ? rep.output.message : "";
    out.human(`Gate failed for ${url}.\n${detail}\n\nThe page was measured and forecast; it grades weak. Apply the top-ranked change and run again.`);
    out.summary(`precog: ${url} grades weak — gate failed`);
    out.result({ run_id: ctx.run.run_id, url, available: true, gate_passed: false, grade: "weak", detail });
  } else {
    out.human(`Precog could not reach ${url}.\nThe analyze step failed before any measurement was made — a network fault, not a verdict on the page.`);
    out.summary(`precog: ${url} unreachable — analyze step failed`);
    out.result({ run_id: ctx.run.run_id, url, available: false, warning: "analyze step failed: network fault" });
  }
} else {

// The report step owns the verdict: a weak page is a nonzero exit by design.
const rep = ctx.requireAvailable(stepName("report"));
if (!isProcessExecBody(rep.body)) throw new Error("report did not record a process.exec observation");
const stdout = rep.body.stdout?.text ?? "";
let r: Report;
try { r = JSON.parse(stdout); }
catch { throw new Error(`report produced no JSON: ${rep.body.stderr?.text ?? "no stderr captured"}`); }

const exit = rep.body.status.exit;
const weak = exit.kind === "code" && exit.code === 1 && r.grade === "weak";

if (r.available === false) {
  out.human(`Could not measure ${url}.\n${r.warning}\n\nA frame with no visual structure is refused, not analysed.`);
  out.summary(`precog: ${url} could not be measured — ${r.warning}`);
  out.result({ run_id: ctx.run.run_id, url, available: false, warning: r.warning });
} else {
  out.human(r.text ?? "");
  out.summary(`${r.url} → ${r.ctr}% (${r.grade}${weak ? " — gate failed" : ""}); top fix: ${r.fixes?.[0]?.title ?? "none"}`);
  out.result({
    run_id: ctx.run.run_id, url: r.url, ctr: r.ctr, interval: r.interval, grade: r.grade,
    gate_passed: !weak, signals: r.signals, peak: r.peak, focus: r.focus,
    fixes: r.fixes, derivation: r.derivation, encoder: r.encoder,
  });
}

}
