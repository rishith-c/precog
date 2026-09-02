import Rail from "@/components/Rail";
import { storeKind } from "@/lib/store";

export const metadata = { title: "Privacy — Precog" };

/* Written for what the app actually does, not adapted from a template.
   Every sentence below is checkable against the source. */
export default function Privacy() {
  const where =
    storeKind === "blob" ? "a private Vercel Blob store readable only by this deployment" :
    storeKind === "fs"   ? "the local filesystem of the machine running this instance" :
                           "nowhere — this deployment has no durable store, so no account can be created";
  return (
    <>
      <Rail />
      <section className="band band--hero">
        <div className="grid-lines" aria-hidden><i /><i /><i /></div>
        <div className="wrap">
          <p className="eyebrow">Privacy</p>
          <h1 className="mega mega--sec" style={{ maxWidth: "22ch" }}>What Precog keeps, and what it never sees.</h1>
          <div className="prose" style={{ marginTop: 28 }}>
            <p><b>Without an account</b>, a run on the landing page sends the URL you typed to this server, which fetches that page and renders it through a screenshot service (microlink.io, with thum.io as a fallback). Those services receive the URL, nothing about you. The result is computed and returned; nothing is stored.</p>
            <p><b>With an account</b>, Precog keeps: your email, your name, a scrypt hash of your password (never the password), the goal you chose at signup, a per-month run counter, and each saved run — the URL, the measured statistics, the forecast, and the PNG frame that was measured. API keys are stored only as SHA-256 hashes; the key itself is shown once and cannot be recovered. An audit log records sign-ins, keys made and revoked, runs and shares, so you can see what happened on your account.</p>
            <p><b>Where it lives:</b> {where}.</p>
            <p><b>Who else sees it:</b> no one. There is no analytics vendor receiving your runs, no data broker, no advertising. Vercel hosts the deployment and Vercel Analytics counts page views without cookies or personal identifiers. If a payment processor is connected in future, it will hold your card — Precog never will.</p>
            <p><b>Sharing</b> is opt-in per run. A share link exposes that one report to anyone holding the link until you revoke it.</p>
            <p><b>Deleting:</b> a run, a project, or the whole account can be deleted from inside the app. Deleting the account removes every run, capture, key, share, audit entry and the account record itself.</p>
            <p><b>Cookies:</b> one, <code>precog_session</code>, HttpOnly, signed, thirty days. It holds your user id and an expiry and nothing else.</p>
            <p><b>Contact:</b> open an issue on the <a href="https://github.com/rishith-c/precog">source repository</a>.</p>
          </div>
        </div>
      </section>
    </>
  );
}
