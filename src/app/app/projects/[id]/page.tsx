import Link from "next/link";
import { notFound } from "next/navigation";
import Trend from "@/components/Trend";
import { requireUser } from "@/lib/auth";
import { getProject, listRuns } from "@/lib/db";
import { removeProject } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const project = await getProject(user.id, id);
  if (!project) notFound();

  const runs = (await listRuns(user.id)).filter((r) => r.projectId === id);
  const drop = removeProject.bind(null, id);
  const best = runs.length ? runs.reduce((a, b) => (b.fc.ctr > a.fc.ctr ? b : a)) : null;
  const spread = runs.length > 1
    ? Math.max(...runs.map((r) => r.fc.ctr)) - Math.min(...runs.map((r) => r.fc.ctr))
    : 0;

  return (
    <main className="page">
      <div className="page-h">
        <div>
          <h1>{project.name}</h1>
          <p className="page-sub">{runs.length} {runs.length === 1 ? "run" : "runs"} on this host.</p>
        </div>
        <div className="r">
          <Link className="btn btn--ghost btn--sm" href={`/app/new?url=${encodeURIComponent(project.host)}`}>Run again</Link>
          <form action={drop}><button className="btn btn--ghost btn--sm">Delete project</button></form>
        </div>
      </div>

      <div className="tiles">
        <div className="tile">
          <div className="n">{best ? best.fc.ctr.toFixed(2) : "—"}<u>{best ? "%" : ""}</u></div>
          <div className="l">Best variant</div>
          <div className="d">{best ? best.label : "Nothing measured yet."}</div>
        </div>
        <div className="tile">
          <div className="n">{spread ? spread.toFixed(2) : "—"}<u>{spread ? "pp" : ""}</u></div>
          <div className="l">Spread across variants</div>
          <div className="d">
            {runs.length > 1
              ? "The gap between the best and worst variant measured."
              : "Measure a second variant to get a spread."}
          </div>
        </div>
        <div className="tile">
          <div className="l" style={{ marginTop: 0 }}>Over time</div>
          <Trend points={runs.map((r) => r.fc.ctr).reverse()} />
          <div className="d">Oldest to newest.</div>
        </div>
      </div>

      <section className="sect">
        <div className="sect-h">
          <h2>Runs</h2>
          {runs.length > 1 && <span className="r"><Link href="/app/compare">Compare two</Link></span>}
        </div>
        <ul className="rows">
          {runs.map((r) => (
            <li key={r.id}>
              <Link className="row" href={`/app/runs/${r.id}`}>
                <span>
                  <span className="nm">{r.label}</span>
                  <span className="mt">{new Date(r.at).toLocaleString()}</span>
                </span>
                <span className="gr">{r.fc.grade}</span>
                <span className="sc">{r.fc.ctr.toFixed(2)}%</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
