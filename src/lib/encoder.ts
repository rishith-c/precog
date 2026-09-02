import { Band, Encoding, NetworkId, PageFeatures, NetworkFrame } from "./types";
import { focusOf } from "./bandstats";

/* ------------------------------------------------------------------
   PRECOG ENCODER  —  stimulus features -> six cortical network responses

   TRIBE-shaped: a stimulus in, a 1 Hz timecourse per network out,
   haemodynamically smoothed. Not TRIBE, and honest about it.

   The point of this file is that the six networks have six different
   MECHANISMS, so their curves differ in shape and not merely in scale:

     visual     transient — responds to saliency energy, adapts to repetition
     attention  early-heavy — saliency concentration under competition,
                depleting with scroll (the F-pattern prior lives here)
     language   leaky integrator of text in view × lexical cost
     reward     gated integrator — value cues and imagery, gated by attention,
                because a reader cannot value what they never fixated
     salience   phasic — fires on change toward friction, not on level
     memory     slow integrator of novelty × reward, leaky, load-suppressed

   Every coefficient is stated; nothing is fitted on private data.
   ------------------------------------------------------------------ */

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const sat = (v: number, k: number) => 1 - Math.exp(-v / k);

/** Gamma-shaped haemodynamic response, ~6 s peak, light undershoot. */
function hrf(n: number): number[] {
  const k: number[] = [];
  for (let t = 0; t < n; t++) {
    const a = Math.pow(t, 5) * Math.exp(-t / 1.0);
    const b = 0.35 * Math.pow(t, 12) * Math.exp(-t / 1.0);
    k.push(a / 120 - b / 4e8);
  }
  const s = k.reduce((p, c) => p + Math.abs(c), 0) || 1;
  return k.map((v) => v / s);
}
function convolve(x: number[], k: number[]): number[] {
  const out = new Array(x.length).fill(0);
  for (let i = 0; i < x.length; i++) for (let j = 0; j < k.length && i - j >= 0; j++) out[i] += x[i - j] * k[j];
  return out;
}

/** A reader scrolls, dwelling near the top and accelerating through the middle. */
export function scrollSchedule(bandCount: number, seconds = 24): number[] {
  const sched: number[] = [];
  for (let t = 0; t < seconds; t++) {
    const p = 1 - Math.pow(1 - t / (seconds - 1), 1.7);
    sched.push(clamp(p) * (bandCount - 1));
  }
  return sched;
}

function lerpBand(bands: Band[], idx: number): Band {
  const i0 = Math.floor(idx), i1 = Math.min(bands.length - 1, i0 + 1), f = idx - i0;
  const L = (k: keyof Band) => (bands[i0][k] as number) * (1 - f) + (bands[i1][k] as number) * f;
  return {
    y0: 0, y1: 0, lum: L("lum"), contrast: L("contrast"), edge: L("edge"), chroma: L("chroma"),
    salientCells: L("salientCells"), emptiness: L("emptiness"), saliency: L("saliency"),
    salConc: L("salConc"), photo: L("photo"),
  };
}

