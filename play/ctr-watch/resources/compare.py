#!/usr/bin/env python3
"""Compare today's forecast for each watched page with what was stored last time.

Contract, deliberately narrow:
  argv[1]  the `measure` step's body — one process.exec observation, or a list
           of them when the fan-out had more than one page.
  argv[2]  where baselines live ("" means ~/.rote/ctr-watch).
  argv[3]  alert threshold in percentage points of forecast CTR.

This step observes and never judges: it exits 0 whenever it could read the
measurements, and names any alert in `alerts` for the gate step to act on. It
exits 2 only when the argument could not be read as a measurement at all.

A page the service could not measure is NOT a failure of this run: it is
reported as unmeasured and the run still exits 0, because "the hero is a video
and there are no bands to read" is an expected answer, not a broken watch.
"""
import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone

QUIET_BAND = 0.05  # percentage points; below this a move is noise, not news
NETWORKS = ["visual", "attention", "language", "reward", "salience", "memory"]


def die(msg, code=2):
    sys.stderr.write(msg.rstrip() + "\n")
    sys.exit(code)


def observations(payload):
    """A fan-out of one arrives as a bare object; of many, as a list."""
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("fan_out", "items", "results"):
            if isinstance(payload.get(key), list):
                return payload[key]
        return [payload]
    die("measure step produced neither an object nor a list")


def requested_url(body):
    """Recover which page an observation belongs to, even when it failed.

    The forecast response carries its own final URL, but an error response does
    not, so the request's own argv is the only thing that always knows.
    """
    args = (body.get("invocation") or {}).get("args") or []
    for a in args:
        if isinstance(a, str) and a.startswith("url="):
            return a[4:]
    return None


def slug(url):
    bare = re.sub(r"^https?://", "", url.strip().rstrip("/"), flags=re.I).lower()
    stem = re.sub(r"[^a-z0-9]+", "-", bare).strip("-")[:48] or "page"
    return f"{stem}-{hashlib.sha1(bare.encode()).hexdigest()[:6]}.json"


def read_state(path):
    try:
        with open(path) as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def arrow(d):
    return "no change" if abs(d) < QUIET_BAND else (f"+{d:.2f}" if d > 0 else f"{d:.2f}")


payload_raw = sys.argv[1] if len(sys.argv) > 1 else ""
state_dir = (sys.argv[2] if len(sys.argv) > 2 else "").strip()
try:
    threshold = abs(float(sys.argv[3])) if len(sys.argv) > 3 and sys.argv[3] else 0.30
except ValueError:
    die(f"alert_drop must be a number of percentage points, got {sys.argv[3]!r}")

if not state_dir:
    state_dir = os.path.join(os.path.expanduser("~"), ".rote", "ctr-watch")
state_dir = os.path.abspath(os.path.expanduser(state_dir))

try:
    payload = json.loads(payload_raw)
except ValueError as e:
    die(f"could not read the measure step's output as JSON: {e}")

try:
    os.makedirs(state_dir, exist_ok=True)
except OSError as e:
    die(f"cannot write baselines to {state_dir}: {e}")

now = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
pages, unmeasured, alerts = [], [], []

