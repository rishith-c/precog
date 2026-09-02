import Form from "@/components/Form";
import { runPage } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { quota } from "@/lib/db";
import Link from "next/link";

export const metadata = { title: "New run — Precog" };
/* The renderer waits for the network to settle on a page it has never seen,
   so the action needs room past the default. */
export const maxDuration = 120;

export default async function NewRun({
  searchParams,
}: { searchParams: Promise<{ first?: string; url?: string }> }) {
  const user = await requireUser();
  const { first, url } = await searchParams;
  const q = quota(user);

  return (
    <main className="page">
      <div className="page-h">
        <div>
          <h1>{first ? "Measure your first page." : "New run."}</h1>
          <p className="page-sub">
            Precog renders the page, reads the copy, encodes a predicted cortical response
            and forecasts the click. It takes about a minute — the wait is the renderer
            waiting for the page to settle.
          </p>
        </div>
      </div>

      {q.over ? (
        <div className="empty">
          <p className="t">You have used all {q.limit} runs this month.</p>
          <p>The count resets on the first of the month.</p>
          <Link className="btn" href="/app/billing">See plans</Link>
        </div>
      ) : (
        <div style={{ maxWidth: 480 }}>
          <Form action={runPage} submit="Run it" pendingLabel="Running — about a minute">
            <label className="field">
              <span>Page URL</span>
              <input name="url" defaultValue={url} required placeholder="your-saas.com/pricing"
                spellCheck={false} autoCapitalize="off" autoCorrect="off" />
            </label>
            <label className="field">
              <span>Label <span style={{ textTransform: "none", letterSpacing: 0 }}>— optional</span></span>
              <input name="label" placeholder="hero variant B" />
              <span className="hint">
                Two runs of the same host land in one project, so a label is how you
                tell variants apart later.
              </span>
            </label>
          </Form>
          <p className="page-sub" style={{ marginTop: 18, fontSize: 13 }}>
            {q.left} of {q.limit} runs left this month.
          </p>
        </div>
      )}
    </main>
  );
}
