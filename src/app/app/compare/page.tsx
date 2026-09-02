import Link from "next/link";
import { Headline } from "@/components/Report";
import { requireUser } from "@/lib/auth";
import { listRuns, type StoredRun } from "@/lib/db";

export const metadata = { title: "Compare — Precog" };
export const dynamic = "force-dynamic";

/* The thing Precog is actually for. The absolute percentage is a literature-
   scale prior and should not be quoted as revenue; the DIFFERENCE between
   two variants measured the same way is the signal, so this page leads with
   the delta and puts the two headline numbers next to it. */

const label = (r: StoredRun) => `${r.host} · ${r.label} · ${r.fc.ctr.toFixed(2)}%`;

function Row({ k, a, b, unit = "", dp = 2 }: { k: string; a: number; b: number; unit?: string; dp?: number }) {
  const d = b - a;
  return (
    <div className="delta">
      <span className="k">{k}</span>
      <span className="a">{a.toFixed(dp)}{unit}</span>
      <span className="b">{b.toFixed(dp)}{unit}</span>
      <span className="d">{d > 0 ? "+" : d < 0 ? "−" : "±"}{Math.abs(d).toFixed(dp)}{unit}</span>
    </div>
  );
}

export default async function Compare({
  searchParams,
}: { searchParams: Promise<{ a?: string; b?: string }> }) {
  const user = await requireUser();
  const { a: aId, b: bId } = await searchParams;
  const runs = await listRuns(user.id);

  const a = runs.find((r) => r.id === aId) ?? runs[1] ?? null;
  const b = runs.find((r) => r.id === bId) ?? runs[0] ?? null;
  const ready = a && b && a.id !== b.id;

  if (runs.length < 2) {
    return (
      <main className="page">
        <div className="page-h"><h1>Compare</h1></div>
        <div className="empty">
          <p className="t">You need two runs to compare.</p>
          <p>Measure a second variant of the same page and the difference becomes readable.</p>
          <Link className="btn" href="/app/new">Run a page</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="page-h">
        <div>
          <h1>Compare</h1>
          <p className="page-sub">
            Two variants measured the same way. Read the delta, not the absolute —
            the priors are literature-scale and are not calibrated on your funnel.
          </p>
        </div>
      </div>

      <form className="form" style={{ gridTemplateColumns: "1fr 1fr auto", display: "grid", alignItems: "end", gap: 14, maxWidth: 760 }}>
        <label className="field">
          <span>Baseline</span>
          <select name="a" defaultValue={a?.id}>
            {runs.map((r) => <option key={r.id} value={r.id}>{label(r)}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Variant</span>
          <select name="b" defaultValue={b?.id}>
            {runs.map((r) => <option key={r.id} value={r.id}>{label(r)}</option>)}
          </select>
        </label>
        <button className="btn">Compare</button>
      </form>

      {!ready ? (
        <p className="notice" style={{ marginTop: 22 }}>Pick two different runs.</p>
      ) : (
        <>
          <section className="sect">
            <div className="sect-h"><h2>Difference</h2></div>
            <div className="plate">
              <div className="delta head">
                <span>Signal</span>
                <span>{a.label}</span>
                <span>{b.label}</span>
                <span>Δ</span>
              </div>
              <Row k="Predicted click-through" a={a.fc.ctr} b={b.fc.ctr} unit="%" />
              <Row k="Seen — attention gate" a={a.fc.noticeability * 100} b={b.fc.noticeability * 100} dp={0} />
              <Row k="Intent — reward drive" a={a.fc.intent * 100} b={b.fc.intent * 100} dp={0} />
              <Row k="Friction — hesitation" a={a.fc.friction * 100} b={b.fc.friction * 100} dp={0} />
              <Row k="Median scroll depth" a={a.fc.scrollDepth} b={b.fc.scrollDepth} unit="%" dp={0} />
              <Row k="24 h recall" a={a.fc.recall * 100} b={b.fc.recall * 100} dp={0} />
              <Row k="Words on the page" a={a.page.words} b={b.page.words} dp={0} />
              <Row k="Competing actions" a={a.page.ctaCount} b={b.page.ctaCount} dp={0} />
            </div>
            <p className="fine">
              {b.fc.ctr > a.fc.ctr
                ? `${b.label} is the one to test — it forecasts ${(b.fc.ctr - a.fc.ctr).toFixed(2)} points above ${a.label}.`
                : b.fc.ctr < a.fc.ctr
                  ? `${a.label} is the one to test — ${b.label} forecasts ${(a.fc.ctr - b.fc.ctr).toFixed(2)} points below it.`
                  : "The two forecast the same. Neither is worth spending traffic on over the other."}
              {" "}The intervals overlap by design; treat this as a ranking, not a measurement.
            </p>
          </section>

          <section className="sect">
            <div className="sect-h"><h2>Side by side</h2></div>
            <div className="vs">
              {[a, b].map((r) => (
                <div key={r.id}>
                  <p className="page-sub" style={{ margin: "0 0 10px", fontSize: 13.5 }}>
                    <Link href={`/app/runs/${r.id}`} style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>
                      {r.host} · {r.label}
                    </Link>
                  </p>
                  <Headline r={{ host: r.host, page: r.page, bands: r.bands, enc: r.enc, fc: r.fc, ms: r.ms, shotSrc: "" }} />
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
