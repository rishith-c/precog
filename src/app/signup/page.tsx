import Link from "next/link";
import { redirect } from "next/navigation";
import Rail from "@/components/Rail";
import Form from "@/components/Form";
import { signUp } from "@/app/actions";
import { currentUser } from "@/lib/auth";
import { storeKind } from "@/lib/store";

export const metadata = { title: "Start free — Precog" };

export default async function SignUpPage() {
  if (storeKind === "none") return <NoStore what="signing up" />;
  if (await currentUser()) redirect("/app");
  return (
    <>
      <Rail />
      <main className="auth">
        <div className="auth-in">
          <h1>Start measuring.</h1>
          {/* Three fields. Every field past the third costs conversion, and
              nothing else is needed to run a page. */}
          <p className="sub">Twenty runs a month, no card. Your goal gets asked once you are inside.</p>
          <Form action={signUp} submit="Create account" pendingLabel="Creating">
            <label className="field">
              <span>Name</span>
              <input name="name" autoComplete="name" placeholder="Rishith" />
            </label>
            <label className="field">
              <span>Email</span>
              <input name="email" type="email" autoComplete="email" required placeholder="you@company.com" />
            </label>
            <label className="field">
              <span>Password</span>
              <input name="password" type="password" autoComplete="new-password" required minLength={8} placeholder="At least 8 characters" />
            </label>
          </Form>
          <p className="alt">Already have an account? <Link href="/signin">Sign in</Link>.</p>
        </div>
      </main>
    </>
  );
}

/* When Precog is deployed without a durable store, every account route would
   throw on its first read. A 500 on "Start free" tells a visitor nothing and
   looks like the product is broken rather than unconfigured, so say which it
   is — and keep the anonymous demo on the landing page, which needs no store
   at all, as the thing that still works. */
function NoStore({ what }: { what: string }) {
  return (
    <>
      <Rail />
      <main className="auth">
        <div className="auth-in">
          <h1>Accounts are not switched on.</h1>
          <p className="sub">
            This deployment has no durable store, so {what} would lose your account at the
            next cold start. Nothing is broken in the product — the operator needs to run{" "}
            <code>vercel blob store add precog</code> and redeploy.
          </p>
          <p className="alt">
            The <Link href="/">landing page</Link> runs a full analysis with no account at all,
            and the <Link href="/method">method</Link> is public either way.
          </p>
        </div>
      </main>
    </>
  );
}
