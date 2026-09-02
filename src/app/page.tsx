"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { analyzeImage } from "@/lib/vision";
import { captureQuality } from "@/lib/bandstats";
import { encode } from "@/lib/encoder";
import { forecast, PRIORS } from "@/lib/forecast";
import { Band, Encoding, Forecast, PageFeatures } from "@/lib/types";
import { Arrow } from "@/components/marks";
import { Sparks } from "@/components/Sparks";

type StepId = "capture" | "read" | "encode" | "forecast";
type StepState = "idle" | "run" | "done" | "fail";

interface Run {
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

export default function Page() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<Record<StepId, StepState>>({ capture: "idle", read: "idle", encode: "idle", forecast: "idle" });
  const [timing, setTiming] = useState<Partial<Record<StepId, number>>>({});
  const [err, setErr] = useState<string | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [view, setView] = useState<"run" | "method">("run");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const run = useCallback(async () => {
    const target = url.trim();
    if (!target || busy) return;
    setBusy(true); setErr(null); setView("run");
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

      const { bands } = visionRes.value;
      const page = pageRes.value;

      const q = captureQuality(bands);
      if (!q.ok) throw new Error(`Capture of ${target} is not measurable — ${q.reason}.`);

      const tCap = Math.round(performance.now() - tc);
      setSteps((s) => ({ ...s, capture: "done", read: "done", encode: "run" }));
      setTiming((t) => ({ ...t, capture: tCap, read: page.fetchMs }));

      const te = performance.now();
      const enc = encode(bands, page);
      setSteps((s) => ({ ...s, encode: "done", forecast: "run" }));
      setTiming((t) => ({ ...t, encode: Math.round(performance.now() - te) }));

      const tf = performance.now();
      const fc = forecast(enc, page);
      setSteps((s) => ({ ...s, forecast: "done" }));
      setTiming((t) => ({ ...t, forecast: Math.round(performance.now() - tf) }));

      let host = target;
      try { host = new URL(page.finalUrl).host.replace(/^www\./, ""); } catch { /* keep raw */ }

      const r: Run = {
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
      <header className="rail">
        <span className="wordmark">Precog<sup>®</sup></span>
        <nav className="rail-links">
          <button className={view === "run" ? "on" : ""} onClick={() => setView("run")}>Analyse</button>
          <button className={view === "method" ? "on" : ""} onClick={() => setView("method")}>Method</button>
          <a href="https://github.com/rishith-c/precog" target="_blank" rel="noreferrer">Source</a>
        </nav>
      </header>

      {view === "method" ? <Method /> : (
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

          {cur && !busy && <Result key={cur.id} r={cur} />}
          {!cur && !busy && !err && <Specimen />}
        </>
      )}

      <div className="wrap">
        <footer className="foot">
          <span>Precog</span>
          <a href="https://github.com/rishith-c/precog" target="_blank" rel="noreferrer">Source</a>
          <a href="https://arxiv.org/abs/2507.22229" target="_blank" rel="noreferrer">TRIBE paper</a>
          <button onClick={() => setView("method")} style={{ border: "none", background: "none", padding: 0, font: "inherit", color: "inherit", cursor: "pointer", textTransform: "uppercase" }}>Method</button>
          <span className="sp">TRIBE v2 © Meta Platforms · CC-BY-NC 4.0</span>
        </footer>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════ */

function Specimen() {
  const rows = [
    { host: "linear.app",           ctr: "6.43", note: "Sparse layout, strong value cues. Reward peaks at 73, attention holds 51." },
    { host: "stripe.com",           ctr: "4.33", note: "Dense and highly legible, but reward only reaches 57 against friction 41." },
    { host: "news.ycombinator.com", ctr: "3.11", note: "No marketing copy anywhere. Reward bottoms out at 10." },
  ];
  return (
    <section className="band band--tight">
      <div className="grid-lines" aria-hidden><i /><i /><i /></div>
      <div className="wrap">
        <p className="eyebrow">Measured runs</p>
        <h2 className="mega mega--sec">Three pages, measured the same way.</h2>
        <div className="plate">
          <div className="plate-h">Encoder v1 · 12 bands · 24 s at 1 Hz<span className="r">Reproducible — click any of them above</span></div>
          <ul className="fixes">
            {rows.map((r, i) => (
              <li key={r.host}>
                <span className="fx-no">{String(i + 1).padStart(2, "0")}</span>
                <span className="fx-b"><b>{r.host}</b><i>{r.note}</i></span>
                <span className="lift">{r.ctr}%</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════ */

function Result({ r }: { r: Run }) {
  const { fc, enc, page, bands } = r;
  const lo = Math.max(0, Math.min(fc.ctrLow, fc.ctr - 0.01));
  const hi = Math.max(fc.ctrHigh, fc.ctr + 0.01);
  const ax = Math.max(hi * 1.25, 8);

  return (
    <div className="reveal">
      <section className="band band--tight">
        <div className="grid-lines" aria-hidden><i /><i /><i /></div>
        <div className="wrap">
          <p className="eyebrow">01 — Forecast</p>
          <h2 className="mega mega--sec">
            {r.host} reads as <span className="serif">{fc.grade}</span>.
          </h2>

          <div className="plate">
            <div className="plate-b">
              <div className="big">{fc.ctr.toFixed(2)}<u>%</u></div>
              <div className="big-l">Predicted CTA click-through</div>
              <div className="ci">
                <div className="ci-t">
                  <div className="ci-f" style={{ left: `${(lo / ax) * 100}%`, width: `${((hi - lo) / ax) * 100}%` }} />
                  <div className="ci-p" style={{ left: `${(fc.ctr / ax) * 100}%` }} />
                </div>
                <div className="ci-l"><span>{lo.toFixed(2)}%</span><span>{hi.toFixed(2)}%</span></div>
              </div>
            </div>

            <div className="sig">
              <div><div className="n">{Math.round(fc.noticeability * 100)}</div><div className="l">Seen</div></div>
              <div><div className="n">{Math.round(fc.intent * 100)}</div><div className="l">Intent</div></div>
              <div><div className="n">{Math.round(fc.friction * 100)}</div><div className="l">Friction</div></div>
              <div><div className="n">{Math.round(fc.scrollDepth)}%</div><div className="l">Scroll</div></div>
              <div><div className="n">{Math.round(fc.recall * 100)}%</div><div className="l">24h recall</div></div>
            </div>

            <Sparks enc={enc} />

            <div className="plate-h" style={{ borderBottom: "none", borderTop: "1px solid var(--line-2)" }}>
              {enc.source === "tribe-v2" ? "Meta TRIBE v2" : "Precog encoder — TRIBE-shaped, not TRIBE"}
              <span className="r">{bands.length} bands · {enc.frames.length} s at 1 Hz · {r.ms} ms</span>
            </div>
          </div>
        </div>
      </section>

      <section className="band band--tight">
        <div className="grid-lines" aria-hidden><i /><i /><i /></div>
        <div className="wrap">
          <p className="eyebrow">02 — Attention</p>
          <h2 className="mega mega--sec">Where the eye actually goes.</h2>
          <div className="shot">
            <img src={r.shotSrc} alt={`captured render of ${r.host}`} />
            {bands.map((b, i) => {
              const a = enc.bandAttention[i];
              return (
                <div key={i} className="bd"
                  style={{
                    top: `${b.y0 * 100}%`, height: `${(b.y1 - b.y0) * 100}%`,
                    background: `rgba(29,29,31,${(0.62 - a * 0.6).toFixed(3)})`,
                  }}>
                  {a > 0.4 && <span>{Math.round(a * 100)}</span>}
                </div>
              );
            })}
          </div>
          <p className="fine">
            Brighter bands are predicted to hold gaze longer; the page is dimmed
            everywhere it is not. Attention is divided across competing targets, so a
            page that shouts everywhere is heard nowhere.
          </p>
        </div>
      </section>

      {fc.fixes.length > 0 && (
        <section className="band band--tight">
          <div className="grid-lines" aria-hidden><i /><i /><i /></div>
          <div className="wrap">
            <p className="eyebrow">03 — What to change</p>
            <h2 className="mega mega--sec">Ranked by modelled lift.</h2>
            <ul className="fixes">
              {fc.fixes.map((f, i) => (
                <li key={i}>
                  <span className="fx-no">{String(i + 1).padStart(2, "0")}</span>
                  <span className="fx-b"><b>{f.title}</b><i>{f.detail}</i></span>
                  <span className="lift">+{f.liftPct}%</span>
                </li>
              ))}
            </ul>
            <p className="fine">
              Each lift is computed by moving one term to a realistic target and
              re-running the same equation — not asserted. Lifts are not additive:
              apply the top one, then measure again.
            </p>
          </div>
        </section>
      )}

      <section className="band band--tight">
        <div className="grid-lines" aria-hidden><i /><i /><i /></div>
        <div className="wrap">
          <p className="eyebrow">04 — Derivation</p>
          <h2 className="mega mega--sec">Every coefficient, on the logit scale.</h2>
          <div className="plate"><pre className="derive">{fc.derivation.join("\n")}</pre></div>
          {enc.notes.length > 0 && <p className="fine">{enc.notes.join(" ")}</p>}
        </div>
      </section>

      <section className="band band--tight">
        <div className="grid-lines" aria-hidden><i /><i /><i /></div>
        <div className="wrap">
          <p className="eyebrow">05 — Stimulus</p>
          <h2 className="mega mega--sec">What was measured.</h2>
          <ul className="chips">
            <li>words <b>{page.words}</b></li>
            <li>avg word <b>{page.avgWordLen.toFixed(1)}</b></li>
            <li>headings <b>{page.headings}</b></li>
            <li>actions <b>{page.ctaCount}</b></li>
            <li>links <b>{page.links}</b></li>
            <li>images <b>{page.images}</b></li>
            <li>form fields <b>{page.formFields}</b></li>
            <li>value cues <b>{page.valueWords}</b></li>
            <li>social proof <b>{page.socialProof}</b></li>
            <li>urgency <b>{page.urgencyWords}</b></li>
            <li>friction <b>{page.frictionWords}</b></li>
            <li>jargon <b>{page.jargonWords}</b></li>
            <li>pricing <b>{page.hasPricing ? "yes" : "no"}</b></li>
          </ul>
          {page.ctas.length > 0 && (
            <p className="fine">Actions found — {page.ctas.slice(0, 8).join(", ")}.</p>
          )}
        </div>
      </section>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════ */

function Method() {
  return (
    <div className="reveal">
      <section className="band band--hero">
        <div className="grid-lines" aria-hidden><i /><i /><i /></div>
        <div className="wrap">
          <p className="eyebrow">Method</p>
          <h1 className="mega">What it measures,<br />and what it <span className="serif">cannot</span> know.</h1>
        </div>
      </section>

      <section className="band band--tight">
        <div className="grid-lines" aria-hidden><i /><i /><i /></div>
        <div className="wrap">
          <p className="eyebrow">01 — Stimulus</p>
          <h2 className="mega mega--sec">Measured, not inferred.</h2>
          <div className="prose">
            <p>
              The page is rendered in real headless Chrome and read back off a canvas.
              Twelve horizontal bands each yield six statistics: mean luminance, RMS
              contrast, gradient energy, chroma, count of locally salient cells, and the
              whitespace fraction. Separately the HTML is parsed for word count, lexical
              length, headings, action targets, form fields, and lexicon hits across
              value, social proof, urgency, friction and jargon.
            </p>
            <p>
              Nothing in this stage is a guess. If the renderer returns a frame with no
              structure in it, Precog <b>refuses to forecast</b> rather than analysing noise.
            </p>
          </div>
        </div>
      </section>

      <section className="band band--tight">
        <div className="grid-lines" aria-hidden><i /><i /><i /></div>
        <div className="wrap">
          <p className="eyebrow">02 — Encoding</p>
          <h2 className="mega mega--sec">TRIBE-shaped, and honest about it.</h2>
          <div className="prose">
            <p>
              Meta&apos;s <b>TRIBE v2</b> predicts whole-brain fMRI response to multimodal
              stimuli, trained on over 1,000 hours of recordings from 700+ people; its v1
              won Algonauts 2025 against 261 other teams. Precog is built to its contract:
              stimulus in, a 1 Hz network timecourse out, haemodynamically smoothed.
            </p>
            <p>
              <b>Precog is not running TRIBE.</b> The weights are CC-BY-NC and the community
              GPU Spaces that wrap them fail under load — Precog tries them and reports the
              failure rather than quietly relabelling its own output. What ships is a
              TRIBE-<em>shaped</em> encoder: the same interface, six cortical networks,
              driven by the measured features above through stated coefficients.
            </p>
            <p>
              It models a reader who scrolls rather than teleports, whose attention is a
              depleting resource, and for whom salient regions <b>compete</b> rather than sum.
              Response is convolved with a gamma haemodynamic kernel peaking near six seconds.
            </p>
          </div>
        </div>
      </section>

      <section className="band band--tight">
        <div className="grid-lines" aria-hidden><i /><i /><i /></div>
        <div className="wrap">
          <p className="eyebrow">03 — Neuroforecast</p>
          <h2 className="mega mega--sec">Brain as predictor, on the logit scale.</h2>
          <div className="prose">
            <p>
              Neural response from a small sample forecasts <em>aggregate</em> behaviour better
              than that same sample&apos;s self-report. Nucleus accumbens response predicts
              population-level purchase and funding outcomes; medial prefrontal response
              predicts campaign response at population scale. Attention is a gate — an
              unfixated target cannot be clicked. Anterior insula tracks hesitation, which
              subtracts clicks that reward had already earned.
            </p>
            <ul>
              <li><code>base = {PRIORS.base}</code> — mid of reported B2B SaaS hero-CTA click-through</li>
              <li><code>notice × {PRIORS.bNotice}</code> — the attention gate, dominant term</li>
              <li><code>reward × {PRIORS.bReward}</code> — NAcc to aggregate choice</li>
              <li><code>memory × {PRIORS.bMemory}</code> — encoding strength to delayed click</li>
              <li><code>language × {PRIORS.bLanguage}</code> — reading cost suppresses action</li>
              <li><code>friction × {PRIORS.bFriction}</code> — insula-tracked hesitation</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="band band--tight">
        <div className="grid-lines" aria-hidden><i /><i /><i /></div>
        <div className="wrap">
          <p className="eyebrow">Limits</p>
          <h2 className="mega mega--sec">Read this before quoting a number.</h2>
          <div className="prose">
            <ul>
              <li><b>Not a measurement.</b> No one&apos;s brain was scanned. Nothing here is an fMRI result.</li>
              <li><b>Not calibrated on your funnel.</b> The priors are literature-scale. Treat the absolute percentage as a ranking signal between variants, not a revenue forecast.</li>
              <li><b>Not an A/B test.</b> It is what you run to decide which two variants deserve one.</li>
              <li><b>Not TRIBE output</b> unless the encoder line says Meta TRIBE v2.</li>
            </ul>
            <p style={{ marginTop: 18 }}>
              Sources — d&apos;Ascoli et al., <a href="https://arxiv.org/abs/2507.22229" target="_blank" rel="noreferrer">TRIBE</a> (arXiv:2507.22229);
              Meta AI, <a href="https://ai.meta.com/blog/tribe-v2-brain-predictive-foundation-model/" target="_blank" rel="noreferrer">TRIBE v2</a>;
              Berns &amp; Moore, neural focus group; Genevsky &amp; Knutson, <a href="https://www.jneurosci.org/content/37/36/8625" target="_blank" rel="noreferrer">neuroforecasting aggregate choice</a>;
              Falk et al., brain-as-predictor.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
