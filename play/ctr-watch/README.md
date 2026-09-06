# ctr-watch

Watches landing pages — yours and your competitors' — and tells you when one of
them gets less persuasive.

A landing page is edited by people who are not measuring it. Copy gets softened,
a hero image is swapped, a second button is added "temporarily", and the page
quietly stops asking for the click. Nobody notices until the month's numbers
come in.

Every run renders each page in real Chrome, forecasts its call-to-action
click-through from a six-network cortical response, and compares that with what
it saw last time. It stores one small JSON baseline per page, so the second run
reports the **move** rather than the number.

    rote play run rishith-c/ctr-watch pages=your-saas.com,competitor.com

## What it prints

Nothing, when nothing moved:

    2 pages watched, nothing moved (within 0.05 points)
      https://linear.app/   4.17%   unchanged
      https://stripe.com/   4.43%   unchanged

And when a page drops past your threshold, it says which network moved and what
to change first — then exits non-zero, so a scheduled run only speaks up when
something is wrong:

    ALERT — 1 watched page(s) dropped past your 0.30 point threshold.

    https://linear.app/
      4.17%   was 5.20%   -1.03 since last run   ALERT
        reward response fell 14 points
        first thing to change: Give the primary action a contrast island
        -0.43 since first seen (7 runs)

## Inputs

| Parameter | Required | Default | Meaning |
|---|---|---|---|
| `pages` | yes | — | Comma-separated pages to watch; scheme optional. At most 6. |
| `alert_drop` | no | `0.30` | Percentage points of forecast CTR that count as a real fall. |
| `state_dir` | no | *(empty)* | Where baselines live. Empty means `~/.rote/ctr-watch`. |
| `host` | no | `https://precog-tau.vercel.app` | Forecast service; point it at your own instance. |

## Exit status

| Code | Meaning |
|---|---|
| 0 | Nothing to say: first look, unchanged, improved, or a slip under the threshold. |
| 1 | A page dropped past `alert_drop`, or the watch set was refused, or the service was unreachable. |

A page the renderer cannot measure is reported as unmeasured and does **not**
fail the run: "the hero is a video and there are no bands to read" is an answer,
not a broken watch.

## Effects

Reads: the pages you name, over HTTPS, through the forecast service.
Writes: one small JSON baseline per watched page, inside `state_dir` and
nowhere else. No credentials, no sudo, nothing deleted.

## Make it come back

The point of a watch is that it returns. Schedule it and it becomes the thing
that tells you a page got worse on the day it got worse:

    play recurring schedule --reference rishith-c/ctr-watch@0.1.1 \
      --cadence daily --why "Catch a landing page regression the day it lands"

## Why the forecast is a forecast

`ctr-watch` reports a *predicted* click-through, not measured clicks. The
prediction, its five stated priors, and the evidence behind each one are
documented in the [precog method](https://precog-tau.vercel.app/method); the
per-page ranked fixes come from
[`rishith-c/precog-preflight`](https://play.modiqo.ai/rishith-c/precog-preflight).
Treat the absolute number as a scale and the **movement** as the signal — the
movement is what this Play exists to catch.
