import Link from "next/link";
import { currentUser } from "@/lib/auth";

/* The marketing rail. It knows whether you are signed in, so a returning
   user is never asked to sign in to a product they are already inside. */
export default async function Rail() {
  const user = await currentUser();
  return (
    <header className="rail">
      <Link href="/" className="wordmark">Precog<sup>®</sup></Link>
      <nav className="rail-links">
        <Link href="/method">Method</Link>
        <Link href="/pricing">Pricing</Link>
        <Link href="/docs">API</Link>
        {user
          ? <Link href="/app">Open app</Link>
          : <><Link href="/signin">Sign in</Link><Link href="/signup">Start free</Link></>}
      </nav>
    </header>
  );
}
