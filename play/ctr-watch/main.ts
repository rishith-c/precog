#!/usr/bin/env -S rote play run
/**
 * ctr-watch
 *
 * A landing page is edited by people who are not measuring it. Copy gets
 * softened, a hero image is swapped, a second button is added "temporarily",
 * and the page quietly stops asking for the click. Nobody notices until the
 * month's numbers come in.
 *
 * This watches the pages you name — yours and your competitors' — and forecasts
 * the click-through of each one every time it runs. It stores what it saw, so
 * the next run reports the MOVE rather than the number, and says nothing at all
 * when nothing moved. Schedule it and it becomes the thing that tells you a
 * page got worse on the day it got worse.
 *
 * @rote-frontmatter
 * ---
 * name: ctr-watch
 * description: 'Watches landing pages — yours and your competitors'' — and reports when one gets less persuasive. Renders each page in real Chrome, forecasts its call-to-action click-through from a six-network cortical response, and compares that with what it saw last time. Silent when nothing moved; exits non-zero when a page drops past your threshold, so a scheduled run only speaks when something is wrong. Writes nothing but its own baselines: one small JSON file per watched page, under ~/.rote/ctr-watch unless you point state_dir elsewhere. No credentials, no sudo, nothing deleted.'
 * source: https://github.com/rishith-c/precog
 * tags:
 * - landing-page
 * - ctr
 * - conversion
 * - monitoring
 * - competitors
 * - regression
 * - scheduled
 * - neuroscience
 * discoverability:
 *   tags:
 *   - landing-page
 *   - ctr
 *   - conversion
 *   - monitoring
 *   - competitors
 *   - regression
 *   - scheduled
 *   - neuroscience
 * provenance:
 *   author: Rishith Chennupati <rishithchennupati@gmail.com>
 * metadata:
 *   version: 0.1.1
 *   rote_version: 0.78.0
 *   status: released
 *   kind: atomic
 *   flow_type: parallel
 *   execution_model: steps_with_presentation
 *   format: typescript
 *   contract:
 *     atomic: true
 *     composable: true
 *     input:
 *       type: none
 *       parameters:
 *       - pages
 *       - alert_drop
 *       - state_dir
 *       - host
 *     output:
 *       format: json
 *       destination: stdout_and_files
 *       fields:
 *       - ok
 *       - available
 *       - verdict
 *       - quiet
 *       - watched
 *       - alerts
 *       - pages
 *       - unmeasured
 *       - state_dir
 *       - text
 *     effects:
 *       sends_network_requests: true
 *       reads_filesystem: true
 *       writes_files: true
 *       writes_location: state_dir only (one JSON baseline per watched page)
 *       deletes_files: false
 *       requires_credentials: false
 *       uses_sudo: false
 *   requires_endpoints: []
 *   requires_sessions: false
 * parameters:
 * - name: pages
 *   param_type: string
 *   required: true
 *   description: Pages to watch, comma-separated; scheme optional. At most 6 (the public API admits 6 anonymous runs a minute). Watch your own page and the competitors you want to be compared against.
 * - name: alert_drop
 *   param_type: string
 *   required: false
 *   default: "0.30"
 *   description: Alert when a page's forecast falls at least this many percentage points below its stored baseline. The run exits non-zero when any page crosses it.
 * - name: state_dir
 *   param_type: string
 *   required: false
 *   default: ""
 *   description: Where baselines are kept, one small JSON file per page. Empty means ~/.rote/ctr-watch in your own home directory.
 * - name: host
 *   param_type: string
 *   required: false
 *   default: https://precog-tau.vercel.app
 *   description: Forecast service origin; change only to point at your own instance.
 * presentation_fixtures:
 *   plan: resources/presentation-fixtures/plan/fixture.yaml
 *   measure: resources/presentation-fixtures/measure/fixture.yaml
 *   compare: resources/presentation-fixtures/compare/fixture.yaml
 *   gate: resources/presentation-fixtures/gate/fixture.yaml
 * steps:
 *   plan:
 *     type: process.exec
 *     timeout_ms: 15000
 *     argv:
 *     - python3
 *     - '@resource{plan.py}'
 *     - $pages
 *   measure:
 *     type: process.exec
 *     depends_on:
 *     - plan
 *     for_each: '$.stdout.text | fromjson'
 *     max_concurrency: 2
 *     timeout_ms: 150000
 *     argv:
 *     - curl
 *     - -sS
 *     - --get
 *     - --data-urlencode
 *     - url=$url
 *     - $host/api/analyze
 *   compare:
 *     type: process.exec
 *     depends_on:
 *     - measure
 *     timeout_ms: 30000
 *     argv:
 *     - python3
 *     - '@resource{compare.py}'
 *     - '@measure{.}'
 *     - $state_dir
 *     - $alert_drop
 *   gate:
 *     type: process.exec
 *     depends_on:
 *     - compare
 *     timeout_ms: 15000
 *     argv:
 *     - python3
 *     - '@resource{gate.py}'
 *     - '@compare{$.stdout.text}'
 * ---
 */

