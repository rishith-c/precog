import Link from "next/link";
import { redirect } from "next/navigation";
import Trend from "@/components/Trend";
import { requireUser } from "@/lib/auth";
import { listProjects, listRuns, PLANS, quota } from "@/lib/db";

export const metadata = { title: "Overview — Precog" };
export const dynamic = "force-dynamic";

const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
};

export default async function Overview() {
  const user = await requireUser();
  if (!user.goal) redirect("/app/onboarding");

  const [runs, projects] = await Promise.all([listRuns(user.id), listProjects(user.id)]);
  const q = quota(user);
  const best = runs.length ? runs.reduce((a, b) => (b.fc.ctr > a.fc.ctr ? b : a)) : null;

  return (
    <main className="page">
      <div className="page-h">
        <div>
          <h1>Overview</h1>
          <p className="page-sub">{user.goal}</p>
        </div>
        <div className="r">
          <Link className="btn" href="/app/new">Run a page</Link>
        </div>
      </div>

      <div className="tiles">
        <div className="tile">
          <div className="n">{runs.length}</div>
          <div className="l">Runs saved</div>
          <div className="d">Across {projects.length} {projects.length === 1 ? "project" : "projects"}.</div>
        </div>
        <div className="tile">
          <div className="n">{q.used}<u>/{q.limit}</u></div>
          <div className="l">Used this month</div>
          <div className="meter"><i style={{ width: `${Math.min(100, (q.used / q.limit) * 100)}%` }} /></div>
        </div>
        <div className="tile">
          <div className="n">{best ? best.fc.ctr.toFixed(2) : "—"}<u>{best ? "%" : ""}</u></div>
          <div className="l">Best forecast</div>
          <div className="d">{best ? `${best.host}${best.label === "home" ? "" : `/${best.label}`}` : "Nothing measured yet."}</div>
        </div>
        <div className="tile">
          <div className="l" style={{ marginTop: 0 }}>Last {Math.min(runs.length, 30)} runs</div>
          <Trend points={runs.slice(0, 30).map((r) => r.fc.ctr).reverse()} />
          <div className="d">{PLANS[user.plan].label} plan.</div>
        </div>
      </div>

      <section className="sect">
        <div className="sect-h">
          <h2>Recent runs</h2>
          {runs.length > 1 && <span className="r"><Link href="/app/compare">Compare two</Link></span>}
        </div>

        {runs.length === 0 ? (
          <div className="empty">
            <p className="t">Nothing measured yet.</p>
            <p>Point Precog at a landing page and it will forecast the click before you ship it.</p>
            <Link className="btn" href="/app/new">Run your first page</Link>
          </div>
        ) : (
          <ul className="rows">
            {runs.slice(0, 12).map((r) => (
              <li key={r.id}>
                <Link className="row" href={`/app/runs/${r.id}`}>
                  <span>
                    <span className="nm">{r.host}</span>
                    <span className="mt">{r.label} · {ago(r.at)}</span>
                  </span>
                  <span className="gr">{r.fc.grade}</span>
                  <span className="sc">{r.fc.ctr.toFixed(2)}%</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {projects.length > 0 && (
        <section className="sect">
          <div className="sect-h"><h2>Projects</h2></div>
          <ul className="rows">
            {projects.map((p) => {
              const mine = runs.filter((r) => r.projectId === p.id);
              return (
                <li key={p.id}>
                  <Link className="row" href={`/app/projects/${p.id}`}>
                    <span>
                      <span className="nm">{p.name}</span>
                      <span className="mt">{mine.length} {mine.length === 1 ? "run" : "runs"}</span>
                    </span>
                    <span className="sc">
                      {mine.length ? `${(mine.reduce((s, r) => s + r.fc.ctr, 0) / mine.length).toFixed(2)}%` : "—"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
