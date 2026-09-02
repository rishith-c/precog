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
 * description: "Neural pre-flight for a landing page: renders it in real Chrome, measures pixels and copy, forecasts CTA click-through with every coefficient printed, and ranks what to change. Exits non-zero on a weak grade so it can gate a deploy."
 * provenance:
 *   author: Rishith Chennupati <rishithchennupati@gmail.com>
 * metadata:
 *   rote_version: 0.78.0
 *   status: draft
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
 *   description: "Landing page to pre-flight; scheme optional (sent as the url query field of GET /api/analyze)"
 * - name: host
 *   param_type: string
 *   required: false
 *   default: "https://precog-tau.vercel.app"
 *   description: "Precog origin; change only to point at a self-hosted instance"
 * steps:
 *   analyze:
 *     type: process.exec
 *     timeout_ms: 150000
 *     argv:
 *       - curl
 *       - -sS
 *       - --get
 *       - --data-urlencode
 *       - url=$url
 *       - $host/api/analyze
 *   report:
 *     type: process.exec
 *     timeout_ms: 20000
 *     depends_on: [analyze]
 *     argv:
 *       - python3
 *       - "@resource{report.py}"
 *       - "@analyze{$.stdout.text}"
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
