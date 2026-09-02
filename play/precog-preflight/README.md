# precog-preflight — the Play

The repeatable work: *will anyone click this page?* Answered the same way every
time — render, measure, encode, forecast, rank the fixes, print the derivation.

Inputs: `url` (changes every run), `host` (rarely).
Effects: none declared. Reads one page; writes nothing; needs no credentials.
Done when: a CTR **with an interval**, six network peaks, at least one ranked fix
with a derived lift, and the full derivation. A number without its derivation is
not done.

## Verify, then publish (needs `rote`, signed in)

    rote play lint play/precog-preflight/main.ts
    rote play run  play/precog-preflight/main.ts url=linear.app
    rote play run  play/precog-preflight/main.ts url=news.ycombinator.com   # workable, exit 0
    rote play run  play/precog-preflight/main.ts url=surely-not-a-real-host-zz.invalid   # labelled unknown, exit 0
    rote play release precog-preflight
    rote registry play push play/precog-preflight/main.ts <your-handle>     # choose Community

Or from a harness: `/play pre-flight a landing page` and steer it to this file.

## What the two steps do, by hand

    curl -sS --get --data-urlencode "url=linear.app" https://precog-tau.vercel.app/api/analyze
