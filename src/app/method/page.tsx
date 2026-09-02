import Link from "next/link";
import Rail from "@/components/Rail";
import { PRIORS } from "@/lib/forecast";

export const metadata = { title: "Method — Precog" };

export default function MethodPage() {
  return (
    <>
      <Rail />
      <main>

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
              <b>Is TRIBE enough?</b> No. It predicts fMRI, not behaviour, and the published
              neural-to-outcome effect sizes are modest. It was trained on people passively
              watching films at one sample a second; a landing page is scanned by someone with
              a goal, at saccade speed. So the attention network here is not fMRI-shaped at all —
              it is a bottom-up <b>saliency map</b> in the Itti–Koch–Niebur form (centre–surround
              on intensity, colour opponency and orientation) under a top-and-left reading prior
              from web eye-tracking, divided by competition. That is the part of this model with
              the best-replicated grounding, and it is the part that decides whether the action
              is seen at all.
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
            <div className="wrap">
          <footer className="foot">
            <span>Precog</span>
            <Link href="/pricing">Pricing</Link>
            <Link href="/docs">API</Link>
            <span className="sp">TRIBE v2 © Meta Platforms · CC-BY-NC 4.0</span>
          </footer>
        </div>
      </main>
    </>
  );
}
