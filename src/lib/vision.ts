import { Band } from "./types";
import { computeBands } from "./bandstats";

/* Browser side: decode the captured page onto a canvas and hand the raw RGBA
   to the shared band-statistics routine. Same maths as the server path. */

export async function analyzeImage(src: string, bandCount = 12): Promise<{ bands: Band[]; w: number; h: number }> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = src;
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("could not decode the captured page"));
  });

  const w = Math.min(img.naturalWidth, 1280);   // match the server path exactly
  const h = Math.round((img.naturalHeight / img.naturalWidth) * w);
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  return { bands: computeBands(data, w, h, bandCount), w, h };
}
