import { Band } from "./types";

/* ------------------------------------------------------------------
   Real pixel analysis, in the browser, on a same-origin proxied image.
   No model, no guessing: these are measured statistics of the actual
   rendered page. Everything downstream is built on these six numbers.
   ------------------------------------------------------------------ */

const CELL = 24;   // px grid for local statistics

export async function analyzeImage(src: string, bandCount = 12): Promise<{ bands: Band[]; w: number; h: number }> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = src;
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("could not decode the captured page"));
  });

  const w = Math.min(img.naturalWidth, 900);
  const h = Math.round((img.naturalHeight / img.naturalWidth) * w);
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  const lumAt = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
  };
  const chromaAt = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
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
          // local energy = contrast x edge density: what makes a cell pop out
          cellEnergy.push(Math.sqrt(varr) * 2 + (cEdge / Math.max(1, cN)) * 3);
        }
      }
    }

    const mean = n ? lumSum / n : 1;
    const varr = n ? Math.max(0, lumSq / n - mean * mean) : 0;
    const contrast = Math.sqrt(varr);
    const edge = edgeN ? Math.min(1, (edgeSum / edgeN) * 7) : 0;
    const chroma = n ? chSum / n : 0;

    // A cell is "salient" when it clears the page's own energy distribution,
    // not a fixed threshold — pop-out is relative.
    const sorted = [...cellEnergy].sort((a, b) => a - b);
    const p75 = sorted[Math.floor(sorted.length * 0.75)] ?? 0;
    const thresh = Math.max(0.10, p75 * 1.45);
    const salientCells = cellEnergy.filter((e) => e > thresh).length;
    const emptiness = cellEnergy.length
      ? cellEnergy.filter((e) => e < 0.045).length / cellEnergy.length : 0;

    bands.push({
      y0: yStart / h, y1: yEnd / h,
      lum: mean, contrast, edge, chroma, salientCells, emptiness,
    });
  }

  return { bands, w, h };
}
