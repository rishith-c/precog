#!/usr/bin/env node
/* Precog CLI — neural pre-flight for a landing page.
 *   PRECOG_KEY=pk_… node scripts/preflight.mjs <url> [--json] [--host …]
 * Exit code is 0 for a strong/workable page and 1 for a weak one, so this can
 * gate a deploy the same way a test suite does. The run lands in your account
 * and counts against the same quota as one made in the browser. */

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const target = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--host");
const host = flag("--host", process.env.PRECOG_HOST ?? "https://precog-tau.vercel.app");
const asJson = args.includes("--json");

const key = flag("--key", process.env.PRECOG_KEY);

if (!target) {
  console.error("usage: preflight <url> [--json] [--host <origin>] [--key pk_…]");
  process.exit(2);
}
if (!key) {
  console.error("precog: set PRECOG_KEY, or pass --key. Make one under Settings in the app.");
  process.exit(2);
}

const res = await fetch(`${host}/api/v1/analyze?url=${encodeURIComponent(target)}`, {
  headers: { authorization: `Bearer ${key}` },
});
const r = await res.json();
if (!res.ok) { console.error(`precog: ${r.error ?? res.status}`); process.exit(2); }

if (asJson) { console.log(JSON.stringify(r, null, 2)); process.exit(r.grade === "weak" ? 1 : 0); }

const bar = (v) => "█".repeat(Math.round(v / 5)).padEnd(20, "·");
console.log(`\n  ${r.url}`);
console.log(`  ${r.ctr}%  predicted CTA click-through   [${r.interval[0]}% – ${r.interval[1]}%]   ${r.grade.toUpperCase()}\n`);
console.log(`  seen ${Math.round(r.signals.noticeability * 100)}   intent ${Math.round(r.signals.intent * 100)}   friction ${Math.round(r.signals.friction * 100)}   scroll ${r.signals.scrollDepth}%   24h recall ${Math.round(r.signals.recall * 100)}%\n`);
for (const [k, v] of Object.entries(r.networks.peak)) console.log(`  ${k.padEnd(10)} ${bar(v)} ${String(v).padStart(3)}`);
console.log(`\n  what to change`);
r.fixes.forEach((f, i) => {
  console.log(`\n  ${i + 1}. ${f.title}   +${f.liftPct}%`);
  console.log(`     ${f.detail.replace(/(.{74}\s)/g, "$1\n     ")}`);
});
console.log(`\n  derivation`);
r.derivation.forEach((d) => console.log(`     ${d}`));
console.log(`\n  encoder: ${r.encoder}   ${r.ms} ms   quota ${r.quota.used}/${r.quota.limit}\n`);
process.exit(r.grade === "weak" ? 1 : 0);
