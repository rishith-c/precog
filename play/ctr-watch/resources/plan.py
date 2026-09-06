#!/usr/bin/env python3
"""Turn the `pages` parameter into the fan-out set.

One line of responsibility: normalise what a human typed into a list of
absolute URLs, and refuse the run if there is nothing to watch. The width of
the fan-out below is decided here, at run time, from this output.
"""
import json
import re
import sys

MAX_PAGES = 6  # the public API allows 6 anonymous runs a minute; one watch = one run

raw = sys.argv[1] if len(sys.argv) > 1 else ""
seen, pages = set(), []
for token in re.split(r"[,\s]+", raw.strip()):
    if not token:
        continue
    url = token if re.match(r"^https?://", token, re.I) else "https://" + token
    key = url.rstrip("/").lower()
    if key in seen:
        continue
    seen.add(key)
    pages.append({"url": url})

if not pages:
    sys.stderr.write(
        "no pages to watch: pass pages=your-site.com or a comma-separated list\n")
    sys.exit(2)
if len(pages) > MAX_PAGES:
    sys.stderr.write(
        f"{len(pages)} pages given; the public API admits {MAX_PAGES} runs a minute. "
        f"Watch at most {MAX_PAGES}, or point host= at your own instance.\n")
    sys.exit(2)

json.dump(pages, sys.stdout)
