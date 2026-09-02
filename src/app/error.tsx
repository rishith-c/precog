"use client";

import Link from "next/link";
import { useEffect } from "react";

/* Error boundary. The digest is what a person on the other end of a bug
   report needs — the message alone is usually a redacted stack. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("[precog]", error); }, [error]);
  return (
    <main className="auth">
      <div className="auth-in">
        <h1>Something failed.</h1>
        <p className="sub">
          {error.message || "The page could not be rendered."}
          {error.digest ? ` (ref ${error.digest})` : ""}
        </p>
        <p className="alt">
          <button onClick={reset} style={{ border: "none", background: "none", padding: 0, font: "inherit", textDecoration: "underline", cursor: "pointer" }}>Try again</button>
          {" · "}<Link href="/">Home</Link>
        </p>
      </div>
    </main>
  );
}
