# Precog

**Neural pre-flight for web pages.** Point it at a landing page. It measures the real
pixels and the real copy, encodes a six-network cortical response, and forecasts the
click — with every coefficient printed.

```
your-saas.com  →  6.64%  predicted CTA click-through   [5.77% – 7.63%]
                  seen 35 · intent 77 · friction 30 · scroll 49% · 24h recall 32%
```

## Why

You cannot A/B test a page you have not built, and you cannot get traffic for a
variant you have not shipped. Precog is the step *before* the A/B test: it ranks
variants so you only spend traffic on the two worth testing.

## How it works

**1 · Stimulus — measured, not inferred.** The page is rendered and captured, then
read back off a canvas in the browser. Twelve horizontal bands each yield six real
statistics: mean luminance, RMS contrast, gradient energy, chroma, count of locally
salient cells, and whitespace fraction. Separately the HTML is fetched and parsed
for word count, lexical length, headings, action targets, form fields, and lexicon
hits across value, social proof, urgency, friction and jargon.

**2 · Cortical encoding — TRIBE-shaped, and honest about it.** Meta's
[TRIBE v2](https://ai.meta.com/blog/tribe-v2-brain-predictive-foundation-model/)
predicts whole-brain fMRI response to multimodal stimuli, trained on 1,000+ hours
of recordings from 700+ people; its v1 won Algonauts 2025 against 261 teams. Precog
is built to TRIBE's contract — stimulus in, 1 Hz network timecourse out,
haemodynamically smoothed — across six cortical networks.

Precog **tries the real thing first**: `src/lib/tribe.ts` calls public Gradio Spaces
wrapping `facebook/tribev2`. Those Spaces run on shared ZeroGPU quota and usually
fail under load. When they fail, Precog **says so** and falls back to its own
TRIBE-*shaped* encoder. It never relabels its own output as TRIBE.

The encoder models a reader who scrolls rather than teleports, whose attention is a
depleting resource, and for whom salient regions **compete** rather than sum — a
page bright everywhere is bright nowhere. Response is convolved with a gamma
haemodynamic kernel peaking near six seconds.

**3 · Neuroforecast — brain-as-predictor.** Neural response from a small sample
forecasts *aggregate* behaviour better than that sample's self-report. NAcc response
predicts population-level purchase and funding outcomes; mPFC predicts campaign
response at population scale. Attention is a gate — an unfixated target cannot be
clicked. Anterior insula tracks hesitation, which subtracts clicks reward had
already earned. Five stated priors on the logit scale, all printed per run:

| term | prior | grounding |
|---|---|---|
| `base` | 0.042 | mid of reported B2B SaaS hero-CTA CTR |
| `notice` | +1.35 | attention gate, dominant term |
| `reward` | +1.10 | NAcc → aggregate choice |
| `memory` | +0.35 | encoding strength → delayed click |
| `language` | −0.55 | reading cost suppresses action |
| `friction` | −1.20 | insula-tracked hesitation |

Fix lifts are **derived**, not asserted: each moves one term to a realistic target
and re-runs the same equation.

## What this is not

- **Not a measurement.** No one's brain was scanned. Nothing here is an fMRI result.
- **Not calibrated on your funnel.** Priors are literature-scale. Treat the absolute
  percentage as a **ranking signal between variants**, not a revenue forecast.
- **Not an A/B test.** It is what you run to decide which two variants deserve one.
- **Not TRIBE output** unless the badge says `Meta TRIBE v2`.

## Validation

`npm run validate` runs a six-page reference panel through `/api/analyze` and asserts
what the literature lets us assert without conversion data of our own — and one
thing it does not: that the six network curves are six signals. If their 24 s
timecourses are one shape scaled six ways, the "six networks" is decoration.
Pairwise Pearson r across networks must not all sit near 1.

| page | CTR | vis | att | lang | rew | sal | mem | focus |
|---|---|---|---|---|---|---|---|---|
| `apple.com` | 4.66% | 58 | 28 | 48 | 44 | 36 | 78 | 0.40 |
| `vercel.com` | 4.58% | 35 | 29 | 18 | 31 | 32 | 47 | 0.59 |
| `linear.app` | 4.17% | 50 | 26 | 41 | 47 | 32 | 46 | 0.37 |
| `stripe.com` | 4.01% | 52 | 22 | 30 | 48 | 33 | 47 | 0.23 |
| `cursor.com` | 3.29% | 31 | 18 | 33 | 37 | 33 | 37 | 0.19 |
| `news.ycombinator.com` | 2.36% · weak | 33 | 25 | 24 | 6 | 31 | 26 | 0.34 |

35/35 assertions pass (2026-09-02). Median pairwise r between network curves is
0.68–0.84 per page. HN has no marketing copy (reward 6) and **no action target at
all** — a page with nothing to click must not forecast base-rate clicks, so it
grades weak. Apple's photography and offers register (reward 44, above the panel
median) where the previous lexicon-only reward gave it 30.

