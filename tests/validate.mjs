#!/usr/bin/env node
/* Precog validation panel.
 *
 * Runs a fixed set of pages through /api/analyze and asserts things the
 * literature lets us assert, without any conversion data of our own:
 *
 *  1. The six networks are six signals. If their timecourses are one shape
 *     scaled six ways, the "six networks" is decoration. Pairwise Pearson r
 *     across the 24 s curves must not all be ~1.
 *  2. A page with no marketing copy (HN) must have the lowest reward.
 *     (NAcc reward anticipation needs a value cue to anticipate.)
 *  3. A product page built on photography (apple.com) must show more
 *     imagery-driven reward than a text-only page, and high visual response.
 *  4. Attention concentration: a sparse page with one hero (linear.app) must
 *     hold more attention than a dense list page (HN).  Biased competition.
 *  5. The interval must bracket the point estimate; captures must be real.
 *
 *   node tests/validate.mjs [--host http://localhost:3142]
 */
const args = process.argv.slice(2);
const host = args[args.indexOf("--host") + 1] && args.includes("--host") ? args[args.indexOf("--host") + 1] : (process.env.PRECOG_HOST ?? "https://precog-tau.vercel.app");
const PANEL = ["linear.app", "stripe.com", "apple.com", "vercel.com", "news.ycombinator.com", "cursor.com"];

const pearson = (a, b) => {
  const n = a.length, ma = a.reduce((p, c) => p + c, 0) / n, mb = b.reduce((p, c) => p + c, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da && db ? num / Math.sqrt(da * db) : 1;
};

const results = {};
for (const p of PANEL) {
  const t0 = Date.now();
  const res = await fetch(`${host}/api/analyze?url=${encodeURIComponent(p)}`);
  const r = await res.json();
  results[p] = r;
  if (r.error) console.log(`  ${p.padEnd(22)} ERROR ${r.error}`);
  else {
    const k = r.networks.peak;
    console.log(`  ${p.padEnd(22)} ${String(r.ctr).padStart(5)}%  ${r.grade.padEnd(9)} vis${String(k.visual).padStart(3)} att${String(k.attention).padStart(3)} lang${String(k.language).padStart(3)} rew${String(k.reward).padStart(3)} sal${String(k.salience).padStart(3)} mem${String(k.memory).padStart(3)}  focus ${r.networks.focus}  inf ${r.capture.informative}  ${Date.now() - t0}ms`);
  }
}

const checks = [];
const ok = (name, cond, detail = "") => checks.push({ name, pass: !!cond, detail });
const R = (p) => results[p];
const NETS = ["visual", "attention", "language", "reward", "salience", "memory"];

// 1. shape independence, per page
for (const p of PANEL) {
  const r = R(p); if (!r || r.error) { ok(`shape ${p}`, false, "no result"); continue; }
  const series = NETS.map((n) => r.networks.frames.map((f) => f[n]));
  const rs = [];
  for (let i = 0; i < NETS.length; i++) for (let j = i + 1; j < NETS.length; j++) rs.push(pearson(series[i], series[j]));
  const sorted = [...rs].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const below70 = rs.filter((x) => x < 0.7).length;
  ok(`shape ${p}: median pairwise r ${median.toFixed(2)} < 0.85, ${below70} pairs < 0.7 (need ≥3)`, median < 0.85 && below70 >= 3);
}
// 2. reward ordering
const rew = (p) => R(p)?.networks?.peak?.reward ?? NaN;
ok(`reward: HN (${rew("news.ycombinator.com")}) lowest of panel`, PANEL.every((p) => p === "news.ycombinator.com" || rew(p) > rew("news.ycombinator.com")));
// 3. apple imagery + visual
ok(`apple.com visual (${R("apple.com")?.networks?.peak?.visual}) > HN visual (${R("news.ycombinator.com")?.networks?.peak?.visual})`, (R("apple.com")?.networks?.peak?.visual ?? 0) > (R("news.ycombinator.com")?.networks?.peak?.visual ?? 1e9));
// Product imagery raises NAcc response relative to text (Knutson et al. 2007): the
// claim the literature supports is relative — apple.com must reward at least as well
// as the median marketing page in the panel, not clear an absolute number.
const rewards = PANEL.map(rew).filter((x) => !Number.isNaN(x)).sort((a, b) => a - b);
const rewMedian = rewards[Math.floor(rewards.length / 2)];
ok(`apple.com reward (${rew("apple.com")}) ≥ panel median (${rewMedian}) — photography and offers register`, rew("apple.com") >= rewMedian);
// 4. attention concentration
const att = (p) => R(p)?.networks?.peak?.attention ?? NaN;
ok(`attention: linear.app (${att("linear.app")}) > HN (${att("news.ycombinator.com")})`, att("linear.app") > att("news.ycombinator.com"));
ok(`focus: linear.app (${R("linear.app")?.networks?.focus}) > HN (${R("news.ycombinator.com")?.networks?.focus})`, (R("linear.app")?.networks?.focus ?? 0) > (R("news.ycombinator.com")?.networks?.focus ?? 1));
// 5. sanity
for (const p of PANEL) {
  const r = R(p); if (!r || r.error) continue;
  ok(`${p}: interval brackets ctr`, r.interval[0] <= r.ctr && r.ctr <= r.interval[1]);
  ok(`${p}: capture informative ≥ 0.34 (${r.capture.informative})`, r.capture.informative >= 0.34);
  ok(`${p}: derivation printed (${r.derivation.length} lines)`, r.derivation.length >= 8);
}
// 6. grade calibration
// Grades: a page with no action target (HN, ctaCount 0) must not forecast base-rate
// clicks; every page that has a target must clear "weak". "Strong" is left to the
// model — asserting a favourite page is strong would be taste, not evidence.
ok(`HN grades weak (${R("news.ycombinator.com")?.grade}) — no action target`, R("news.ycombinator.com")?.grade === "weak");
for (const p of PANEL.filter((x) => x !== "news.ycombinator.com")) ok(`${p} clears weak (${R(p)?.grade})`, !!R(p) && !R(p).error && R(p).grade !== "weak");

// forecast terms per page + panel medians, so priors can be centred on a stated reference set
const T = (r) => ({ notice: r.signals.noticeability, reward: r.networks.peak.reward / 100, memory: r.networks.sustained.memory / 100, language: r.networks.sustained.language / 100, friction: r.networks.peak.salience / 100 });
const rowsT = PANEL.map((p) => R(p)).filter((r) => r && !r.error).map(T);
if (rowsT.length) {
  console.log("\n  forecast terms");
  PANEL.forEach((p) => { const r = R(p); if (r && !r.error) { const t = T(r); console.log(`  ${p.padEnd(22)} ` + Object.entries(t).map(([k, v]) => `${k}=${v.toFixed(3)}`).join("  ")); } });
  const med = (k) => { const v = rowsT.map((r) => r[k]).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
  console.log(`  ${"MEDIAN".padEnd(22)} ` + Object.keys(rowsT[0]).map((k) => `${k}=${med(k).toFixed(3)}`).join("  "));
}

console.log("");
for (const c of checks) console.log(`  ${c.pass ? "PASS" : "FAIL"}  ${c.name}${c.detail ? " — " + c.detail : ""}`);
const failed = checks.filter((c) => !c.pass).length;
console.log(`\n  ${checks.length - failed}/${checks.length} passed`);
process.exit(failed ? 1 : 0);
