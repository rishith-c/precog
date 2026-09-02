import { Sparks } from "@/components/Sparks";
import type { Band, Encoding, Forecast, PageFeatures } from "@/lib/types";

/* The report, lifted out of the landing page so the same five sections
   render for a live demo run, a saved run in the app, and a shared link.
   Three renderings of one forecast that could drift apart is three chances
   to publish a number the model did not produce. */

export interface ReportData {
  host: string;
  page: PageFeatures;
  bands: Band[];
  enc: Encoding;
  fc: Forecast;
  ms: number;
  /** where the measured frame is served from */
  shotSrc: string;
}

export function Headline({ r }: { r: ReportData }) {
  const { fc } = r;
  const lo = Math.max(0, Math.min(fc.ctrLow, fc.ctr - 0.01));
  const hi = Math.max(fc.ctrHigh, fc.ctr + 0.01);
  const ax = Math.max(hi * 1.25, 8);

  return (
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

      <Sparks enc={r.enc} />

      <div className="plate-h" style={{ borderBottom: "none", borderTop: "1px solid var(--line-2)" }}>
        {r.enc.source === "tribe-v2" ? "Meta TRIBE v2" : "Precog encoder — TRIBE-shaped, not TRIBE"}
        <span className="r">{r.bands.length} bands · {r.enc.frames.length} s at 1 Hz · {r.ms} ms</span>
      </div>
    </div>
  );
}

export default function Report({ r }: { r: ReportData }) {
  const { fc, enc, page, bands } = r;

  return (
    <div className="reveal">
      <section className="band band--tight">
        <div className="grid-lines" aria-hidden><i /><i /><i /></div>
        <div className="wrap">
          <p className="eyebrow">01 — Forecast</p>
          <h2 className="mega mega--sec">
            {r.host} reads as <span className="serif">{fc.grade}</span>.
          </h2>
          <Headline r={r} />
        </div>
      </section>

      <section className="band band--tight">
        <div className="grid-lines" aria-hidden><i /><i /><i /></div>
        <div className="wrap">
          <p className="eyebrow">02 — Attention</p>
          <h2 className="mega mega--sec">Where the eye actually goes.</h2>
          <div className="shot">
            {/* eslint-disable-next-line @next/next/no-img-element */}
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
