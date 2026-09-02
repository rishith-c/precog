import "server-only";

/* The renderer, lifted out of the route so the server-side pipeline can
   call it directly instead of fetching its own API by origin. Primary is
   real headless Chrome; thum.io is a fallback because it silently returns
   a nav-only frame on JS-heavy pages. */

export function normaliseUrl(target: string) {
  const url = /^https?:\/\//i.test(target) ? target : `https://${target}`;
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol)) throw new Error("only http and https are supported");
  return u.toString();
}

function sources(url: string, width: number) {
  const enc = encodeURIComponent(url);
  return [
    `https://api.microlink.io/?url=${enc}&screenshot=true&meta=false&embed=screenshot.url` +
      `&viewport.width=${width}&viewport.height=1600&viewport.deviceScaleFactor=1` +
      `&waitUntil=networkidle2&screenshot.type=png`,
    `https://image.thum.io/get/width/${width}/crop/1600/noanimate/${url}`,
  ];
}

export async function capture(target: string, width = 1280): Promise<Uint8Array> {
  const url = normaliseUrl(target);
  let last = "no renderer responded";

  for (const src of sources(url, width)) {
    try {
      const res = await fetch(src, { signal: AbortSignal.timeout(75_000), redirect: "follow" });
      if (!res.ok) { last = `renderer returned HTTP ${res.status}`; continue; }
      if (!(res.headers.get("content-type") ?? "").includes("image")) {
        last = "renderer did not return an image"; continue;
      }
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.byteLength < 4000) { last = "renderer returned an empty frame"; continue; }
      return buf;
    } catch {
      last = "renderer timed out";
    }
  }
  throw new Error(last);
}
