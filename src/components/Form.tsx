"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/actions";

/* Wraps a server action so a page can state its fields and its submit label
   and get pending state, inline errors and the one-time key readout for
   free. Every form in the product is this shape. */
export default function Form({
  action, submit, children, pendingLabel, wide = true,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  submit: string;
  pendingLabel?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const [state, run, pending] = useActionState(action, null);
  return (
    <form action={run} className="form">
      {state?.error && <p className="notice" role="alert">{state.error}</p>}
      {state?.ok && (
        <p className="notice notice--mono">
          Copy this now — it is stored only as a hash and cannot be shown again.
          <br /><br />{state.ok}
        </p>
      )}
      {children}
      <div>
        <button className={`btn${wide ? " btn--wide" : ""}`} disabled={pending}>
          {pending ? (pendingLabel ?? "Working") : submit}
        </button>
      </div>
    </form>
  );
}
