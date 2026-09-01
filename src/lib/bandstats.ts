import { Band } from "./types";

/* The single implementation of the band statistics. The browser feeds it
   canvas ImageData; the server feeds it a decoded PNG. One code path, so the
   client and the API can never disagree about what a page measures. */

const CELL = 24;

export function computeBands(rgba: Uint8Array | Uint8ClampedArray, w: number, h: number, bandCount = 12): Band[] {
  const lumAt = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return (0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2]) / 255;
  };
  const chromaAt = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    const r = rgba[i] / 255, g = rgba[i + 1] / 255, b = rgba[i + 2] / 255;
    return Math.max(r, g, b) - Math.min(r, g, b);
  };

  const bands: Band[] = [];
  const bh = Math.floor(h / bandCount);

  for (let bi = 0; bi < bandCount; bi++) {
    const yStart = bi * bh;
    const yEnd = bi === bandCount - 1 ? h : yStart + bh;

    let lumSum = 0, lumSq = 0, chSum = 0, n = 0, edgeSum = 0, edgeN = 0;
    const cellEnergy: number[] = [];

    for (let cy = yStart; cy < yEnd; cy += CELL) {
      for (let cx = 0; cx < w; cx += CELL) {
        let cLum = 0, cLumSq = 0, cN = 0, cEdge = 0;
        const yMax = Math.min(cy + CELL, yEnd), xMax = Math.min(cx + CELL, w);
        for (let y = cy; y < yMax; y += 2) {
          for (let x = cx; x < xMax; x += 2) {
            const L = lumAt(x, y);
            cLum += L; cLumSq += L * L; cN++;
            lumSum += L; lumSq += L * L; chSum += chromaAt(x, y); n++;
            if (x + 2 < xMax && y + 2 < yMax) {
              const gx = Math.abs(lumAt(x + 2, y) - L);
              const gy = Math.abs(lumAt(x, y + 2) - L);
              const g = Math.sqrt(gx * gx + gy * gy);
              cEdge += g; edgeSum += g; edgeN++;
            }
          }
        }
        if (cN > 0) {
          const mean = cLum / cN;
          const varr = Math.max(0, cLumSq / cN - mean * mean);
          cellEnergy.push(Math.sqrt(varr) * 2 + (cEdge / Math.max(1, cN)) * 3);
        }
      }
    }

    const mean = n ? lumSum / n : 1;
    const varr = n ? Math.max(0, lumSq / n - mean * mean) : 0;
    const sorted = [...cellEnergy].sort((a, b) => a - b);
    const p75 = sorted[Math.floor(sorted.length * 0.75)] ?? 0;
    const thresh = Math.max(0.10, p75 * 1.45);

    bands.push({
      y0: yStart / h, y1: yEnd / h,
      lum: mean,
      contrast: Math.sqrt(varr),
      edge: edgeN ? Math.min(1, (edgeSum / edgeN) * 7) : 0,
      chroma: n ? chSum / n : 0,
      salientCells: cellEnergy.filter((e) => e > thresh).length,
      emptiness: cellEnergy.length ? cellEnergy.filter((e) => e < 0.045).length / cellEnergy.length : 0,
    });
  }
  return bands;
}

/* ------------------------------------------------------------------
   Capture quality gate.

   Every number Precog reports rests on these bands. If the renderer
   handed back a near-uniform frame — a nav bar over dead space, a
   consent wall, a failed paint — the statistics are noise and the
   forecast built on them is worthless. An instrument has to know when
   its own sensor failed, so this is checked before anything is encoded.
   ------------------------------------------------------------------ */
export interface CaptureQuality { ok: boolean; informative: number; reason?: string }

export function captureQuality(bands: Band[]): CaptureQuality {
  if (!bands.length) return { ok: false, informative: 0, reason: "no bands were measured" };

  // A band carries information if it has either real luminance structure or
  // real edge energy. Flat colour in both is an empty region.
  const live = bands.filter((b) => b.contrast > 0.035 || b.edge > 0.05).length;
  const informative = live / bands.length;

  if (informative < 0.34) {
    return {
      ok: false, informative,
      reason: `only ${live} of ${bands.length} bands contained any visual structure — the renderer returned a near-empty frame, so there is nothing to measure`,
    };
  }
  return { ok: true, informative };
}
