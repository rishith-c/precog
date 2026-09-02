import Rail from "@/components/Rail";

export const metadata = { title: "Terms — Precog" };

export default function Terms() {
  return (
    <>
      <Rail />
      <section className="band band--hero">
        <div className="grid-lines" aria-hidden><i /><i /><i /></div>
        <div className="wrap">
          <p className="eyebrow">Terms</p>
          <h1 className="mega mega--sec" style={{ maxWidth: "22ch" }}>Short, because the product is.</h1>
          <div className="prose" style={{ marginTop: 28 }}>
            <p><b>What you get.</b> Precog renders a page you name, measures it, and returns a forecast with its derivation. The free plan includes twenty runs a calendar month; paid plans include more. Runs are metered because the render is the expensive part.</p>
            <p><b>What the number is.</b> The forecast is a model output, not a measurement of any person. Its priors come from published literature, not from your traffic. It is offered as a ranking signal between variants of a page. It is not a guarantee of any conversion rate and must not be relied on as one.</p>
            <p><b>Your pages.</b> Only submit URLs you are entitled to have rendered. Precog fetches pages the way a browser would and does not bypass access controls, paywalls or robots directives for you.</p>
            <p><b>Your account.</b> Keep your password and API keys to yourself; runs made with your key count against your quota. Precog may rate-limit or suspend use that degrades the service for others.</p>
            <p><b>Availability.</b> The service is provided as-is, with no uptime commitment on the free plan. Captures depend on third-party renderers and can fail; a failed capture is reported, not silently analysed, and a run that returns an error is not counted.</p>
            <p><b>Model licence.</b> The encoder is Precog&apos;s own. Meta&apos;s TRIBE v2, which shaped its interface, is © Meta Platforms under CC-BY-NC 4.0 and is not redistributed here.</p>
            <p><b>Changes.</b> These terms may change with the product; the date on this page is the version you agreed to. Continued use after a change is acceptance of it.</p>
            <p><b>Contact.</b> Issues and questions go to the <a href="https://github.com/rishith-c/precog">source repository</a>.</p>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-3)" }}>Last changed 1 September 2026.</p>
          </div>
        </div>
      </section>
    </>
  );
}
