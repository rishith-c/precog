import { Band, Encoding, NetworkId, PageFeatures, NetworkFrame } from "./types";

/* ------------------------------------------------------------------
   PRECOG ENCODER  —  stimulus features -> cortical network response

   This is a TRIBE-SHAPED encoder, not TRIBE. It reproduces the shape of
   the TRIBE v2 contract (multimodal stimulus in, 1 Hz network timecourse
   out, hemodynamic smoothing applied) using measured features of the page
   rather than a 1B-parameter fMRI-trained transformer.

   Every coefficient below is declared, bounded, and printed in the UI.
   Nothing here is fitted on private data; the structure follows published
   consumer-neuroscience findings and the weights are stated priors.
   ------------------------------------------------------------------ */

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const sat = (v: number, k: number) => 1 - Math.exp(-v / k);   // saturating response

/** Gamma-shaped haemodynamic response, ~6 s peak, light undershoot.
 *  TRIBE already shifts out the 5 s lag, so this only shapes, never delays. */
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
  for (let i = 0; i < x.length; i++)
    for (let j = 0; j < k.length && i - j >= 0; j++) out[i] += x[i - j] * k[j];
  return out;
}

/** A reader does not teleport. Model a scroll: dwell longer near the top,
 *  accelerate through the middle, one second per 1 Hz sample. */
export function scrollSchedule(bandCount: number, seconds = 24): number[] {
  const sched: number[] = [];
  for (let t = 0; t < seconds; t++) {
    // ease-out: fast early progress slows as attention decays
    const p = 1 - Math.pow(1 - t / (seconds - 1), 1.7);
    sched.push(clamp(p) * (bandCount - 1));
  }
  return sched;
}