export function encode(bands: Band[], page: PageFeatures, pageFocus?: number): Encoding {
  const notes: string[] = [];
  const seconds = 24;
  const sched = scrollSchedule(bands.length, seconds);
  const focus = pageFocus ?? focusOf(bands);

  // ---- page-level linguistic drives ------------------------------------
  const wordLoad = sat(page.words / 900, 1.0);
  const lexComplexity = clamp((page.avgWordLen - 4.1) / 2.6);
  const valueDrive = sat((page.valueWords + 0.7 * page.offerWords) / 15, 1.0);
  const proofDrive = sat(page.socialProof / 7, 1.0);
  const urgency = sat(page.urgencyWords / 7, 1.0);
  const frictionLex = sat(page.frictionWords / 8, 1.0);
  const jargon = sat(page.jargonWords / 10, 1.0);
  const formCost = sat(page.formFields / 5, 1.0);
  const imagery = clamp(bands.reduce((p, b) => p + b.photo, 0) / bands.length * 2.2);

  if (page.words > 1400) notes.push(`Body copy is ${page.words} words — language load saturates before the fold clears.`);
  if (page.ctaCount > 6) notes.push(`${page.ctaCount} call-to-action targets compete; dorsal attention divides across them.`);
  if (!page.hasPricing && page.offerWords < 3) notes.push("No price, plan or offer cue found — reward anticipation has nothing to settle on.");
  if (focus < 0.12) notes.push("Saliency is spread almost evenly down the page — nothing is allowed to be the one thing.");

  // divisive normalisation, floored: clutter costs attention, never annihilates it
  const meanSalient = bands.reduce((p, b) => p + b.salientCells, 0) / Math.max(1, bands.length);
  const competition = 0.46 + 0.54 / (1 + meanSalient / 9);

  const raw: Record<NetworkId, number[]> = { visual: [], attention: [], language: [], reward: [], salience: [], memory: [] };

  // state for the integrators
  let adapt = 0, lang = 0, rewardAcc = 0, mem = 0;
  const salHist: number[] = [];

  for (let t = 0; t < seconds; t++) {
    const idx = sched[t];
    const depth = idx / Math.max(1, bands.length - 1);
    const b = lerpBand(bands, idx);
    const prev = t > 0 ? bands[Math.floor(sched[t - 1])] : bands[0];
    const novelty = clamp(Math.abs(b.edge - prev.edge) * 1.6 + Math.abs(b.chroma - prev.chroma) * 1.2 + Math.abs(b.lum - prev.lum) * 0.9 + Math.abs(b.saliency - prev.saliency) * 1.4);

    // ---- VISUAL: saliency energy with repetition suppression --------------
    const vIn = clamp(0.55 * b.saliency + 0.25 * b.contrast * 2.5 + 0.20 * b.chroma * 1.6);
    adapt = 0.82 * adapt + 0.18 * vIn;
    raw.visual.push(clamp(vIn * (1 - 0.55 * adapt) + 0.45 * novelty));

    // ---- ATTENTION: concentration under competition, depleting -----------
    const stamina = Math.exp(-t / 9);
    const conc = clamp((b.salConc - 1) / 3.2);                 // 1 flat .. 4.2+ one thing pops
    const fPrior = 0.45 + 0.55 * Math.exp(-depth / 0.42);      // top-weighted reading prior
    raw.attention.push(clamp((0.50 * focus + 0.30 * b.saliency + 0.20 * conc) * competition * fPrior * (0.55 + 0.45 * stamina) + 0.15 * novelty));

    // ---- LANGUAGE: leaky integrator of text in view -----------------------
    const textish = clamp(b.edge * 1.15 * (1 - b.chroma * 0.6) * (1 - b.photo));
    lang = 0.70 * lang + 0.30 * textish * (0.52 + 0.55 * wordLoad) * (0.72 + 0.45 * lexComplexity);
    raw.language.push(clamp(lang * 1.25));

    // ---- REWARD: value and imagery, gated by what was actually seen -------
    const attn = raw.attention[t];
    const cue = 0.40 * valueDrive + 0.22 * proofDrive + 0.10 * urgency + 0.12 * (page.hasPricing ? 1 : 0) + 0.30 * imagery * clamp(b.photo * 2.5);
    rewardAcc = 0.72 * rewardAcc + 0.28 * cue * Math.pow(clamp(attn * 1.6), 0.5);
    raw.reward.push(clamp(rewardAcc * 1.35));

    // ---- SALIENCE (insula): phasic, fires on change toward friction -------
    const chaos = clamp((b.edge - 0.5) * 2.2) * 0.5 + clamp((b.salientCells - 3) / 6) * 0.5;
    const late = depth > 0.55 ? 1 : depth / 0.55;
    const sIn = 0.32 * chaos + 0.28 * frictionLex * late + 0.22 * jargon * textish + 0.18 * formCost * late;
    salHist.push(sIn);
    const base = salHist.slice(-4, -1).reduce((p, c) => p + c, 0) / Math.max(1, Math.min(3, salHist.length - 1));
    raw.salience.push(clamp(0.35 * sIn + 1.6 * Math.max(0, sIn - base) + 0.1 * novelty));

    // ---- MEMORY: slow integrator of novelty × reward, load-suppressed -----
    mem = 0.88 * mem + 0.12 * (0.55 * novelty + 0.45 * raw.reward[t]) * (1 - 0.35 * wordLoad);
    raw.memory.push(clamp(mem * 1.8 + 0.10 * clamp(b.emptiness * 1.3)));
  }

  // ---- haemodynamic smoothing; each network keeps its own absolute level --
  const k = hrf(9);
  const smoothed: Record<string, number[]> = {};
  (Object.keys(raw) as NetworkId[]).forEach((id) => {
    const c = convolve(raw[id], k);
    const mx = Math.max(...c, 1e-6), ceil = Math.max(...raw[id], 1e-6);
    smoothed[id] = c.map((v) => clamp((v / mx) * ceil) * 100);
  });
  const frames: NetworkFrame[] = [];
  for (let t = 0; t < seconds; t++) frames.push({ t, values: {
    visual: smoothed.visual[t], attention: smoothed.attention[t], language: smoothed.language[t],
    reward: smoothed.reward[t], salience: smoothed.salience[t], memory: smoothed.memory[t],
  } });

  const RAMP = 5;
  const peak = {} as Record<NetworkId, number>, mean = {} as Record<NetworkId, number>;
  (Object.keys(raw) as NetworkId[]).forEach((id) => {
    peak[id] = Math.round(Math.max(...smoothed[id]));
    const tail = smoothed[id].slice(RAMP);
    mean[id] = Math.round(tail.reduce((p, c) => p + c, 0) / tail.length);
  });

  // per-band attention for the overlay: saliency × reading prior × competition
  const bandAttention = bands.map((b, i) => {
    const depth = i / Math.max(1, bands.length - 1);
    return clamp((0.6 * b.saliency + 0.4 * clamp((b.salConc - 1) / 3.2)) * competition * (0.45 + 0.55 * Math.exp(-depth / 0.42)) * 1.4);
  });

  return { peak, mean, frames, bandAttention, focus, source: "precog-encoder", notes };
}
