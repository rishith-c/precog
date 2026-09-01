import { Encoding, Fix, Forecast, PageFeatures } from "./types";

/* ------------------------------------------------------------------
   NEUROFORECAST  —  cortical response -> population click behaviour

   Structure follows the published "brain-as-predictor" result: neural
   response in a small sample forecasts AGGREGATE behaviour better than
   the same sample's self-report.

     reward (NAcc / vmPFC)  -> aggregate choice and purchase
        Knutson & Genevsky, neuroforecasting aggregate choice
        Berns & Moore, neural focus group predicts population sales
     mPFC / self-relevance  -> population campaign response
        Falk et al., brain-as-predictor for public-health campaigns
     attention gate         -> an unfixated target cannot be clicked
     insula / dACC          -> hesitation, abandonment

   Coefficients are STATED PRIORS on the logit scale, not values fitted
   to this page. They are printed verbatim in the Derivation panel so a
   reader can disagree with a specific number rather than the whole box.
   ------------------------------------------------------------------ */

export const PRIORS = {
  base: 0.042,        // B2B SaaS hero-CTA click-through, mid of reported range
  bNotice:   1.35,    // attention gate — dominant term
  bReward:   1.10,    // NAcc -> aggregate choice
  bMemory:   0.35,    // encoding strength -> return + delayed click
  bLanguage: -0.55,   // reading cost suppresses action
  bFriction: -1.20,   // insula-tracked hesitation
};

const logit = (p: number) => Math.log(p / (1 - p));
const invlogit = (x: number) => 1 / (1 + Math.exp(-x));
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

function ctrFrom(n: { notice: number; reward: number; memory: number; language: number; friction: number }) {
  const z =
    logit(PRIORS.base) +
    PRIORS.bNotice   * (n.notice   - 0.5) +
    PRIORS.bReward   * (n.reward   - 0.5) +
    PRIORS.bMemory   * (n.memory   - 0.5) +
    PRIORS.bLanguage * (n.language - 0.5) +
    PRIORS.bFriction * (n.friction - 0.5);
  return invlogit(z);
}