export function encode(bands: Band[], page: PageFeatures): Encoding {
  const notes: string[] = [];
  const seconds = 24;
  const sched = scrollSchedule(bands.length, seconds);

  // ---- page-level (time-invariant) linguistic drives -------------------
  const wordLoad = sat(page.words / 900, 1.0);                 // reading cost
  const lexComplexity = clamp((page.avgWordLen - 4.1) / 2.6);  // >6.7 chars = dense
  const valueDrive = sat(page.valueWords / 15, 1.0);
  const proofDrive = sat(page.socialProof / 7, 1.0);
  const urgency = sat(page.urgencyWords / 7, 1.0);
  const frictionLex = sat(page.frictionWords / 8, 1.0);
  const jargon = sat(page.jargonWords / 10, 1.0);
  const formCost = sat(page.formFields / 5, 1.0);

  if (page.words > 1400) notes.push(`Body copy is ${page.words} words — language load saturates before the fold clears.`);
  if (page.ctaCount > 6) notes.push(`${page.ctaCount} call-to-action targets compete; dorsal attention divides across them.`);
  if (!page.hasPricing) notes.push("No price or plan cue found — reward anticipation has nothing to settle on.");

  const raw: Record<NetworkId, number[]> = {
    visual: [], attention: [], language: [], reward: [], salience: [], memory: [],
  };

  // global competition term: many salient cells across the page means each
  // one wins less. This is the biased-competition result, not a linear sum.
  const meanSalient = bands.reduce((p, b) => p + b.salientCells, 0) / Math.max(1, bands.length);
  // Divisive normalisation, floored: competing targets cost attention but can
  // never drive it to zero — a cluttered page is still seen, just seen worse.
  const competition = 0.46 + 0.54 / (1 + meanSalient / 9);

  for (let t = 0; t < seconds; t++) {
    const idx = sched[t];
    const i0 = Math.floor(idx), i1 = Math.min(bands.length - 1, i0 + 1);
    const f = idx - i0;
    const b: Band = {
      y0: 0, y1: 0,
      lum:        bands[i0].lum        * (1 - f) + bands[i1].lum        * f,
      contrast:   bands[i0].contrast   * (1 - f) + bands[i1].contrast   * f,
      edge:       bands[i0].edge       * (1 - f) + bands[i1].edge       * f,
      chroma:     bands[i0].chroma     * (1 - f) + bands[i1].chroma     * f,
      salientCells: bands[i0].salientCells * (1 - f) + bands[i1].salientCells * f,
      emptiness:  bands[i0].emptiness  * (1 - f) + bands[i1].emptiness  * f,
    };

    // temporal novelty: how much this band differs from the one before it
    const prev = t > 0 ? bands[Math.floor(sched[t - 1])] : bands[0];
    const novelty = clamp(
      Math.abs(b.edge - prev.edge) * 1.6 + Math.abs(b.chroma - prev.chroma) * 1.2 +
      Math.abs(b.lum - prev.lum) * 0.9
    );

    // decay of engagement with scroll time — attention is a depleting resource
    const stamina = Math.exp(-t / 15);

    // ---- VISUAL: contrast + edge energy, penalised by clutter ----------
    const v = clamp(0.44 * b.contrast * 3.1 + 0.36 * b.edge * 1.5 + 0.20 * b.chroma * 1.8) *
              (1 - 0.30 * clamp((b.edge - 0.62) * 2));
    raw.visual.push(clamp(v));

    // ---- ATTENTION: local pop-out, divided by global competition -------
    const popout = clamp(b.contrast * 2.9 + b.edge * 0.85) * (0.52 + 0.48 * b.emptiness);
    raw.attention.push(clamp(popout * competition * (0.62 + 0.38 * stamina) + 0.18 * novelty));

    // ---- LANGUAGE: text density in view x lexical difficulty -----------
    const textish = clamp(b.edge * 1.7 * (1 - b.chroma * 0.6));
    raw.language.push(clamp(textish * (0.55 + 0.65 * wordLoad) * (0.7 + 0.6 * lexComplexity)));

    // ---- REWARD: value cues, weighted to where they are read -----------
    const readWeight = Math.exp(-Math.pow((idx / (bands.length - 1) - 0.18) / 0.42, 2));
    raw.reward.push(clamp(
      (0.46 * valueDrive + 0.28 * proofDrive + 0.14 * urgency + 0.12 * (page.hasPricing ? 1 : 0)) *
      (0.42 + 0.58 * readWeight) * (0.55 + 0.45 * b.emptiness)
    ));

    // ---- SALIENCE: friction, jargon, form cost, visual chaos -----------
    raw.salience.push(clamp(
      0.30 * frictionLex + 0.24 * jargon + 0.22 * formCost +
      0.16 * clamp((b.edge - 0.5) * 2.2) + 0.14 * clamp((b.salientCells - 3) / 6)
    ));

    // ---- MEMORY: distinctiveness x reward, decayed by load -------------
    raw.memory.push(clamp(
      (0.44 * novelty + 0.34 * raw.reward[t] + 0.22 * clamp(b.emptiness * 1.3)) *
      (1 - 0.35 * wordLoad) * stamina
    ));
  }

  // ---- haemodynamic smoothing, then normalise to 0..100 ---------------
  const k = hrf(9);
  const frames: NetworkFrame[] = [];
  const smoothed: Record<string, number[]> = {};
  (Object.keys(raw) as NetworkId[]).forEach((id) => {
    const c = convolve(raw[id], k);
    const mx = Math.max(...c, 1e-6);
    // preserve absolute level: scale by the network's own raw ceiling, not to 1
    const ceil = Math.max(...raw[id], 1e-6);
    smoothed[id] = c.map((v) => clamp((v / mx) * ceil) * 100);
  });
  for (let t = 0; t < seconds; t++) {
    frames.push({
      t,
      values: {
        visual: smoothed.visual[t], attention: smoothed.attention[t],
        language: smoothed.language[t], reward: smoothed.reward[t],
        salience: smoothed.salience[t], memory: smoothed.memory[t],
      },
    });
  }

  const peak = {} as Record<NetworkId, number>;
  const mean = {} as Record<NetworkId, number>;
  // The HRF takes ~5 s to rise. Averaging from t=0 would score every network
  // against a ramp it has not climbed yet, deflating every sustained measure.
  const RAMP = 5;
  (Object.keys(raw) as NetworkId[]).forEach((id) => {
    peak[id] = Math.round(Math.max(...smoothed[id]));
    const tail = smoothed[id].slice(RAMP);
    mean[id] = Math.round(tail.reduce((p, c) => p + c, 0) / tail.length);
  });

  // ---- per-band attention, for the heat overlay -----------------------
  const bandAttention = bands.map((b, i) => {
    const popout = clamp(b.contrast * 2.9 + b.edge * 0.85) * (0.52 + 0.48 * b.emptiness);
    const depth = Math.exp(-Math.pow(i / Math.max(1, bands.length - 1) / 0.62, 1.9));
    return clamp(popout * competition * depth * 1.35);
  });

  return { peak, mean, frames, bandAttention, source: "precog-encoder", notes };
}
