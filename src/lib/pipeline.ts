import "server-only";
import { extractPage } from "./page";
import { decodePng } from "./png";
import { measure, captureQuality } from "./bandstats";
import { encode } from "./encoder";
import { forecast } from "./forecast";
import { capture, normaliseUrl } from "./capture";
import type { Band, Encoding, Forecast, PageFeatures } from "./types";

/* One run, server-side, whole pipeline. The browser demo on the landing
   page runs the identical maths client-side; everything that is saved goes
   through here so that a stored run and an API response cannot drift. */

export interface RunResult {
  page: PageFeatures;
  bands: Band[];
  enc: Encoding;
  fc: Forecast;
  png: Uint8Array;
  width: number;
  height: number;
  /** share of bands carrying visual structure — the capture-quality figure */
  informative: number;
  ms: number;
}

export class RunError extends Error {
  constructor(message: string, readonly status = 502) { super(message); }
}

export async function runAnalysis(target: string): Promise<RunResult> {
  const t0 = Date.now();

  let url: string;
  try { url = normaliseUrl(target); }
  catch { throw new RunError("That is not a URL Precog can reach.", 400); }

  const [pageRes, shotRes] = await Promise.allSettled([extractPage(url), capture(url, 1280)]);

  if (pageRes.status === "rejected")
    throw new RunError(`Could not read the page — ${pageRes.reason?.message ?? "unreachable"}.`);
  if (shotRes.status === "rejected")
    throw new RunError(`Could not capture the rendered page — ${shotRes.reason?.message ?? "no frame"}.`);

  const page = pageRes.value;
  const png = shotRes.value;

  const { data, width, height } = decodePng(Buffer.from(png));
  const { bands, focus } = measure(data, width, height, 12);

  /* A frame with no structure in it is not a cheap forecast, it is a wrong
     one. Refuse rather than analyse noise. */
  const q = captureQuality(bands);
  if (!q.ok) throw new RunError(`The capture is not measurable — ${q.reason}.`, 422);

  const enc = encode(bands, page, focus);
  const fc = forecast(enc, page);

  return { page, bands, enc, fc, png, width, height, informative: q.informative, ms: Date.now() - t0 };
}

export function hostOf(url: string) {
  try { return new URL(url).host.replace(/^www\./, ""); } catch { return url; }
}
