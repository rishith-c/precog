import Link from "next/link";
import AppNav from "@/components/AppNav";
import { requireUser } from "@/lib/auth";
import { signOut } from "@/app/actions";
import { quota } from "@/lib/db";

/* The gate. Every /app page renders under this, so there is exactly one
   place that decides whether you are allowed in. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const q = quota(user);

  return (
    <>
      <header className="appbar">
        <div className="appbar-in">
          <Link href="/app" className="wordmark">Precog<sup>®</sup></Link>
          <AppNav />
          <div className="right">
            <span className="who">{q.used}/{q.limit} runs · {user.email}</span>
            <form action={signOut}>
              <button className="btn btn--ghost btn--sm">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </>
  );
}
