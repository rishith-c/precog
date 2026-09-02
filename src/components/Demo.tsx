"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { analyzeImage } from "@/lib/vision";
import { captureQuality } from "@/lib/bandstats";
import { encode } from "@/lib/encoder";
import { forecast } from "@/lib/forecast";
import { Band, Encoding, Forecast, PageFeatures } from "@/lib/types";
import { Arrow } from "@/components/marks";
import Report from "@/components/Report";

/* The unsigned-in demo. It runs the identical maths client-side and keeps
   nothing: no account, no card, and the run is gone when the tab closes.
   Saving it is what an account is for, which is the only thing the CTA
   underneath a finished run claims. */

type StepId = "capture" | "read" | "encode" | "forecast";
type StepState = "idle" | "run" | "done" | "fail";

interface DemoRun {
  id: string; url: string; host: string;
  page: PageFeatures; bands: Band[]; enc: Encoding; fc: Forecast;
  shotSrc: string; at: number; ms: number;
}

const STEPS: { id: StepId; label: string }[] = [
  { id: "capture",  label: "Capture the rendered page" },
  { id: "read",     label: "Read structure and copy" },
  { id: "encode",   label: "Encode cortical response" },
  { id: "forecast", label: "Forecast click behaviour" },
];

const SAMPLES = ["linear.app", "stripe.com", "vercel.com", "notion.so"];

