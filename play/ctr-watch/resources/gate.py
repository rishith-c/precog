#!/usr/bin/env python3
"""Turn the comparison into an exit status, and nothing else.

This is a separate step on purpose. A failed step keeps its stderr but not its
stdout, so folding the gate into `compare` would mean the alert run — the one
that matters — is the one that loses the report. Here `compare` always
succeeds and always prints, and this step carries the signal a scheduled run
is read by: 0 when there is nothing to say, 1 when a page dropped.
"""
import json
import sys

raw = sys.argv[1] if len(sys.argv) > 1 else ""
try:
    r = json.loads(raw)
except ValueError as e:
    sys.stderr.write(f"gate could not read the comparison: {e}\n")
    sys.exit(2)

alerts = r.get("alerts") or []
if alerts:
    sys.stderr.write(
        f"{len(alerts)} watched page(s) dropped past the threshold: {', '.join(alerts)}\n")
    sys.exit(1)

print(json.dumps({"ok": True, "alerts": [], "verdict": r.get("verdict", "no change")}))
