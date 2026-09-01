# Precog

**Neural pre-flight for web pages.** Point it at a landing page. It measures the real
pixels and the real copy, encodes a predicted cortical response, and forecasts the
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

Discrimination check across two structurally opposite pages:

| page | CTR | reward | visual | language | reading |
|---|---|---|---|---|---|
| `linear.app` | 6.64% | 77 | 26 | 31 | marketing copy, strong value cues |
| `news.ycombinator.com` | 3.11% | 10 | 47 | 48 | zero value cues, text-dense |

The model separates them for the right reasons: HN has no marketing copy (reward 10)
and is text-dense (visual 47, language 48).

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
