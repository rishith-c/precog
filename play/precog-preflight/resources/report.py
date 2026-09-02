"""Compose the Precog pre-flight report from the analyze step's stdout.

Two-lane failure model (rote process-step contract):
  - expected absence (page could not be measured): exit 0 with {"ok": true, "warning": …}
  - hard fault (no JSON at all, or a weak grade): actionable stderr + nonzero exit
"""
import json
import sys

raw = sys.argv[1] if len(sys.argv) > 1 else sys.stdin.read()
try:
    r = json.loads(raw)
except Exception:
    sys.stderr.write("precog returned no JSON: " + raw[:200] + "\n")
    sys.exit(2)

if "error" in r:
    print(json.dumps({"ok": True, "available": False, "warning": r["error"], "grade": "unmeasurable"}))
    sys.exit(0)

def bar(v):
    n = round(v / 5)
    return "█" * n + "·" * (20 - n)

lines = [
    r["url"],
    f"{r['ctr']}%  predicted CTA click-through   [{r['interval'][0]}% – {r['interval'][1]}%]   {r['grade'].upper()}",
    "",
] + [f"{k:<10} {bar(v)} {v:>3}" for k, v in r["networks"]["peak"].items()] + ["", "what to change"]
for i, f in enumerate(r["fixes"], 1):
    lines.append(f"{i}. {f['title']}   +{f['liftPct']}%")
lines += ["", "derivation"] + ["   " + d for d in r["derivation"]]
lines += ["", f"encoder: {r['encoder']}   {r['ms']} ms"]

print(json.dumps({
    "ok": True, "available": True,
    "url": r["url"], "ctr": r["ctr"], "interval": r["interval"], "grade": r["grade"],
    "signals": r["signals"], "peak": r["networks"]["peak"], "focus": r["networks"].get("focus"),
    "fixes": r["fixes"], "derivation": r["derivation"], "encoder": r["encoder"],
    "text": "\n".join(lines),
}))
if r["grade"] == "weak":
    sys.stderr.write(f"{r['url']} grades WEAK ({r['ctr']}%): fix the top-ranked change before shipping\n")
    sys.exit(1)
