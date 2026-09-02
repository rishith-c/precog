import Link from "next/link";
import Rail from "@/components/Rail";
import Demo from "@/components/Demo";
import { currentUser } from "@/lib/auth";

/* The landing page. The demo above the fold runs the whole pipeline with no
   account, because a forecast you can check in ten seconds argues better
   than a paragraph about one. */

const SPECIMENS = [
  { host: "linear.app",           ctr: "6.43", note: "Sparse layout, strong value cues. Reward peaks at 73, attention holds 51." },
  { host: "stripe.com",           ctr: "4.33", note: "Dense and highly legible, but reward only reaches 57 against friction 41." },
  { host: "news.ycombinator.com", ctr: "3.11", note: "No marketing copy anywhere. Reward bottoms out at 10." },
];

const FLOW = [
  { t: "Measure a page", d: "Point Precog at a URL. It renders it, reads the copy and forecasts the click in about a minute." },
  { t: "Measure the variant", d: "Change the hero and run it again. Both runs land in the same project, labelled." },
  { t: "Read the difference", d: "The compare view puts the two side by side and states which one is worth the traffic." },
  { t: "Gate the deploy", d: "Put the CLI in CI. A page that forecasts weak fails the build the way a test does." },
];

export default async function Page() {
  const user = await currentUser();

  return (
    <>
      <Rail />
      <main>
        <Demo signedIn={!!user} />

        <section className="band band--tight">
          <div className="grid-lines" aria-hidden><i /><i /><i /></div>
          <div className="wrap">
            <p className="eyebrow">Measured runs</p>
            <h2 className="mega mega--sec">Three pages, measured the same way.</h2>
            <div className="plate">
              <div className="plate-h">Encoder v1 · 12 bands · 24 s at 1 Hz<span className="r">Reproducible — type any of them above</span></div>
              <ul className="fixes">
                {SPECIMENS.map((r, i) => (
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

        <section className="band band--tight">
          <div className="grid-lines" aria-hidden><i /><i /><i /></div>
          <div className="wrap">
            <p className="eyebrow">How it is used</p>
            <h2 className="mega mega--sec">The step before the A/B test.</h2>
            <ul className="fixes">
              {FLOW.map((f, i) => (
                <li key={f.t}>
                  <span className="fx-no">{String(i + 1).padStart(2, "0")}</span>
                  <span className="fx-b"><b>{f.t}</b><i>{f.d}</i></span>
                </li>
              ))}
            </ul>
            <p className="fine">
              You cannot A/B test a page you have not built, and you cannot get traffic for a
              variant you have not shipped. Precog ranks the variants so you only spend traffic
              on the two worth testing.
            </p>
            <div style={{ marginTop: 28, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link className="btn" href={user ? "/app" : "/signup"}>
                {user ? "Open the app" : "Start free — 20 runs a month"}
              </Link>
              <Link className="btn btn--ghost" href="/pricing">Pricing</Link>
            </div>
          </div>
        </section>

        <div className="wrap">
          <footer className="foot">
            <span>Precog</span>
            <Link href="/method">Method</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/docs">API</Link>
            <a href="https://github.com/rishith-c/precog" target="_blank" rel="noreferrer">Source</a>
            <a href="https://arxiv.org/abs/2507.22229" target="_blank" rel="noreferrer">TRIBE paper</a>
            <span className="sp">TRIBE v2 © Meta Platforms · CC-BY-NC 4.0</span>
          </footer>
        </div>
      </main>
    </>
  );
}
