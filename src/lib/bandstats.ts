import { Band } from "./types";

/* ------------------------------------------------------------------
   The single implementation of the band statistics. The browser feeds it
   canvas ImageData; the server feeds it a decoded PNG. One code path, so the
   client and the API can never disagree about what a page measures.

   Two layers of measurement:

   1. Cell statistics on a 24 px grid: luminance, RMS contrast, gradient
      energy, chroma, whitespace.
   2. A bottom-up saliency map in the Itti–Koch–Niebur (1998) shape:
      centre–surround differences on intensity, red–green and blue–yellow
      opponency, and orientation energy, each map normalised so a map with
      one strong peak counts for more than a map of uniform noise, then
      summed and multiplied by a positional prior. The prior is the
      well-replicated web reading pattern — top-weighted, slightly
      left-weighted — from eye-tracking on pages (Buscher, Cutrell & Morris
      2009; Nielsen's F-pattern). It is a prior, not a model of this reader.
   ------------------------------------------------------------------ */

const CELL = 24;

interface Cell { lum: number; con: number; edge: number; chroma: number; rg: number; by: number; ori: number }

function cellGrid(rgba: Uint8Array | Uint8ClampedArray, w: number, h: number) {
  const cols = Math.ceil(w / CELL), rows = Math.ceil(h / CELL);
  const cells: Cell[] = new Array(cols * rows);
  const lumAt = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return (0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2]) / 255;
  };
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    let n = 0, sL = 0, sL2 = 0, sCh = 0, sRG = 0, sBY = 0, eH = 0, eV = 0, eN = 0;
    const y0 = r * CELL, y1 = Math.min(h, y0 + CELL), x0 = c * CELL, x1 = Math.min(w, x0 + CELL);
    for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
      const i = (y * w + x) * 4;
      const R = rgba[i] / 255, G = rgba[i + 1] / 255, B = rgba[i + 2] / 255;
      const L = 0.2126 * R + 0.7152 * G + 0.0722 * B;
      sL += L; sL2 += L * L; n++;
      sCh += Math.max(R, G, B) - Math.min(R, G, B);
      sRG += R - G; sBY += B - (R + G) / 2;
      if (x + 2 < x1 && y + 2 < y1) {
        eH += Math.abs(lumAt(x + 2, y) - L); eV += Math.abs(lumAt(x, y + 2) - L); eN++;
      }
    }
    const mean = n ? sL / n : 0;
    const varr = n ? Math.max(0, sL2 / n - mean * mean) : 0;
    const gh = eN ? eH / eN : 0, gv = eN ? eV / eN : 0;
    cells[r * cols + c] = {
      lum: mean, con: Math.sqrt(varr), edge: Math.min(1, Math.sqrt(gh * gh + gv * gv) * 7),
      chroma: n ? sCh / n : 0, rg: n ? sRG / n : 0, by: n ? sBY / n : 0,
      // orientation anisotropy: text and rules are strongly oriented, photos are not
      ori: gh + gv > 1e-6 ? Math.abs(gh - gv) / (gh + gv) : 0,
    };
  }
  return { cells, cols, rows };
}

/** Itti's N(·): scale a map so that a few strong peaks beat many weak ones. */
function normalise(map: Float32Array) {
  let max = 0, sum = 0, n = 0;
  for (const v of map) { if (v > max) max = v; sum += v; n++; }
  if (max <= 1e-9) return map;
  const mean = sum / n;
  const w = Math.pow(Math.max(0, max - mean), 2) / (max * max);
  for (let i = 0; i < map.length; i++) map[i] = (map[i] / max) * (0.35 + 0.65 * w);
  return map;
}

function centreSurround(vals: Float32Array, cols: number, rows: number, radius: number) {
  const out = new Float32Array(vals.length);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    let s = 0, n = 0;
    for (let dr = -radius; dr <= radius; dr++) for (let dc = -radius; dc <= radius; dc++) {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || cc < 0 || rr >= rows || cc >= cols || (dr === 0 && dc === 0)) continue;
      s += vals[rr * cols + cc]; n++;
    }
    out[r * cols + c] = n ? Math.abs(vals[r * cols + c] - s / n) : 0;
  }
  return out;
}

export interface Measurement { bands: Band[]; focus: number }

