export type NetworkId = "visual" | "attention" | "language" | "reward" | "salience" | "memory";

export const NETWORKS: { id: NetworkId; label: string; roi: string; blurb: string }[] = [
  { id: "visual",    label: "Visual",    roi: "V1–V4, occipital",        blurb: "Raw legibility. Does the pixel field resolve into structure, or into noise?" },
  { id: "attention", label: "Attention", roi: "IPS + FEF, dorsal",       blurb: "Where gaze is pulled. Competing salient regions divide this, they do not add to it." },
  { id: "language",  label: "Language",  roi: "STG + IFG, temporal",     blurb: "Reading cost. High values here are effort, not comprehension." },
  { id: "reward",    label: "Reward",    roi: "NAcc + vmPFC",            blurb: "Anticipated value. The single best neural predictor of aggregate purchase." },
  { id: "salience",  label: "Salience",  roi: "anterior insula + dACC",  blurb: "Risk and friction. Elevated insula tracks hesitation, not excitement." },
  { id: "memory",    label: "Memory",    roi: "MTL + precuneus",         blurb: "Encoding strength. Predicts whether the page survives a closed tab." },
];

export interface Band {
  /** fraction of full page height where this band starts / ends */
  y0: number; y1: number;
  /** mean luminance 0..1 */
  lum: number;
  /** RMS luminance contrast within the band */
  contrast: number;
  /** normalised edge energy (Sobel-ish gradient magnitude), 0..1 */
  edge: number;
  /** mean chroma 0..1 */
  chroma: number;
  /** count of locally-salient cells (competing attention magnets) */
  salientCells: number;
  /** fraction of cells that are near-uniform (whitespace) */
  emptiness: number;
}

export interface PageFeatures {
  url: string;
  finalUrl: string;
  title: string;
  description: string;
  words: number;
  headings: number;
  h1: string;
  ctas: string[];
  ctaCount: number;
  links: number;
  images: number;
  formFields: number;
  scripts: number;
  bytes: number;
  /** lexical: mean characters per word across body copy */
  avgWordLen: number;
  /** counts of value / urgency / risk lexicon hits */
  valueWords: number;
  socialProof: number;
  urgencyWords: number;
  frictionWords: number;
  jargonWords: number;
  hasPricing: boolean;
  fetchMs: number;
}

export interface NetworkFrame {
  t: number;
  values: Record<NetworkId, number>;
}

export interface Encoding {
  /** peak (max over time) response per network, 0..100 */
  peak: Record<NetworkId, number>;
  /** area under the 1 Hz curve per network, 0..100 */
  mean: Record<NetworkId, number>;
  frames: NetworkFrame[];
  /** per-band attention weight 0..1, indexed like bands */
  bandAttention: number[];
  source: "tribe-v2" | "precog-encoder";
  notes: string[];
}

export interface Fix {
  title: string;
  detail: string;
  liftPct: number;
  network: NetworkId;
}

export interface Forecast {
  ctr: number;        // predicted CTA click-through, %
  ctrLow: number;
  ctrHigh: number;
  noticeability: number;   // 0..1  — is the CTA seen at all
  intent: number;          // 0..1  — reward drive given it is seen
  friction: number;        // 0..1  — insula-tracked hesitation
  scrollDepth: number;     // predicted median scroll depth, % of page
  recall: number;          // 0..1  — 24h aided recall proxy
  grade: "strong" | "workable" | "weak";
  fixes: Fix[];
  derivation: string[];
}
