import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { store } from "./store";
import type { Band, Encoding, Forecast, PageFeatures } from "./types";

/* ══════════════════════════════════════════════════════════════════════
   The whole data model. Five document kinds addressed by path, plus two
   indexes — one from email to user so sign-in is a single read, one from
   an API key hash to user so the CLI is too.
   ══════════════════════════════════════════════════════════════════ */

export type Plan = "free" | "pro";

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  plan: Plan;
  createdAt: number;
  /** the one routing question asked after signup, or null until answered */
  goal: string | null;
  usage: { month: string; runs: number };
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  host: string;
  createdAt: number;
}

/** A saved run keeps the frame it measured, so history means something. */
export interface StoredRun {
  id: string;
  userId: string;
  projectId: string;
  label: string;
  url: string;
  host: string;
  at: number;
  ms: number;
  page: PageFeatures;
  bands: Band[];
  enc: Encoding;
  fc: Forecast;
  capture: { w: number; h: number };
}

export interface ApiKey {
  id: string;
  userId: string;
  label: string;
  /** first 11 characters, shown in the UI; the rest is never recoverable */
  prefix: string;
  createdAt: number;
  lastUsedAt: number | null;
}

export const PLANS: Record<Plan, { label: string; runs: number; price: number; blurb: string }> = {
  free: { label: "Free", runs: 20, price: 0, blurb: "Enough to rank the variants of one page." },
  pro:  { label: "Pro",  runs: 500, price: 24, blurb: "For a team shipping pages every week." },
};

export const id = (n = 12) => randomBytes(n).toString("base64url");
const emailKey = (email: string) =>
  `index/email/${createHash("sha256").update(email.trim().toLowerCase()).digest("hex")}`;
export const hashKey = (raw: string) => createHash("sha256").update(raw).digest("hex");
export const thisMonth = () => new Date().toISOString().slice(0, 7);

/* ── users ──────────────────────────────────────────────────────────── */

export const getUser = (userId: string) => store.get<User>(`users/${userId}`);

export async function getUserByEmail(email: string) {
  const idx = await store.get<{ userId: string }>(emailKey(email));
  return idx ? getUser(idx.userId) : null;
}

export async function createUser(email: string, name: string, passwordHash: string) {
  const user: User = {
    id: id(),
    email: email.trim().toLowerCase(),
    name: name.trim(),
    passwordHash,
    plan: "free",
    createdAt: Date.now(),
    goal: null,
    usage: { month: thisMonth(), runs: 0 },
  };
  await store.put(`users/${user.id}`, user);
  await store.put(emailKey(user.email), { userId: user.id });
  return user;
}

export const saveUser = (u: User) => store.put(`users/${u.id}`, u);

/** Quota rolls over on the calendar month rather than the signup date, so
    a user can reason about it without looking anything up. */
export function quota(u: User) {
  const runs = u.usage.month === thisMonth() ? u.usage.runs : 0;
  const limit = PLANS[u.plan].runs;
  return { used: runs, limit, left: Math.max(0, limit - runs), over: runs >= limit };
}

export async function countRun(u: User) {
  const m = thisMonth();
  u.usage = u.usage.month === m ? { month: m, runs: u.usage.runs + 1 } : { month: m, runs: 1 };
  await saveUser(u);
}

/* ── projects ───────────────────────────────────────────────────────── */

export const getProject = (userId: string, projectId: string) =>
  store.get<Project>(`projects/${userId}/${projectId}`);

export async function listProjects(userId: string) {
  const keys = await store.list(`projects/${userId}`);
  const rows = await Promise.all(keys.map((k) => store.get<Project>(k)));
  return rows.filter((p): p is Project => !!p).sort((a, b) => b.createdAt - a.createdAt);
}

export async function createProject(userId: string, name: string, host: string) {
  const p: Project = { id: id(8), userId, name, host, createdAt: Date.now() };
  await store.put(`projects/${userId}/${p.id}`, p);
  return p;
}

/** One project per host, created on first sight — a user should never have
    to make a container before they can measure anything. */
export async function projectForHost(userId: string, host: string) {
  const all = await listProjects(userId);
  return all.find((p) => p.host === host) ?? (await createProject(userId, host, host));
}