/** Bands plus the page-level saliency concentration. */
export function measure(rgba: Uint8Array | Uint8ClampedArray, w: number, h: number, bandCount = 12): Measurement {
  const { cells, cols, rows } = cellGrid(rgba, w, h);
  const N = cells.length;

  // ---- saliency: four feature maps, two surround scales each -----------
  const feat = {
    I: Float32Array.from(cells, (c) => c.lum),
    RG: Float32Array.from(cells, (c) => c.rg),
    BY: Float32Array.from(cells, (c) => c.by),
    O: Float32Array.from(cells, (c) => c.edge * (0.5 + 0.5 * c.ori)),
  };
  const sal = new Float32Array(N);
  for (const m of Object.values(feat)) {
    for (const radius of [1, 3]) {
      const cs = normalise(centreSurround(m, cols, rows, radius));
      for (let i = 0; i < N; i++) sal[i] += cs[i];
    }
  }
  // page-level focus, measured BEFORE the reading prior so a header at the
  // top does not count as concentration: the share of total saliency mass
  // held by the top 10% of cells. Uniform map → 0.10; one hot region → ~1.
  // The navigation strip is excluded: every web eye-tracking study finds the
  // top bar is scanned and dismissed (banner blindness), so a bright header
  // must not count as the page having one thing to look at.
  // …and measured over the FIRST VIEWPORT only. Nielsen's fold studies put
  // ~57% of viewing time above the fold and ~74% in the first two screens;
  // the click decision is made there. A long page's lower sections spread
  // saliency mass without ever receiving the fixations that would spend it.
  const navRows = Math.max(1, Math.round(rows * 0.08));
  const foldRows = Math.max(navRows + 2, Math.round(rows * 0.45));
  const body = Array.from(sal.subarray(navRows * cols, foldRows * cols)).sort((a, b) => b - a);
  const rawTotal = body.reduce((p, v) => p + v, 0) || 1;
  const topK = Math.max(1, Math.round(body.length * 0.10));
  const focus = Math.min(1, Math.max(0, (body.slice(0, topK).reduce((p, v) => p + v, 0) / rawTotal - 0.10) / 0.90));

  // positional prior: top-weighted, gently left-weighted, never zero
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const yfrac = r / Math.max(1, rows - 1), xfrac = c / Math.max(1, cols - 1);
    const prior = (0.35 + 0.65 * Math.exp(-yfrac / 0.45)) * (0.8 + 0.2 * Math.exp(-Math.pow((xfrac - 0.38) / 0.5, 2)));
    sal[r * cols + c] *= prior;
  }
  let smax = 0; for (const v of sal) if (v > smax) smax = v;
  if (smax > 0) for (let i = 0; i < N; i++) sal[i] /= smax;

  // ---- bands ----------------------------------------------------------
  const bands: Band[] = [];
  const bh = Math.floor(h / bandCount);
  for (let bi = 0; bi < bandCount; bi++) {
    const yStart = bi * bh, yEnd = bi === bandCount - 1 ? h : yStart + bh;
    const r0 = Math.floor(yStart / CELL), r1 = Math.max(r0 + 1, Math.ceil(yEnd / CELL));
    let n = 0, lum = 0, con2 = 0, edge = 0, chroma = 0, sSal = 0, sMax = 0, empty = 0, photo = 0;
    const energy: number[] = [];
    for (let r = r0; r < Math.min(rows, r1); r++) for (let c = 0; c < cols; c++) {
      const cell = cells[r * cols + c], s = sal[r * cols + c];
      n++; lum += cell.lum; con2 += cell.con * cell.con; edge += cell.edge; chroma += cell.chroma;
      sSal += s; if (s > sMax) sMax = s;
      const e = cell.con * 2 + cell.edge * 3; energy.push(e);
      if (e < 0.045) empty++;
      // photographic: colourful, smooth gradients, isotropic, not text
      if (cell.chroma > 0.12 && cell.edge < 0.35 && cell.ori < 0.45 && cell.con > 0.03) photo++;
    }
    const sorted = [...energy].sort((a, b) => a - b);
    const p75 = sorted[Math.floor(sorted.length * 0.75)] ?? 0;
    const thresh = Math.max(0.10, p75 * 1.45);
    const meanSal = n ? sSal / n : 0;
    bands.push({
      y0: yStart / h, y1: yEnd / h,
      lum: n ? lum / n : 1,
      contrast: n ? Math.sqrt(con2 / n) : 0,
      edge: n ? edge / n : 0,
      chroma: n ? chroma / n : 0,
      salientCells: energy.filter((e) => e > thresh).length,
      emptiness: n ? empty / n : 0,
      saliency: meanSal,
      salConc: meanSal > 1e-6 ? sMax / meanSal : 1,
      photo: n ? photo / n : 0,
    });
  }
  return { bands, focus };
}

/** Bands only — kept for callers that do not need the page-level focus. */
export function computeBands(rgba: Uint8Array | Uint8ClampedArray, w: number, h: number, bandCount = 12): Band[] {
  return measure(rgba, w, h, bandCount).bands;
}

/** 1 − normalised Shannon entropy of the saliency distribution across bands:
    one hot band → near 1; everything equally loud → 0. */
export function focusOf(bands: Band[]) {
  const tot = bands.reduce((p, b) => p + b.saliency, 0);
  if (tot <= 1e-9 || bands.length < 2) return 0;
  let H = 0;
  for (const b of bands) { const q = b.saliency / tot; if (q > 0) H -= q * Math.log(q); }
  return 1 - H / Math.log(bands.length);
}

/* ------------------------------------------------------------------
   Capture quality gate. If the renderer handed back a near-uniform frame,
   the statistics are noise and the forecast is worthless. Refuse.
   ------------------------------------------------------------------ */
export interface CaptureQuality { ok: boolean; informative: number; reason?: string }

export function captureQuality(bands: Band[]): CaptureQuality {
  if (!bands.length) return { ok: false, informative: 0, reason: "no bands were measured" };
  const live = bands.filter((b) => b.contrast > 0.035 || b.edge > 0.05).length;
  const informative = live / bands.length;
  if (informative < 0.34)
    return { ok: false, informative, reason: `only ${live} of ${bands.length} bands contained any visual structure — the renderer returned a near-empty frame, so there is nothing to measure` };
  return { ok: true, informative };
}
