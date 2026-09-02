import Form from "@/components/Form";
import { newApiKey, removeApiKey, setGoal } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { listApiKeys, PLANS, quota } from "@/lib/db";
import { storeKind } from "@/lib/store";

export const metadata = { title: "Settings — Precog" };
export const dynamic = "force-dynamic";

export default async function Settings() {
  const user = await requireUser();
  const [keys, q] = [await listApiKeys(user.id), quota(user)];

  return (
    <main className="page">
      <div className="page-h">
        <div>
          <h1>Settings</h1>
          <p className="page-sub">{user.email} · {PLANS[user.plan].label} plan · {q.used}/{q.limit} runs this month.</p>
        </div>
      </div>

      <section className="sect">
        <div className="sect-h"><h2>What you are here to do</h2></div>
        <div style={{ maxWidth: 480 }}>
          <Form action={setGoal} submit="Save" pendingLabel="Saving" wide={false}>
            <label className="field">
              <span>Goal</span>
              <input name="goal" defaultValue={user.goal ?? ""} />
              <span className="hint">Shown under the heading on the overview.</span>
            </label>
          </Form>
        </div>
      </section>

      <section className="sect">
        <div className="sect-h"><h2>API keys</h2></div>
        <p className="page-sub" style={{ marginTop: 0, marginBottom: 16 }}>
          A key drives <code>/api/v1/analyze</code> and the <code>preflight</code> CLI. Runs made
          with a key are saved to this account and count against the same quota.
        </p>

        <div style={{ maxWidth: 480, marginBottom: 20 }}>
          <Form action={newApiKey} submit="Create key" pendingLabel="Creating" wide={false}>
            <label className="field">
              <span>Label</span>
              <input name="label" placeholder="CI, laptop, staging" />
            </label>
          </Form>
        </div>

        {keys.length === 0 ? (
          <p className="page-sub" style={{ fontSize: 13.5 }}>No keys yet.</p>
        ) : (
          <ul className="rows">
            {keys.map((k) => {
              const drop = removeApiKey.bind(null, k.id);
              return (
                <li key={k.id}>
                  <div className="row">
                    <span>
                      <span className="nm">{k.label}</span>
                      <span className="mt">
                        {k.prefix}… · made {new Date(k.createdAt).toLocaleDateString()} ·{" "}
                        {k.lastUsedAt ? `last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : "never used"}
                      </span>
                    </span>
                    <form action={drop} style={{ marginLeft: "auto" }}>
                      <button className="btn btn--ghost btn--sm">Revoke</button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="sect">
        <div className="sect-h"><h2>Where your data lives</h2></div>
        <p className="page-sub" style={{ fontSize: 13.5 }}>
          {storeKind === "blob"
            ? "A private Vercel Blob store. Runs, captures and account records are readable only by this deployment."
            : storeKind === "fs"
              ? "The local filesystem, under .data/ — this is a development machine."
              : "Nothing is persisted: no Blob store is configured on this deployment."}
        </p>
      </section>
    </main>
  );
}