export default function Demo({ signedIn }: { signedIn: boolean }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<Record<StepId, StepState>>({ capture: "idle", read: "idle", encode: "idle", forecast: "idle" });
  const [timing, setTiming] = useState<Partial<Record<StepId, number>>>({});
  const [err, setErr] = useState<string | null>(null);
  const [runs, setRuns] = useState<DemoRun[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const run = useCallback(async () => {
    const target = url.trim();
    if (!target || busy) return;
    setBusy(true); setErr(null);
    setSteps({ capture: "run", read: "run", encode: "idle", forecast: "idle" });
    setTiming({});
    const t0 = performance.now();

    try {
      const shotSrc = `/api/shot?url=${encodeURIComponent(target)}&w=1280`;
      const tc = performance.now();
      const [visionRes, pageRes] = await Promise.allSettled([
        analyzeImage(shotSrc, 12),
        fetch(`/api/page?url=${encodeURIComponent(target)}`).then(async (r) => {
          const j = await r.json();
          if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
          return j as PageFeatures;
        }),
      ]);

      if (visionRes.status === "rejected")
        throw new Error(`Could not capture ${target} — ${visionRes.reason?.message ?? "the renderer returned nothing"}.`);
      if (pageRes.status === "rejected")
        throw new Error(`Could not read ${target} — ${pageRes.reason?.message ?? "unreachable"}.`);

      const { bands, focus } = visionRes.value;
      const page = pageRes.value;

      const q = captureQuality(bands);
      if (!q.ok) throw new Error(`Capture of ${target} is not measurable — ${q.reason}.`);

      const tCap = Math.round(performance.now() - tc);
      setSteps((s) => ({ ...s, capture: "done", read: "done", encode: "run" }));
      setTiming((t) => ({ ...t, capture: tCap, read: page.fetchMs }));

      const te = performance.now();
      const enc = encode(bands, page, focus);
      setSteps((s) => ({ ...s, encode: "done", forecast: "run" }));
      setTiming((t) => ({ ...t, encode: Math.round(performance.now() - te) }));

      const tf = performance.now();
      const fc = forecast(enc, page);
      setSteps((s) => ({ ...s, forecast: "done" }));
      setTiming((t) => ({ ...t, forecast: Math.round(performance.now() - tf) }));

      let host = target;
      try { host = new URL(page.finalUrl).host.replace(/^www\./, ""); } catch { /* keep raw */ }

      const r: DemoRun = {
        id: `${Date.now()}`, url: page.finalUrl, host, page, bands, enc, fc, shotSrc,
        at: Date.now(), ms: Math.round(performance.now() - t0),
      };
      setRuns((p) => [r, ...p].slice(0, 20));
      setActive(r.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "The run failed.");
      setSteps((s) => {
        const n = { ...s };
        (Object.keys(n) as StepId[]).forEach((k) => { if (n[k] === "run") n[k] = "fail"; });
        return n;
      });
    } finally { setBusy(false); }
  }, [url, busy]);

  const cur = runs.find((r) => r.id === active) ?? null;

  return (
    <>
      <section className="band band--hero">
        <div className="grid-lines" aria-hidden><i /><i /><i /></div>
        <div className="wrap">
          <p className="eyebrow">Neural pre-flight</p>
          <h1 className="mega">
            See the click <span className="serif">before</span><br />you ship the page.
          </h1>
          <p className="mono-copy">
            Precog measures the real pixels and the real copy of a landing page,
            encodes a predicted cortical response across six networks, and forecasts
            click-through. Every coefficient is printed with the result.
          </p>

          <div style={{ marginTop: "clamp(28px, 4vh, 40px)" }}>
            <div className="urlbar">
              <input ref={inputRef} value={url} placeholder="your-saas.com"
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") run(); }}
                spellCheck={false} autoCapitalize="off" autoCorrect="off" />
              <button className="pill solid" onClick={run} disabled={busy || !url.trim()}>
                {busy ? "Running" : "Analyse"}<span className="cap"><Arrow /></span>
              </button>
            </div>

            <div className="microproof">
              <span><i />No account</span>
              <span><i />No card</span>
              <span><i />Nothing stored</span>
              <span><i />~1 s</span>
            </div>

            {!cur && !busy && (
              <div className="samples">
                <span className="sl">Try</span>
                {SAMPLES.map((s) => (
                  <button className="sm" key={s} onClick={() => setUrl(s)}>{s}</button>
                ))}
              </div>
            )}

            {runs.length > 0 && (
              <div className="hist">
                {runs.map((r) => (
                  <button key={r.id} className={`hchip ${r.id === active ? "on" : ""}`} onClick={() => setActive(r.id)}>
                    {r.host} <b>{r.fc.ctr.toFixed(1)}%</b>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {(busy || err) && (
        <section className="band band--tight" style={{ paddingBottom: 0 }}>
          <div className="wrap">
            <div className="plate">
              <ul className="steps">
                {STEPS.map((s) => (
                  <li key={s.id} className={steps[s.id]}>
                    <span className="d" />{s.label}
                    <span className="t">
                      {steps[s.id] === "done" && timing[s.id] != null ? `${timing[s.id]} ms` :
                       steps[s.id] === "run" ? "…" : steps[s.id] === "fail" ? "failed" : ""}
                    </span>
                  </li>
                ))}
              </ul>
              {err && <div className="err">{err}</div>}
            </div>
          </div>
        </section>
      )}

      {cur && !busy && (
        <>
          <Report key={cur.id} r={{ host: cur.host, page: cur.page, bands: cur.bands, enc: cur.enc, fc: cur.fc, ms: cur.ms, shotSrc: cur.shotSrc }} />

          {/* The one ask, and only once there is something worth keeping. */}
          <section className="band band--tight">
            <div className="grid-lines" aria-hidden><i /><i /><i /></div>
            <div className="wrap">
              <div className="empty">
                <p className="t">This run disappears when you close the tab.</p>
                <p>
                  An account keeps it, measures a second variant, and shows you the difference —
                  which is the number worth spending traffic on.
                </p>
                <Link className="btn" href={signedIn ? `/app/new?url=${encodeURIComponent(cur.url)}` : "/signup"}>
                  {signedIn ? "Save this run" : "Start free — 20 runs a month"}
                </Link>
              </div>
            </div>
          </section>
        </>
      )}
    </>
  );
}
