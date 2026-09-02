# What the validation panel asserts, and why it is allowed to

`npm run validate` runs six pages through `/api/analyze` and checks the claims below.
Each check names the finding it rests on. Where the literature only supports a
*relative* claim, the test is relative; nothing here asserts a number the
literature does not.

| # | assertion (tests/validate.mjs) | grounding |
|---|---|---|
| 1 | The six network timecourses are six signals: median pairwise Pearson r < 0.85 per page, ≥3 pairs < 0.7 | Internal consistency. If hue or scale alone separates the curves, "six networks" is decoration. This is the test that failed on the build the user screenshotted. |
| 2 | A page with no marketing copy has the lowest reward in the panel (HN, reward 6) | Reward anticipation in NAcc needs a value cue to anticipate — Knutson, Adams, Fong & Hommer (2001), *anticipation of increasing monetary reward selectively recruits NAcc*; Berns & Moore (2012) neural focus group. |
| 3 | apple.com visual > HN visual | Photographic, high-chroma, low-edge stimuli drive stronger early visual response than dense text — V1–V4 contrast/colour sensitivity (Itti, Koch & Niebur 1998 feature channels). |
| 4 | apple.com reward ≥ panel median reward | Product imagery raises NAcc response relative to text — Knutson, Rick, Wimmer, Prelec & Loewenstein (2007), *neural predictors of purchases* (product picture → NAcc). Stated as relative, not an absolute score. |
| 5 | Attention concentration: linear.app > HN; first-viewport focus linear > HN | Biased competition (Desimone & Duncan 1995): salient regions compete, they do not sum. Fold effect: ~57% of viewing time above the fold (Nielsen Norman Group 2010/2018 scroll studies); banner blindness excludes the nav strip (Benway 1998; Nielsen 2007). |
| 6 | Interval brackets the point estimate; capture informative ≥ 0.34; derivation ≥ 8 lines | Instrument hygiene: a forecast without its interval and derivation is not a result; a frame with <⅓ of bands carrying structure is a failed capture, refused rather than analysed. |
| 7 | HN grades weak; every page with an action target clears weak | A page with no click target cannot forecast base-rate clicks — the attention gate has nothing to gate (Fitts/eye-tracking conversion work: unfixated targets are not clicked). |

## What the model is centred on

The five logit priors are centred on this panel's medians (notice 0.28, reward 0.44,
memory 0.35, language 0.23, friction 0.33; measured 2026-09-02) and the centres are
printed in every derivation. A page at the panel median on every term forecasts the
base rate. The panel is the scale. Nothing is fitted to private conversion data —
that is stated on the Method page, on Pricing, and in Terms.

## Why the attention model is not fMRI-shaped

TRIBE v2 predicts fMRI to passive film viewing at 1 Hz; a landing page is scanned by
someone with a goal at saccade speed, and neural→outcome effect sizes in the
neuroforecasting literature are modest (Genevsky & Knutson 2015; Genevsky, Yoon &
Knutson 2017). So attention here is a bottom-up saliency map (Itti–Koch–Niebur
centre–surround on intensity, RG/BY opponency and orientation) under a top-and-left
reading prior from web eye-tracking (Buscher, Cutrell & Morris 2009), divided by
competition, with a noticeability gate on whether an action target exists.

## Reproduce

```bash
npm run validate                      # against production
node tests/validate.mjs --host http://localhost:3141
```

Six pages is exactly the anonymous limiter's per-minute budget; wait a minute
between runs, or use an API key.