export async function deleteProject(userId: string, projectId: string) {
  await store.del(`projects/${userId}/${projectId}`);
  const runs = await listRuns(userId);
  await Promise.all(
    runs.filter((r) => r.projectId === projectId).map((r) => deleteRun(userId, r.id)),
  );
}

/* ── runs ───────────────────────────────────────────────────────────── */

export const getRun = (userId: string, runId: string) =>
  store.get<StoredRun>(`runs/${userId}/${runId}`);

export async function listRuns(userId: string) {
  const keys = await store.list(`runs/${userId}`);
  const rows = await Promise.all(keys.map((k) => store.get<StoredRun>(k)));
  return rows.filter((r): r is StoredRun => !!r).sort((a, b) => b.at - a.at);
}

export const saveRun = (r: StoredRun) => store.put(`runs/${r.userId}/${r.id}`, r);

export async function deleteRun(userId: string, runId: string) {
  await store.del(`runs/${userId}/${runId}`);
  await store.del(`captures/${userId}/${runId}.png`);
}

export const putCapture = (userId: string, runId: string, png: Uint8Array) =>
  store.putBytes(`captures/${userId}/${runId}.png`, png, "image/png");

export const getCapture = (userId: string, runId: string) =>
  store.getBytes(`captures/${userId}/${runId}.png`);

/* ── share links ────────────────────────────────────────────────────── */

export interface Share { token: string; userId: string; runId: string; createdAt: number }

export const getShare = (token: string) => store.get<Share>(`shares/${token}`);

export async function createShare(userId: string, runId: string) {
  const existing = await store.get<{ token: string }>(`index/share/${userId}/${runId}`);
  if (existing) return existing.token;
  const token = id(16);
  await store.put(`shares/${token}`, { token, userId, runId, createdAt: Date.now() } satisfies Share);
  await store.put(`index/share/${userId}/${runId}`, { token });
  return token;
}

export async function revokeShare(userId: string, runId: string) {
  const existing = await store.get<{ token: string }>(`index/share/${userId}/${runId}`);
  if (!existing) return;
  await store.del(`shares/${existing.token}`);
  await store.del(`index/share/${userId}/${runId}`);
}

export const shareToken = async (userId: string, runId: string) =>
  (await store.get<{ token: string }>(`index/share/${userId}/${runId}`))?.token ?? null;

/* ── API keys ───────────────────────────────────────────────────────── */

export async function createApiKey(userId: string, label: string) {
  const raw = `pk_${id(24)}`;
  const key: ApiKey = {
    id: id(8), userId, label,
    prefix: raw.slice(0, 11),
    createdAt: Date.now(), lastUsedAt: null,
  };
  await store.put(`keys/${hashKey(raw)}`, { userId, keyId: key.id });
  await store.put(`index/keys/${userId}/${key.id}`, key);
  return { key, raw };
}

export async function listApiKeys(userId: string) {
  const keys = await store.list(`index/keys/${userId}`);
  const rows = await Promise.all(keys.map((k) => store.get<ApiKey>(k)));
  return rows.filter((k): k is ApiKey => !!k).sort((a, b) => b.createdAt - a.createdAt);
}

export async function userForApiKey(raw: string) {
  const idx = await store.get<{ userId: string; keyId: string }>(`keys/${hashKey(raw)}`);
  if (!idx) return null;
  /* The key record is the authority on whether this key is still live.
     Revoking deletes it, and the hash entry that survives points at
     nothing — so a revoked key must fail here, not authenticate. */
  const meta = await store.get<ApiKey>(`index/keys/${idx.userId}/${idx.keyId}`);
  if (!meta) return null;
  const user = await getUser(idx.userId);
  if (!user) return null;
  await store.put(`index/keys/${idx.userId}/${idx.keyId}`, { ...meta, lastUsedAt: Date.now() });
  return user;
}

/** The raw key is unrecoverable, so revoking one deletes the key record.
    The hash entry keyed by that secret is orphaned rather than found and
    removed, and userForApiKey treats a missing key record as revoked. */
export async function revokeApiKey(userId: string, keyId: string) {
  await store.del(`index/keys/${userId}/${keyId}`);
}
