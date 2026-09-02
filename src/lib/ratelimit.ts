import "server-only";

/* Sliding-window limiter, in memory.

   It is per-instance: on Vercel each warm function has its own window, so
   the real ceiling is (limit × instances). That is still the difference
   between "one laptop can burn the whole capture budget" and "it cannot",
   which is what a limiter is for at this size. A shared store (Upstash,
   or the Blob store) makes it global; the interface does not change. */

const windows = new Map<string, number[]>();

export interface Verdict { ok: boolean; remaining: number; retryAfterSec: number; limit: number }

export function limit(key: string, max: number, windowMs: number): Verdict {
  const now = Date.now();
  const since = now - windowMs;
  const hits = (windows.get(key) ?? []).filter((t) => t > since);
  if (hits.length >= max) {
    const retryAfterSec = Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1000));
    windows.set(key, hits);
    return { ok: false, remaining: 0, retryAfterSec, limit: max };
  }
  hits.push(now);
  windows.set(key, hits);
  // keep the map from growing without bound on a long-lived instance
  if (windows.size > 5000) for (const [k, v] of windows) if (v.every((t) => t <= since)) windows.delete(k);
  return { ok: true, remaining: max - hits.length, retryAfterSec: 0, limit: max };
}

/** Best-effort client identity behind Vercel's proxy. */
export function clientKey(req: Request) {
  const h = req.headers;
  return (
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",")[0].trim() ??
    h.get("cf-connecting-ip") ??
    "anon"
  );
}

export function limitHeaders(v: Verdict) {
  return {
    "x-ratelimit-limit": String(v.limit),
    "x-ratelimit-remaining": String(v.remaining),
    ...(v.ok ? {} : { "retry-after": String(v.retryAfterSec) }),
  };
}
