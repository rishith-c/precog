import Link from "next/link";
import Rail from "@/components/Rail";
import { currentUser } from "@/lib/auth";
import { PLANS, type Plan } from "@/lib/db";

export const metadata = { title: "Pricing — Precog" };

const FEATURES: Record<Plan, string[]> = {
  free: ["20 runs a month", "Unlimited projects and saved runs", "Shareable report links", "API key and CLI"],
  pro: ["500 runs a month", "Everything in Free", "Variant comparison across projects", "Runs kept for as long as the account"],
};

export default async function Pricing() {
  const user = await currentUser();
  return (
    <>
      <Rail />
      <main>
        <section className="band band--hero">
          <div className="grid-lines" aria-hidden><i /><i /><i /></div>
          <div className="wrap">
            <p className="eyebrow">Pricing</p>
            <h1 className="mega">One number<br />you can <span className="serif">check</span>.</h1>
            <p className="mono-copy">
              A run is one page, rendered, read, encoded and forecast. Nothing else is
              metered — projects, saved runs, comparisons and share links are unlimited
              on both plans.
            </p>
          </div>
        </section>

        <section className="band band--tight">
          <div className="grid-lines" aria-hidden><i /><i /><i /></div>
          <div className="wrap">
            <div className="plans">
              {(Object.keys(PLANS) as Plan[]).map((p) => (
                <div key={p} className={`plan${p === "pro" ? " on" : ""}`}>
                  <div className="pn">{PLANS[p].label}</div>
                  <div className="pp">${PLANS[p].price}<u>/mo</u></div>
                  <p className="pb">{PLANS[p].blurb}</p>
                  <ul>{FEATURES[p].map((f) => <li key={f}>{f}</li>)}</ul>
                  <div className="foot-a">
                    <Link className="btn btn--wide" href={user ? "/app/billing" : "/signup"}>
                      {user ? "Manage plan" : p === "free" ? "Start free" : "Start on Free, switch later"}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
            <p className="fine">
              No payment processor is connected yet, so Pro is switched on from the billing
              page without a card. The run quota it grants is real and is enforced on every
              run, in the browser and through the API.
            </p>
          </div>
        </section>

        <section className="band band--tight">
          <div className="grid-lines" aria-hidden><i /><i /><i /></div>
          <div className="wrap">
            <p className="eyebrow">What a run costs Precog</p>
            <h2 className="mega mega--sec">Why it is metered at all.</h2>
            <div className="prose">
              <p>
                Every run renders the page in real headless Chrome and waits for the network
                to settle. That is the slow, expensive part — the encoding and the forecast
                are arithmetic and take milliseconds. Metering the render is the honest place
                to meter.
              </p>
            </div>
          </div>
        </section>

        <div className="wrap">
          <footer className="foot">
            <span>Precog</span>
            <Link href="/method">Method</Link>
            <Link href="/docs">API</Link>
            <span className="sp">TRIBE v2 © Meta Platforms · CC-BY-NC 4.0</span>
          </footer>
        </div>
      </main>
    </>
  );
}
