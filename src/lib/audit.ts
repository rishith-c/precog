import "server-only";
import { store } from "./store";
import { id } from "./db";

/* Account events, append-only, one document each. The things a user asks
   "did that happen?" about: sign-ins, keys made and revoked, runs, shares.
   Written after the action succeeds, never before, so the log cannot claim
   something the store does not hold. */

export type AuditKind =
  | "signup" | "signin" | "signout"
  | "run" | "run.delete"
  | "key.create" | "key.revoke"
  | "share.create" | "share.revoke"
  | "plan.change" | "account.delete";

export interface AuditEvent {
  id: string;
  userId: string;
  at: number;
  kind: AuditKind;
  meta: Record<string, string | number | boolean | null>;
}

export async function logEvent(userId: string, kind: AuditKind, meta: AuditEvent["meta"] = {}) {
  const ev: AuditEvent = { id: id(6), userId, at: Date.now(), kind, meta };
  // zero-padded timestamp so a prefix list comes back in time order
  const key = `audit/${userId}/${String(ev.at).padStart(15, "0")}-${ev.id}`;
  try { await store.put(key, ev); } catch { /* an audit miss must never fail the action it records */ }
  return ev;
}

export async function listEvents(userId: string, n = 40): Promise<AuditEvent[]> {
  const keys = (await store.list(`audit/${userId}`)).sort().reverse().slice(0, n);
  const rows = await Promise.all(keys.map((k) => store.get<AuditEvent>(k)));
  return rows.filter((e): e is AuditEvent => !!e);
}

export async function purgeEvents(userId: string) {
  const keys = await store.list(`audit/${userId}`);
  await Promise.all(keys.map((k) => store.del(k)));
}