export function forecast(enc: Encoding, page: PageFeatures): Forecast {
  // Peak response is the decision-relevant statistic for reward and salience;
  // sustained mean is what matters for reading cost and encoding.
  const notice   = clamp(enc.peak.attention / 100);
  const reward   = clamp(enc.peak.reward / 100);
  const memory   = clamp(enc.mean.memory / 100);
  const language = clamp(enc.mean.language / 100);
  const friction = clamp(enc.peak.salience / 100);

  const p = ctrFrom({ notice, reward, memory, language, friction });

  // Interval widens when the stimulus resolved fewer independent signals.
  const resolved =
    (page.ctaCount > 0 ? 1 : 0) + (page.hasPricing ? 1 : 0) +
    (page.socialProof > 0 ? 1 : 0) + (page.words > 80 ? 1 : 0) +
    (page.headings > 1 ? 1 : 0) + (page.images > 2 ? 1 : 0);
  const spread = 0.42 - 0.045 * resolved;          // 0.42 -> 0.15 on the logit
  const ctrLow  = invlogit(logit(p) - spread) * 100;
  const ctrHigh = invlogit(logit(p) + spread) * 100;

  // Median scroll depth from the attention decay curve.
  // Attention rises with the HRF before it decays, so the half-life has to be
  // read after the peak — searching from t=0 finds the ramp and reports zero.
  let peakAt = 0;
  enc.frames.forEach((f, i) => { if (f.values.attention > enc.frames[peakAt].values.attention) peakAt = i; });
  const after = enc.frames.slice(peakAt).findIndex((f) => f.values.attention < enc.peak.attention * 0.5);
  const halfLife = after === -1 ? enc.frames.length : peakAt + after;
  const scrollDepth = clamp((halfLife / enc.frames.length) * 1.3) * 100;

  // 24 h aided recall proxy from encoding strength.
  const recall = clamp(0.18 + 0.62 * memory);

  const ctr = p * 100;
  const grade: Forecast["grade"] = ctr >= 5.0 ? "strong" : ctr >= 2.8 ? "workable" : "weak";

  // ---- FIXES: each lift is DERIVED by re-running the same model with one
  //      term moved to a realistic target, never asserted. -----------------
  const cand: Fix[] = [];
  const push = (
    title: string, detail: string, network: Fix["network"],
    override: Partial<Record<"notice" | "reward" | "memory" | "language" | "friction", number>>
  ) => {
    const alt = ctrFrom({ notice, reward, memory, language, friction, ...override });
    const lift = ((alt - p) / p) * 100;
    if (lift > 1.5) cand.push({ title, detail, network, liftPct: Math.round(lift) });
  };

  if (notice < 0.62) push(
    "Give the primary action a contrast island",
    `Dorsal attention peaks at ${Math.round(notice * 100)}. ${page.ctaCount > 1 ? `The action is competing with ${page.ctaCount - 1} other target${page.ctaCount > 2 ? "s" : ""} and the surrounding density.` : page.ctaCount === 1 ? "There is one action, but it is not winning against the surrounding density." : "No action target was detected at all — nothing on the page is asking for a click."} Raise local contrast around one button and clear ~40px of space on every side of it — pop-out is a ratio to the surround, not an absolute brightness.`,
    "attention", { notice: Math.min(0.82, notice + 0.22) });

  if (reward < 0.55) push(
    "State the outcome before the mechanism",
    page.hasPricing
      ? `Reward response tops out at ${Math.round(reward * 100)}. Value cues exist but arrive after the reader has spent their attention budget. Move the concrete outcome — the number, the saved hour, the removed step — above the fold.`
      : `Reward response tops out at ${Math.round(reward * 100)} and no price or plan cue was found. NAcc anticipation is the single strongest neural predictor of aggregate choice; with nothing to anchor on it never rises.`,
    "reward", { reward: Math.min(0.78, reward + 0.20) });

  if (friction > 0.42) push(
    "Remove the hesitation cues before the action",
    `Insula and dACC response reaches ${Math.round(friction * 100)}. ${page.formFields > 3 ? `${page.formFields} form fields sit between intent and completion. ` : ""}${page.jargonWords > 3 ? `${page.jargonWords} unresolved jargon terms force a comprehension stall. ` : ""}Hesitation is subtractive: it removes clicks that reward had already earned.`,
    "salience", { friction: Math.max(0.22, friction - 0.20) });

  if (language > 0.52) push(
    "Cut reading cost on the path to the action",
    `Sustained language load is ${Math.round(language * 100)} across ${page.words} words at ${page.avgWordLen.toFixed(1)} characters per word. High temporal-lobe load is effort, not comprehension — it competes with the decision rather than supporting it.`,
    "language", { language: Math.max(0.30, language - 0.18) });

  if (memory < 0.45) push(
    "Give the page one distinctive thing to encode",
    `Encoding strength averages ${Math.round(memory * 100)}. A page that is understood and forgotten converts on the first visit only. One unusual visual or one concrete number carries the recall.`,
    "memory", { memory: Math.min(0.72, memory + 0.20) });

  cand.sort((a, b) => b.liftPct - a.liftPct);

  const derivation = [
    `base            = ${PRIORS.base.toFixed(3)}                 logit = ${logit(PRIORS.base).toFixed(3)}`,
    `notice   ${notice.toFixed(3)}  x ${PRIORS.bNotice.toFixed(2).padStart(5)}  ->  ${(PRIORS.bNotice * (notice - 0.5)).toFixed(4).padStart(8)}`,
    `reward   ${reward.toFixed(3)}  x ${PRIORS.bReward.toFixed(2).padStart(5)}  ->  ${(PRIORS.bReward * (reward - 0.5)).toFixed(4).padStart(8)}`,
    `memory   ${memory.toFixed(3)}  x ${PRIORS.bMemory.toFixed(2).padStart(5)}  ->  ${(PRIORS.bMemory * (memory - 0.5)).toFixed(4).padStart(8)}`,
    `language ${language.toFixed(3)}  x ${PRIORS.bLanguage.toFixed(2).padStart(5)}  ->  ${(PRIORS.bLanguage * (language - 0.5)).toFixed(4).padStart(8)}`,
    `friction ${friction.toFixed(3)}  x ${PRIORS.bFriction.toFixed(2).padStart(5)}  ->  ${(PRIORS.bFriction * (friction - 0.5)).toFixed(4).padStart(8)}`,
    `                                        ---------`,
    `z = ${logit(p).toFixed(4)}    ctr = invlogit(z) = ${ctr.toFixed(2)}%`,
    `interval  +/- ${spread.toFixed(3)} logit  (${resolved}/6 stimulus signals resolved)`,
  ];

  return {
    ctr, ctrLow, ctrHigh, noticeability: notice, intent: reward,
    friction, scrollDepth, recall, grade, fixes: cand.slice(0, 5), derivation,
  };
}
