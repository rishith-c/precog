"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { analyzeImage } from "@/lib/vision";
import { encode } from "@/lib/encoder";
import { forecast, PRIORS } from "@/lib/forecast";
import { Band, Encoding, Forecast, NETWORKS, NetworkId, PageFeatures } from "@/lib/types";
import { I, Mark } from "@/components/marks";

type StepId = "capture" | "read" | "encode" | "forecast";
type StepState = "idle" | "run" | "done" | "fail";

interface Run {
  id: string; url: string; host: string;
  page: PageFeatures; bands: Band[]; enc: Encoding; fc: Forecast;
  shotSrc: string; tribe?: { ok: boolean; space?: string; error?: string };
  at: number; ms: number;
}

const NET_VAR: Record<NetworkId, string> = {
  visual: "var(--net-visual)", attention: "var(--net-attention)", language: "var(--net-language)",
  reward: "var(--net-reward)", salience: "var(--net-salience)", memory: "var(--net-memory)",
};

const STEPS: { id: StepId; label: string }[] = [
  { id: "capture",  label: "Capture the rendered page" },
  { id: "read",     label: "Read structure and copy" },
  { id: "encode",   label: "Encode cortical response" },
  { id: "forecast", label: "Forecast click behaviour" },
];

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

      // capture and structure read run concurrently — neither needs the other
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
      const tCap = Math.round(performance.now() - tc);
      setSteps((s) => ({ ...s, capture: "done", read: "done", encode: "run" }));
      setTiming((t) => ({ ...t, capture: tCap, read: page.fetchMs }));

      const te = performance.now();
      const enc = encode(bands, page);
      const tEnc = Math.round(performance.now() - te);
      setSteps((s) => ({ ...s, encode: "done", forecast: "run" }));
      setTiming((t) => ({ ...t, encode: tEnc }));

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

  const SAMPLES = ["linear.app", "stripe.com", "vercel.com", "notion.so"];

  return (
    <>
      <header className="nav">
        <span className="wm">
          <span className="mark"><Mark /></span>
          <span className="name">Precog</span>
        </span>
        <nav className="links">
          <button className={`lk ${view === "run" ? "on" : ""}`} onClick={() => setView("run")}>Analyse</button>
          <button className={`lk ${view === "method" ? "on" : ""}`} onClick={() => setView("method")}>Method</button>
        </nav>
        <div className="rt">
          {cur && view === "run" && (
            <span className={`tag ${cur.fc.grade === "strong" ? "pass" : cur.fc.grade === "weak" ? "fail" : "warn"}`}>
              {cur.fc.grade}
            </span>
          )}
          <a href="https://github.com/rishith-c/precog" target="_blank" rel="noreferrer">
            <button className="ghost">GitHub</button>
          </a>
        </div>
      </header>

      <div className="wrap">
        {view === "method" ? <Method /> : (
          <>
            <section className="hero">
              <span className="kick">{I.brain} TRIBE-shaped cortical encoder</span>
              <h1>See the click <em>before</em> you ship the page.</h1>
              <p className="sub">
                Precog measures the real pixels and the real copy of a landing page,
                encodes a predicted cortical response, and forecasts click-through —
                with every coefficient printed.
              </p>

              <div className="runbar">
                <div className="urlbar">
                  <input ref={inputRef} value={url} placeholder="your-saas.com"
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") run(); }}
                    spellCheck={false} autoCapitalize="off" autoCorrect="off" />
                  <button className="primary" onClick={run} disabled={busy || !url.trim()}>
                    {busy ? "Running…" : "Analyse"}
                  </button>
                </div>
                {!cur && !busy && (
                  <div className="samples">
                    {SAMPLES.map((sx) => (
                      <button className="sm" key={sx} onClick={() => setUrl(sx)}>{sx}</button>
                    ))}
                  </div>
                )}
                {runs.length > 0 && (
                  <div className="hist">
                    {runs.map((r) => (
                      <button key={r.id} className={`hchip ${r.id === active ? "on" : ""}`}
                        onClick={() => setActive(r.id)}>
                        {r.host} <b>{r.fc.ctr.toFixed(1)}%</b>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {(busy || err) && (
              <div className="card" style={{ marginTop: 26 }}>
                <div className="steps">
                  {STEPS.map((sx) => (
                    <div key={sx.id} className={`step ${steps[sx.id]}`}>
                      <span className="sd" />{sx.label}
                      <span className="st">
                        {steps[sx.id] === "done" && timing[sx.id] != null ? `${timing[sx.id]} ms` :
                         steps[sx.id] === "run" ? "…" : steps[sx.id] === "fail" ? "failed" : ""}
                      </span>
                    </div>
                  ))}
                </div>
                {err && <div className="err">{err}</div>}
              </div>
            )}

            {cur && !busy && <Result key={cur.id} r={cur} />}

            {!cur && !busy && !err && (
              <div className="empty">
                <p>
                  Nothing is stored and nothing is sent anywhere except a request to the
                  page you name. Every number the forecast used is shown with it.
                </p>
              </div>
            )}
          </>
        )}

        <footer className="foot">
          <span>Precog · neural pre-flight</span>
          <a href="https://arxiv.org/abs/2507.22229" target="_blank" rel="noreferrer">TRIBE paper</a>
          <a href="https://ai.meta.com/blog/tribe-v2-brain-predictive-foundation-model/" target="_blank" rel="noreferrer">TRIBE v2</a>
          <button className="lk" onClick={() => setView("method")} style={{ padding: 0, height: "auto", background: "none" }}>Method</button>
          <span className="sp">TRIBE v2 © Meta, CC-BY-NC 4.0</span>
        </footer>
      </div>
    </>
  );
}

/* ====================================================================== */

function Result({ r }: { r: Run }) {
  const { fc, enc, page, bands } = r;
  const lo = Math.max(0, Math.min(fc.ctrLow, fc.ctr - 0.01));
  const hi = Math.max(fc.ctrHigh, fc.ctr + 0.01);
  const axMax = Math.max(hi * 1.25, 8);

  return (
    <div className="viewin" style={{ marginTop: 18 }}>
      {/* ---------------- HERO ---------------- */}
      <div className="card">
        <div className="rhero">
          <div className="lft">
            <div className="bignum">{fc.ctr.toFixed(2)}<span className="u">%</span></div>
            <div className="bigcap">predicted CTA click-through</div>
            <div className="ci-band">
              <div className="ci-track">
                <div className="ci-fill" style={{ left: `${(lo / axMax) * 100}%`, width: `${((hi - lo) / axMax) * 100}%` }} />
                <div className="ci-pt" style={{ left: `${(fc.ctr / axMax) * 100}%` }} />
              </div>
              <div className="ci-lbl"><span>{lo.toFixed(2)}%</span><span>{hi.toFixed(2)}%</span></div>
            </div>
            <div className="chips" style={{ padding: "12px 0 0", borderTop: "none" }}>
              <span className="chip"><i>seen</i><b>{Math.round(fc.noticeability * 100)}</b></span>
              <span className="chip"><i>intent</i><b>{Math.round(fc.intent * 100)}</b></span>
              <span className="chip"><i>friction</i><b>{Math.round(fc.friction * 100)}</b></span>
              <span className="chip"><i>scroll</i><b>{Math.round(fc.scrollDepth)}%</b></span>
              <span className="chip"><i>24h recall</i><b>{Math.round(fc.recall * 100)}%</b></span>
            </div>
          </div>

          <div className="rgt">
            <div style={{ fontSize: 12, fontFamily: "var(--mono)", letterSpacing: ".04em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 12 }}>
              Peak cortical response
            </div>
            <div className="nets">
              {NETWORKS.map((n) => (
                <div className="nrow" key={n.id} title={`${n.roi} — ${n.blurb}`}>
                  <span className="nn">{n.label}</span>
                  <span className="nt"><span className="nf" style={{ width: `${enc.peak[n.id]}%`, background: NET_VAR[n.id] }} /></span>
                  <span className="nv">{enc.peak[n.id]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Timeline enc={enc} />

        <div className="res">
          Encoder <b>{enc.source === "tribe-v2" ? "Meta TRIBE v2" : "Precog encoder (TRIBE-shaped, not TRIBE)"}</b>
          {" · "}{bands.length} bands measured{" · "}{enc.frames.length} s at 1 Hz{" · "}run in <b>{r.ms} ms</b>
        </div>
      </div>

      {/* ---------------- ATTENTION MAP ---------------- */}
      <div className="card">
        <div className="chead">
          <span className="ci">{I.eye}</span>
          <span><b>Where attention lands</b>
            <span className="sub">predicted dwell by scroll band, over the page as captured</span></span>
        </div>
        <div style={{ padding: "0 14px 14px" }}>
          <div className="shot">
            <img src={r.shotSrc} alt={`captured render of ${r.host}`} />
            {bands.map((b, i) => {
              const a = enc.bandAttention[i];
              return (
                <div key={i} className="band"
                  style={{
                    top: `${b.y0 * 100}%`, height: `${(b.y1 - b.y0) * 100}%`,
                    background: `color-mix(in srgb, var(--daisy) ${Math.round(a * 46)}%, transparent)`,
                  }}>
                  {a > 0.42 && <span className="bl">{Math.round(a * 100)}</span>}
                </div>
              );
            })}
          </div>
        </div>
        <div className="res">
          Warmer bands are predicted to hold gaze longer. Attention is <b>divided</b> across
          competing targets, so a page that is bright everywhere is bright nowhere.
        </div>
      </div>

      {/* ---------------- FIXES ---------------- */}
      {fc.fixes.length > 0 && (
        <div className="card">
          <div className="chead">
            <span className="ci">{I.wrench}</span>
            <span><b>What to change</b>
              <span className="sub">ranked by modelled lift, each re-run through the same forecast</span></span>
          </div>
          {fc.fixes.map((f, i) => (
            <div className="fix" key={i}>
              <span className="rank">{i + 1}</span>
              <span className="fb">
                <span className="fh">{f.title}</span>
                <div className="fd">{f.detail}</div>
              </span>
              <span className="fl">+{f.liftPct}%</span>
            </div>
          ))}
          <div className="res">
            Lift is computed by moving one term to a realistic target and re-evaluating the
            same equation — not asserted. Lifts are <b>not additive</b>; fix the top one first, then re-run.
          </div>
        </div>
      )}

      {/* ---------------- DERIVATION ---------------- */}
      <div className="card">
        <div className="chead">
          <span className="ci">{I.target}</span>
          <span><b>Derivation</b><span className="sub">every coefficient used, on the logit scale</span></span>
        </div>
        <div className="derive">{fc.derivation.join("\n")}</div>
        {enc.notes.length > 0 && (
          <div className="res">{enc.notes.map((n, i) => <div key={i}>· {n}</div>)}</div>
        )}
      </div>

      {/* ---------------- STIMULUS ---------------- */}
      <div className="card">
        <div className="chead">
          <span className="ci">{I.src}</span>
          <span><b>Stimulus as measured</b><span className="sub">{page.finalUrl}</span></span>
        </div>
        <div className="chips">
          <span className="chip"><i>words</i><b>{page.words}</b></span>
          <span className="chip"><i>avg word</i><b>{page.avgWordLen.toFixed(1)}</b></span>
          <span className="chip"><i>headings</i><b>{page.headings}</b></span>
          <span className="chip"><i>CTAs</i><b>{page.ctaCount}</b></span>
          <span className="chip"><i>links</i><b>{page.links}</b></span>
          <span className="chip"><i>images</i><b>{page.images}</b></span>
          <span className="chip"><i>form fields</i><b>{page.formFields}</b></span>
          <span className="chip"><i>value cues</i><b>{page.valueWords}</b></span>
          <span className="chip"><i>social proof</i><b>{page.socialProof}</b></span>
          <span className="chip"><i>urgency</i><b>{page.urgencyWords}</b></span>
          <span className="chip"><i>friction</i><b>{page.frictionWords}</b></span>
          <span className="chip"><i>jargon</i><b>{page.jargonWords}</b></span>
          <span className="chip"><i>pricing</i><b>{page.hasPricing ? "yes" : "no"}</b></span>
        </div>
        {page.ctas.length > 0 && (
          <div className="res">
            Actions found: {page.ctas.slice(0, 8).map((c, i) => (
              <span key={i}><b>{c}</b>{i < Math.min(7, page.ctas.length - 1) ? ", " : ""}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ====================================================================== */

function Timeline({ enc }: { enc: Encoding }) {
  const W = 800, H = 148, PAD = 4;
  const n = enc.frames.length;
  const x = (i: number) => PAD + (i / (n - 1)) * (W - PAD * 2);
  const y = (v: number) => H - 14 - (v / 100) * (H - 26);

  return (
    <div className="tl">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img"
        aria-label="Predicted cortical response over 24 seconds of simulated scroll">
        {[0, 25, 50, 75, 100].map((g) => (
          <line key={g} className="gl" x1={PAD} x2={W - PAD} y1={y(g)} y2={y(g)} />
        ))}
        {NETWORKS.map((net) => {
          const d = enc.frames.map((f, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(f.values[net.id]).toFixed(1)}`).join("");
          return <path key={net.id} d={d} fill="none" stroke={NET_VAR[net.id]} strokeWidth={1.8}
            strokeLinecap="round" strokeLinejoin="round" opacity={0.92} />;
        })}
        <text className="axl" x={PAD} y={H - 2}>0 s — lands</text>
        <text className="axl" x={W / 2} y={H - 2} textAnchor="middle">simulated scroll, 1 Hz</text>
        <text className="axl" x={W - PAD} y={H - 2} textAnchor="end">{n - 1} s</text>
      </svg>
      <div className="chips" style={{ padding: "10px 0 0", borderTop: "none" }}>
        {NETWORKS.map((n2) => (
          <span className="chip" key={n2.id} title={n2.roi}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: NET_VAR[n2.id], display: "inline-block" }} />
            {n2.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ====================================================================== */

function Method() {
  return (
    <div className="viewin">
      <h2>Method</h2>
      <p className="lede">What Precog measures, what it models, and what it does not know.</p>

      <div className="card">
        <div className="chead">
          <span className="ci">{I.eye}</span>
          <span><b>1 · Stimulus</b><span className="sub">measured, not inferred</span></span>
        </div>
        <div style={{ padding: "0 14px 14px" }} className="prose">
          <p>
            The page is rendered and captured, then read back off a canvas in the browser.
            Twelve horizontal bands each yield six real statistics: mean luminance, RMS
            contrast, gradient energy, chroma, count of locally salient cells, and the
            whitespace fraction. Separately the HTML is fetched and parsed for word count,
            lexical length, headings, action targets, form fields, and lexicon hits across
            value, social proof, urgency, friction and jargon.
          </p>
          <p>Nothing in this stage is a guess. These are properties of the page you gave it.</p>
        </div>
      </div>

      <div className="card">
        <div className="chead">
          <span className="ci">{I.brain}</span>
          <span><b>2 · Cortical encoding</b><span className="sub">TRIBE-shaped, and honest about it</span></span>
        </div>
        <div style={{ padding: "0 14px 14px" }} className="prose">
          <p>
            Meta&apos;s <b>TRIBE v2</b> is a foundation model that predicts whole-brain fMRI
            response to multimodal stimuli, trained on over 1,000 hours of recordings from
            700+ people. Its v1 won Algonauts 2025 against 261 other teams. It is the right
            model for this job, and Precog is built to its contract: a stimulus in, a 1 Hz
            network timecourse out, haemodynamically smoothed.
          </p>
          <p>
            <b>Precog is not running TRIBE.</b> The public weights are CC-BY-NC and the
            community GPU Spaces that wrap them fail under load — Precog tries them and
            reports the failure rather than quietly relabelling its own output. What ships
            is a TRIBE-<i>shaped</i> encoder: the same interface, six cortical networks,
            driven by the measured features above through stated coefficients.
          </p>
          <p>
            The encoder models a reader who scrolls rather than teleports, whose attention
            is a depleting resource, and for whom salient regions <b>compete</b> rather than
            sum — a page bright everywhere is bright nowhere. Response is convolved with a
            gamma haemodynamic kernel peaking near six seconds.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="chead">
          <span className="ci">{I.target}</span>
          <span><b>3 · Neuroforecast</b><span className="sub">brain-as-predictor, on the logit scale</span></span>
        </div>
        <div style={{ padding: "0 14px 14px" }} className="prose">
          <p>
            The published result Precog leans on is that neural response from a small sample
            forecasts <i>aggregate</i> behaviour better than that same sample&apos;s self-report.
            Nucleus accumbens response predicts population-level purchase and funding
            outcomes; medial prefrontal response predicts campaign response at population
            scale. Attention is a gate — an unfixated target cannot be clicked. Anterior
            insula tracks hesitation, which subtracts clicks that reward had already earned.
          </p>
          <p>Precog maps its six networks onto that structure with five stated priors:</p>
          <ul>
            <li><code>base = {PRIORS.base}</code> — mid of reported B2B SaaS hero-CTA click-through</li>
            <li><code>notice × {PRIORS.bNotice}</code> — the attention gate, dominant term</li>
            <li><code>reward × {PRIORS.bReward}</code> — NAcc to aggregate choice</li>
            <li><code>memory × {PRIORS.bMemory}</code> — encoding strength to delayed click</li>
            <li><code>language × {PRIORS.bLanguage}</code> — reading cost suppresses action</li>
            <li><code>friction × {PRIORS.bFriction}</code> — insula-tracked hesitation</li>
          </ul>
          <p>
            Every run prints these, multiplied out, in the Derivation panel. Disagree with a
            number and you can point at it.
          </p>
        </div>
      </div>

      <div className="card alert">
        <div className="chead">
          <span className="ci">!</span>
          <span><b>What this is not</b><span className="sub">read before quoting a number</span></span>
        </div>
        <div style={{ padding: "0 14px 14px" }} className="prose">
          <ul>
            <li>Not a measurement. No one&apos;s brain was scanned; nothing here is an fMRI result.</li>
            <li>Not calibrated on your funnel. The priors are literature-scale, not fitted to your traffic. Treat the absolute percentage as a <b>ranking signal between variants</b>, not a number to forecast revenue from.</li>
            <li>Not an A/B test. It is the thing you run <i>before</i> one, to decide which two variants are worth the traffic.</li>
            <li>Not TRIBE output unless the badge says <b>Meta TRIBE v2</b>.</li>
          </ul>
        </div>
      </div>

      <div className="card">
        <div className="chead">
          <span className="ci">{I.src}</span>
          <span><b>Sources</b><span className="sub">the work this stands on</span></span>
        </div>
        <div style={{ padding: "0 14px 14px" }} className="prose">
          <ul>
            <li>d&apos;Ascoli et al. — <a href="https://arxiv.org/abs/2507.22229" target="_blank" rel="noreferrer">TRIBE: TRImodal Brain Encoder for whole-brain fMRI response prediction</a>, arXiv:2507.22229</li>
            <li>Meta AI — <a href="https://ai.meta.com/blog/tribe-v2-brain-predictive-foundation-model/" target="_blank" rel="noreferrer">Introducing TRIBE v2</a>; weights at <code>facebook/tribev2</code>, CC-BY-NC 4.0</li>
            <li>Berns &amp; Moore — neural focus group predicts population-level media effects</li>
            <li>Genevsky &amp; Knutson — <a href="https://www.jneurosci.org/content/37/36/8625" target="_blank" rel="noreferrer">neuroforecasting aggregate choice</a>, J Neurosci</li>
            <li>Falk et al. — brain-as-predictor for population campaign response</li>
            <li>Algonauts 2025 — <a href="https://arxiv.org/abs/2508.10784" target="_blank" rel="noreferrer">insights from the winners</a></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
