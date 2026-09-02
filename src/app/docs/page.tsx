import Link from "next/link";
import Rail from "@/components/Rail";

export const metadata = { title: "API — Precog" };

const CURL = `curl -H "Authorization: Bearer pk_…" \\
  "https://precog-tau.vercel.app/api/v1/analyze?url=stripe.com"`;

const RESP = `{
  "id": "8ZqK2mVn4t",
  "url": "https://stripe.com/",
  "ctr": 4.33,
  "interval": [3.71, 5.05],
  "grade": "workable",
  "signals": {
    "noticeability": 0.612, "intent": 0.570,
    "friction": 0.410, "scrollDepth": 47, "recall": 0.286
  },
  "networks": { "peak": { … }, "sustained": { … } },
  "fixes": [ { "title": …, "detail": …, "liftPct": 0.9 } ],
  "derivation": [ "logit(0.042) = -3.126", … ],
  "priors": { "base": 0.042, "bNotice": 1.35, … },
  "encoder": "precog-encoder",
  "quota": { "used": 3, "limit": 20 },
  "ms": 6120
}`;

const CI = `PRECOG_KEY=pk_… npx precog-preflight https://staging.example.com
# exit 0 when the page reads strong or workable
# exit 1 when it reads weak — so it gates a deploy like a test does`;

export default function Docs() {
  return (
    <>
      <Rail />
      <main>
        <section className="band band--hero">
          <div className="grid-lines" aria-hidden><i /><i /><i /></div>
          <div className="wrap">
            <p className="eyebrow">API</p>
            <h1 className="mega">One endpoint.<br />Every <span className="serif">coefficient</span> returned.</h1>
            <p className="mono-copy">
              The API runs the same function the app does, so a scripted run and one made in
              the browser cannot produce different numbers for the same page. Runs land in
              your account and count against the same quota.
            </p>
          </div>
        </section>

        <section className="band band--tight">
          <div className="grid-lines" aria-hidden><i /><i /><i /></div>
          <div className="wrap">
            <p className="eyebrow">01 — Authenticate</p>
            <h2 className="mega mega--sec">Bearer key, made in settings.</h2>
            <div className="term">
              <div className="tb"><i /><i /><i /><span>request</span></div>
              <pre>{CURL}</pre>
            </div>
            <p className="fine">
              Make a key under <Link href="/app/settings" style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>Settings</Link>.
              It is shown once and stored only as a hash — revoking one is immediate and
              cannot be undone. Without a key the endpoint answers 401; over quota it answers 429.
            </p>
          </div>
        </section>

        <section className="band band--tight">
          <div className="grid-lines" aria-hidden><i /><i /><i /></div>
          <div className="wrap">
            <p className="eyebrow">02 — Response</p>
            <h2 className="mega mega--sec">Nothing is hidden behind a score.</h2>
            <div className="term">
              <div className="tb"><i /><i /><i /><span>200 · application/json</span></div>
              <pre>{RESP}</pre>
            </div>
            <p className="fine">
              <b>encoder</b> tells you which model produced the response. It reads
              <code> tribe-v2</code> only when Meta&apos;s weights actually answered; otherwise it
              reads <code>precog-encoder</code> and the output is TRIBE-shaped, not TRIBE.
              Read the <Link href="/method" style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>method</Link> before quoting a number.
            </p>
          </div>
        </section>

        <section className="band band--tight">
          <div className="grid-lines" aria-hidden><i /><i /><i /></div>
          <div className="wrap">
            <p className="eyebrow">03 — In CI</p>
            <h2 className="mega mega--sec">Fail the build on a weak page.</h2>
            <div className="term">
              <div className="tb"><i /><i /><i /><span>ci</span></div>
              <pre>{CI}</pre>
            </div>
            <p className="fine">
              The exit code is the point: a page that forecasts weak stops the deploy the same
              way a failing test does. Use it on staging, before the page has any traffic to
              A/B test with.
            </p>
          </div>
        </section>

        <section className="band band--tight">
          <div className="grid-lines" aria-hidden><i /><i /><i /></div>
          <div className="wrap">
            <p className="eyebrow">Errors</p>
            <h2 className="mega mega--sec">What each status means.</h2>
            <ul className="fixes">
              {[
                ["400", "The URL is not one Precog can reach — only http and https."],
                ["401", "Missing or revoked key."],
                ["422", "The capture came back with no structure in it. Precog refuses to forecast rather than analyse noise."],
                ["429", "Quota exhausted for the month."],
                ["502", "The renderer or the page itself did not answer."],
              ].map(([code, text]) => (
                <li key={code}>
                  <span className="fx-no">{code}</span>
                  <span className="fx-b"><i>{text}</i></span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div className="wrap">
          <footer className="foot">
            <span>Precog</span>
            <Link href="/method">Method</Link>
            <Link href="/pricing">Pricing</Link>
            <span className="sp">TRIBE v2 © Meta Platforms · CC-BY-NC 4.0</span>
          </footer>
        </div>
      </main>
    </>
  );
}