for body in observations(payload):
    if not isinstance(body, dict):
        continue
    asked = requested_url(body)
    stdout = ((body.get("stdout") or {}).get("text") or "").strip()
    try:
        r = json.loads(stdout) if stdout else {}
    except ValueError:
        unmeasured.append({"url": asked or "unknown",
                           "why": "the service did not return JSON"})
        continue

    if not r or r.get("error") or r.get("ctr") is None:
        unmeasured.append({"url": r.get("url") or asked or "unknown",
                           "why": r.get("error") or "no forecast in the response"})
        continue

    url = r.get("url") or asked
    ctr = float(r["ctr"])
    peak = {k: r.get("networks", {}).get("peak", {}).get(k) for k in NETWORKS}
    path = os.path.join(state_dir, slug(asked or url))
    prev = read_state(path)

    entry = {
        "url": url, "ctr": ctr, "grade": r.get("grade"),
        "peak": peak, "seen_at": now,
        "top_fix": (r.get("fixes") or [{}])[0].get("title"),
    }

    if not prev or "last" not in prev:
        entry.update({"status": "first-look", "since_last": None, "since_first": None,
                      "runs": 1, "first_seen": now})
        state = {"url": url, "first": {"ctr": ctr, "peak": peak, "seen_at": now},
                 "last": {"ctr": ctr, "peak": peak, "seen_at": now}, "runs": 1}
    else:
        last, first = prev["last"], prev.get("first", prev["last"])
        d_last = round(ctr - float(last["ctr"]), 2)
        d_first = round(ctr - float(first["ctr"]), 2)
        moved = {k: round((peak[k] or 0) - (last.get("peak", {}).get(k) or 0))
                 for k in NETWORKS}
        worst = min(moved.items(), key=lambda kv: kv[1])
        if d_last <= -threshold or d_first <= -threshold:
            status = "alert"
        elif d_last < -QUIET_BAND:
            status = "slipped"
        elif d_last > QUIET_BAND:
            status = "improved"
        else:
            status = "unchanged"
        entry.update({
            "status": status, "since_last": d_last, "since_first": d_first,
            "was": float(last["ctr"]), "last_seen": last.get("seen_at"),
            "runs": int(prev.get("runs", 1)) + 1,
            "first_seen": first.get("seen_at"),
            "networks_moved": moved,
            "biggest_network_move": {"network": worst[0], "delta": worst[1]},
        })
        if status == "alert":
            alerts.append(entry)
        state = {"url": url, "first": first,
                 "last": {"ctr": ctr, "peak": peak, "seen_at": now},
                 "runs": entry["runs"]}

    try:
        with open(path, "w") as f:
            json.dump(state, f, indent=1)
    except OSError as e:
        die(f"cannot write baseline {path}: {e}")
    pages.append(entry)

if not pages and not unmeasured:
    die("the measure step returned no observations at all")

# Every page refused measurement. The watch worked; there was nothing to read.
if not pages:
    lines = ["no page could be measured this run", ""]
    lines += [f"  {u['url']}  —  {u['why']}" for u in unmeasured]
    print(json.dumps({
        "ok": True, "available": False, "quiet": True, "verdict": "unmeasurable",
        "watched": 0, "alerts": [], "pages": [], "unmeasured": unmeasured,
        "state_dir": state_dir, "text": "\n".join(lines),
    }))
    sys.exit(0)

changed = [p for p in pages if p["status"] in ("alert", "slipped", "improved")]
firsts = [p for p in pages if p["status"] == "first-look"]
quiet = not changed and not firsts and not unmeasured

if alerts:
    verdict = "alert"
elif changed:
    verdict = "moved"
elif firsts:
    verdict = "baseline stored"
else:
    verdict = "no change"

# The report. Quiet runs say one line; that is the point of a watch.
if quiet:
    lines = [f"{len(pages)} page{'s' if len(pages) != 1 else ''} watched, nothing moved "
             f"(within {QUIET_BAND:.2f} points)"]
    for p in pages:
        lines.append(f"  {p['url']}   {p['ctr']:.2f}%   unchanged")
else:
    lines = []
    for p in sorted(pages, key=lambda p: (p["since_last"] is None, p["since_last"] or 0)):
        if p["status"] == "first-look":
            lines.append(f"{p['url']}\n  {p['ctr']:.2f}%   first look — baseline stored")
            continue
        head = {"alert": "ALERT", "slipped": "slipped", "improved": "improved",
                "unchanged": "unchanged"}[p["status"]]
        lines.append(
            f"{p['url']}\n  {p['ctr']:.2f}%   was {p['was']:.2f}%   "
            f"{arrow(p['since_last'])} since last run   {head}")
        if p["status"] in ("alert", "slipped"):
            b = p["biggest_network_move"]
            if b["delta"] < 0:
                lines.append(f"    {b['network']} response fell {abs(b['delta'])} points")
            if p.get("top_fix"):
                lines.append(f"    first thing to change: {p['top_fix']}")
        if p["since_first"] is not None and abs(p["since_first"]) >= QUIET_BAND:
            lines.append(f"    {arrow(p['since_first'])} since first seen "
                         f"({p['runs']} runs)")
        lines.append("")

for u in unmeasured:
    lines.append(f"{u['url']}\n  not measured — {u['why']}")

print(json.dumps({
    "ok": True, "available": True, "quiet": quiet, "verdict": verdict,
    "watched": len(pages), "alerts": [a["url"] for a in alerts],
    "pages": pages, "unmeasured": unmeasured, "state_dir": state_dir,
    "text": "\n".join(lines).rstrip(),
}))
