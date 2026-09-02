import Link from "next/link";
import { notFound } from "next/navigation";
import Report from "@/components/Report";
import { getRun, getShare } from "@/lib/db";

export const dynamic = "force-dynamic";

/* A shared report. It carries the run and nothing else — no account, no
   other run, no way to walk from here into the workspace it came from. */
export default async function SharedReport({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const share = await getShare(token);
  if (!share) notFound();
  const run = await getRun(share.userId, share.runId);
  if (!run) notFound();

  return (
    <>
      <div className="shared">
        <span>Shared report</span>
        <span>{run.host} · {new Date(run.at).toLocaleDateString()}</span>
        <span className="sp">
          Measured by <Link href="/">Precog</Link> — <Link href="/signup">run your own page</Link>
        </span>
      </div>

      <main className="page" style={{ paddingTop: 0 }}>
        <div className="page-h" style={{ marginTop: "clamp(28px, 5vh, 52px)" }}>
          <div>
            <h1>{run.host}</h1>
            <p className="page-sub">
              {run.label} ·{" "}
              <a href={run.url} target="_blank" rel="noreferrer"
                 style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>{run.url}</a>
            </p>
          </div>
        </div>

        <Report
          r={{
            host: run.host, page: run.page, bands: run.bands, enc: run.enc, fc: run.fc,
            ms: run.ms, shotSrc: `/api/capture/${run.id}?t=${token}`,
          }}
        />
      </main>
    </>
  );
}
