import { setPlan } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { PLANS, quota, type Plan } from "@/lib/db";

export const metadata = { title: "Billing — Precog" };
export const dynamic = "force-dynamic";

const FEATURES: Record<Plan, string[]> = {
  free: ["20 runs a month", "Unlimited projects and saved runs", "Shareable report links", "API key and CLI"],
  pro: ["500 runs a month", "Everything in Free", "Variant comparison across projects", "Runs kept for as long as the account"],
};

export default async function Billing() {
  const user = await requireUser();
  const q = quota(user);

  return (
    <main className="page">
      <div className="page-h">
        <div>
          <h1>Billing</h1>
          <p className="page-sub">
            You are on {PLANS[user.plan].label}, {q.used} of {q.limit} runs used this month.
            The count resets on the first.
          </p>
        </div>
      </div>

      <div className="meter" style={{ maxWidth: 420, marginBottom: 34 }}>
        <i style={{ width: `${Math.min(100, (q.used / q.limit) * 100)}%` }} />
      </div>

      <div className="plans">
        {(Object.keys(PLANS) as Plan[]).map((p) => {
          const on = user.plan === p;
          const choose = setPlan.bind(null, p);
          return (
            <div key={p} className={`plan${on ? " on" : ""}`}>
              <div className="pn">{PLANS[p].label}{on ? " · current" : ""}</div>
              <div className="pp">${PLANS[p].price}<u>/mo</u></div>
              <p className="pb">{PLANS[p].blurb}</p>
              <ul>{FEATURES[p].map((f) => <li key={f}>{f}</li>)}</ul>
              <div className="foot-a">
                <form action={choose}>
                  <button className="btn btn--wide" disabled={on}>
                    {on ? "Current plan" : `Switch to ${PLANS[p].label}`}
                  </button>
                </form>
              </div>
            </div>
          );
        })}
      </div>

      {/* Saying this plainly is cheaper than a demo that takes a card it
          cannot charge. The quota above is real and is enforced. */}
      <p className="fine" style={{ maxWidth: "62ch" }}>
        No payment processor is connected. Switching plans here changes your run quota
        immediately and takes no card — when Precog is wired to a processor this button
        becomes a checkout and nothing else on this page changes.
      </p>
    </main>
  );
}
