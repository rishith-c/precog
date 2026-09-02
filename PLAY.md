# Play: Neural pre-flight a landing page

The repeatable work this Play captures, and the method to teach it.

## The work being repeated

Before shipping or changing a landing page, someone has to answer: *will anyone
click this?* Today that answer comes from taste, an argument, or an A/B test you
cannot run yet because the variant does not exist. So the same investigation gets
redone from scratch every time — capture the page, squint at it, guess.

This Play makes that investigation a method: same inputs, same steps, same shape
of answer, every time.

## Inputs

| input | type | changes per run |
|---|---|---|
| `url` | the page to pre-flight | **yes** — this is the fresh input |
| `host` | Precog origin, default `https://precog-tau.vercel.app` | rarely |

## Declared effects

- **Reads:** one HTTPS GET of the target page; one page capture via the Precog API.
- **Writes:** none. No database, no account, no storage.
- **Credentials:** none required. Nothing is sent anywhere except the page named.

## The method

1. **Capture the rendered page.** Full-page screenshot at 1280px.
2. **Read structure and copy.** Word count, lexical length, headings, action
   targets, form fields, and lexicon hits across value, social proof, urgency,
   friction and jargon.
3. **Measure the pixels.** Twelve horizontal bands, six real statistics each:
   luminance, RMS contrast, gradient energy, chroma, salient-cell count,
   whitespace fraction.
4. **Encode a cortical response.** Six networks at 1 Hz over a simulated scroll,
   convolved with a gamma haemodynamic kernel. Attention divides across competing
   targets rather than summing.
5. **Forecast the click.** Five stated logit priors from the neuroforecasting
   literature. Every coefficient is printed.
6. **Rank what to change.** Each fix's lift is derived by moving one term to a
   realistic target and re-running the same equation.

## Definition of done

The run is done when it produces, for the given URL:

- a predicted CTA click-through **with an interval**, not a bare number;
- the six peak network values;
- at least one ranked fix with a **derived** lift;
- the full derivation, so a reader can disagree with a specific coefficient.

A run that returns a number without the derivation is **not done** — the
inspectability is the product, not a garnish.

## Boundaries to teach the agent

- Never report an estimate as a measurement. If the badge does not say
  `Meta TRIBE v2`, the number came from Precog's own encoder — say so.
- Never present the absolute percentage as a revenue forecast. It is a **ranking
  signal between variants**. State that every time.
- Lifts are **not additive**. Apply the top fix, then re-run.
- If the capture fails, say the capture failed. Do not fall back to reasoning
  about the page from its URL and present that as an analysis.

## One-shot invocation

```bash
npx --yes . preflight https://your-saas.com          # from the repo
node scripts/preflight.mjs your-saas.com --json      # machine-readable
```

Exit code is `1` when the page grades **weak**, so this can gate a deploy the
same way a test suite does. `news.ycombinator.com` is the worked example of the gate
failing: it has no action target, so it forecasts below base rate and the run fails on
purpose. An unreachable page is not a failure of the page — it is reported as a
labelled unknown and the run exits 0.

## Why a stranger can trust it

Every number is printed with the run: the measured stimulus, the six network
values, the five priors, the multiplication, and the resulting logit. There is
no hidden model call and no stored state. Two people running it on the same page
get the same answer, and can both point at the coefficient they disagree with.
