import Link from "next/link";
import { notFound } from "next/navigation";
import Report from "@/components/Report";
import { requireUser } from "@/lib/auth";
import { getProject, getRun, shareToken } from "@/lib/db";
import { removeRun, shareRun, unshareRun } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const run = await getRun(user.id, id);
  if (!run) notFound();

  const [project, token] = await Promise.all([
    getProject(user.id, run.projectId),
    shareToken(user.id, run.id),
  ]);

  const share = shareRun.bind(null, run.id);
  const unshare = unshareRun.bind(null, run.id);
  const drop = removeRun.bind(null, run.id);

  return (
    <main className="page">
      <div className="page-h">
        <div>
          <h1>{run.host}</h1>
          <p className="page-sub">
            {run.label} · {new Date(run.at).toLocaleString()} ·{" "}
            <a href={run.url} target="_blank" rel="noreferrer"
               style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>{run.url}</a>
            {project && <> · <Link href={`/app/projects/${project.id}`}
               style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>{project.name}</Link></>}
          </p>
        </div>
        <div className="r">
          <form action={token ? unshare : share}>
            <button className="btn btn--ghost btn--sm">{token ? "Stop sharing" : "Share"}</button>
          </form>
          <form action={drop}>
            <button className="btn btn--ghost btn--sm">Delete</button>
          </form>
        </div>
      </div>

      {token && (
        <p className="notice notice--mono">
          Anyone with this link can read the report. It carries no account and no other run.
          <br /><br />/r/{token}
        </p>
      )}

      {/* The capture is served from storage rather than re-rendered, so this
          is the frame the forecast was actually computed from. */}
      <Report
        r={{
          host: run.host, page: run.page, bands: run.bands, enc: run.enc, fc: run.fc,
          ms: run.ms, shotSrc: `/api/capture/${run.id}`,
        }}
      />
    </main>
  );
}