### Six mechanisms, not one envelope

An earlier build drew all six networks from one temporal envelope and scaled it —
the sparklines were visibly the same curve. Each network now has its own mechanism:
**visual** adapts to repetition; **attention** is saliency concentration under
divisive competition with a top-and-left reading prior, depleting with scroll;
**language** is a leaky integrator of text in view; **reward** is an integrator
gated by attention, because a reader cannot value what they never fixated;
**salience** (insula) is phasic, firing on change toward friction; **memory** is a
slow leaky integrator of novelty × reward. Then the haemodynamic kernel.

### Is TRIBE enough?

No. TRIBE predicts fMRI, not behaviour, and the published neural-to-outcome effect
sizes are modest. It was trained on passive film viewing at 1 Hz; a page is scanned
by someone with a goal at saccade speed. So the attention network here is not
fMRI-shaped: it is a bottom-up saliency map in the Itti–Koch–Niebur form
(centre–surround on intensity, colour opponency, orientation), a page-level focus
measured over the first viewport with the navigation strip excluded (fold studies;
banner blindness), and a noticeability gate on whether an action target exists. That
is the part of the model with the best-replicated grounding, and it is the part that
decides whether the action is seen at all.

### Calibration

The five logit priors are centred on the medians of the reference panel above, and
the centres are printed in every derivation. A page at the panel median on every
term forecasts the base rate; the panel is the scale. Nothing is fitted to private
data.

### The capture has to be real

An earlier build rendered pages through a lightweight screenshot service that
returned nav-only frames on JS-heavy sites — `linear.app` came back 99.6% black —
and reported a confident number anyway. Captures now go through real headless
Chrome, and `captureQuality()` refuses to forecast when under a third of bands carry
visual structure.

## Run it

```bash
npm install
npm run dev     # http://localhost:3141
```

No API keys. No database. Nothing is stored and nothing is sent anywhere except a
request to the page you name.

## Sources

- d'Ascoli et al. — [TRIBE: TRImodal Brain Encoder](https://arxiv.org/abs/2507.22229), arXiv:2507.22229
- Meta AI — [Introducing TRIBE v2](https://ai.meta.com/blog/tribe-v2-brain-predictive-foundation-model/); weights `facebook/tribev2`, CC-BY-NC 4.0
- Berns & Moore — neural focus group predicts population-level media effects
- Genevsky & Knutson — [neuroforecasting aggregate choice](https://www.jneurosci.org/content/37/36/8625), J Neurosci
- Falk et al. — brain-as-predictor for population campaign response
- Algonauts 2025 — [insights from the winners](https://arxiv.org/abs/2508.10784)

TRIBE v2 is © Meta Platforms, CC-BY-NC 4.0. Precog does not redistribute weights.

## Production setup

Precog runs with zero environment variables locally (filesystem store under
`.data/`). On Vercel it refuses to fall back to the filesystem — that would lose
every account at the next cold start — so accounts are off until a store exists:

```bash
# a PRIVATE Blob store — the CLI's `blob store add` creates a public one, which the
# driver refuses because user records hold password and key hashes
curl -X POST "https://api.vercel.com/v1/storage/stores/blob?teamId=$TEAM" -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"precog-private","region":"iad1","access":"private"}'
# …then connect it to the project (Dashboard → Storage → Connect), and
openssl rand -hex 32 | vercel env add PRECOG_SECRET production   # one session key for every instance
vercel --prod
```

`GET /api/health` reports which of store, mail and payments are configured.
Everything else is optional and documented in [`.env.example`](.env.example):
Resend for welcome mail, Stripe for billing (the pricing page states plainly that
no processor is connected until it is).

What ships regardless: security headers, per-client and per-key rate limits, an
append-only audit log under Settings → Activity, account deletion that removes
everything, `/privacy` and `/terms` written against the code, robots, sitemap,
OG image, health.

## The Play

[`play/precog-preflight/`](play/precog-preflight/) is the same job as a Rote
Play: two `process.exec` steps, no credentials, no declared writes. Its README
has the lint / run / publish commands.