const { FlowOutput, isProcessExecBody, loadPresentationContext, stepName } =
  await import("__ROTE_PRESENTATION_SDK__");

const out = new FlowOutput();
const ctx = await loadPresentationContext();

// `pages` is validated by the plan step, which refuses an empty or oversized
// watch set with a message a reader can act on. Re-validating here would turn
// that handled refusal into an uncaught error, so this only records what was
// asked for.
const asked = typeof ctx.params.pages === "string" ? ctx.params.pages : "";

type Page = {
  url: string; ctr: number; grade?: string; status: string;
  since_last: number | null; since_first: number | null; was?: number;
  runs?: number; peak?: Record<string, number>; top_fix?: string;
  biggest_network_move?: { network: string; delta: number };
};
type Report = {
  ok: boolean; available?: boolean; quiet?: boolean; verdict?: string;
  watched?: number; alerts?: string[]; pages?: Page[];
  unmeasured?: { url: string; why: string }[];
  state_dir?: string; text?: string;
};

// Every step is named literally so lint can check these against `steps:`.
const planOutcome = ctx.step(stepName("plan")).outcome;
const compareOutcome = ctx.step(stepName("compare")).outcome;
const gateOutcome = ctx.step(stepName("gate")).outcome;

const planRefused = planOutcome.status === "failed" &&
  planOutcome.output.diagnostic?.exit.kind === "code" &&
  planOutcome.output.diagnostic.exit.code === 2;
const alerted = gateOutcome.status === "failed" &&
  gateOutcome.output.diagnostic?.exit.kind === "code" &&
  gateOutcome.output.diagnostic.exit.code === 1;

// `compare` records the observation and always succeeds; `gate` carries the
// verdict as an exit status. So an alert run fails the DAG while still leaving
// the full report readable, which is the run a reader most needs to see.
const comparisonRan = compareOutcome.status === "completed";

if (!comparisonRan) {
  // Nothing was compared: either the watch set was refused, or the forecast
  // service could not be reached. Neither is a verdict on any page.
  if (planRefused) {
    const detail = planOutcome.status === "failed" ? planOutcome.output.message : "";
    out.human(`The watch set was refused.\n${detail}`);
    out.summary("ctr-watch: no usable watch set");
    out.result({ run_id: ctx.run.run_id, ok: false, verdict: "no watch set", asked, detail });
  } else {
    out.human("ctr-watch could not reach the forecast service.\nThe run stopped before any page was read — a network fault, not a verdict on any page.");
    out.summary("ctr-watch: forecast service unreachable");
    out.result({ run_id: ctx.run.run_id, ok: false, available: false, warning: "measure step failed: network fault" });
  }
} else {

const cmp = ctx.requireAvailable(stepName("compare"));
if (!isProcessExecBody(cmp.body)) throw new Error("compare did not record a process.exec observation");
const stdout = cmp.body.stdout?.text ?? "";
let r: Report;
try { r = JSON.parse(stdout); }
catch { throw new Error(`compare produced no JSON: ${cmp.body.stderr?.text ?? "no stderr captured"}`); }

if (r.available === false) {
  out.human(r.text ?? "No page could be measured this run.");
  out.summary(`ctr-watch: no page could be measured (${r.unmeasured?.length ?? 0} refused)`);
  out.result({ run_id: ctx.run.run_id, ok: true, available: false, verdict: r.verdict, unmeasured: r.unmeasured });
} else {
  const moved = (r.pages ?? []).filter((p) => p.status === "slipped" || p.status === "improved").length;
  const first = (r.pages ?? []).filter((p) => p.status === "first-look").length;
  const alerts = r.alerts ?? [];
  const header = alerted
    ? `ALERT — ${alerts.length} watched page(s) dropped past your ${ctx.params.alert_drop ?? "0.30"} point threshold.\n\n`
    : "";
  const footer = alerted
    ? `\n\nRun precog-preflight on ${alerts[0] ?? "the page"} for the ranked fixes behind this drop.`
    : "";
  out.human(header + (r.text ?? "") + footer);
  out.summary(
    alerted
      ? `ctr-watch: ALERT — ${alerts.join(", ")} dropped past threshold`
      : r.quiet
        ? `ctr-watch: ${r.watched} page(s) watched, nothing moved`
        : first === r.watched
          ? `ctr-watch: baseline stored for ${first} page(s) — the next run reports the move`
          : `ctr-watch: ${moved} page(s) moved, ${first} new, ${r.unmeasured?.length ?? 0} unmeasured`,
  );
  out.result({
    run_id: ctx.run.run_id, ok: true, verdict: alerted ? "alert" : r.verdict,
    quiet: r.quiet === true && !alerted, watched: r.watched, alerts,
    pages: r.pages, unmeasured: r.unmeasured, state_dir: r.state_dir,
  });
}

}
