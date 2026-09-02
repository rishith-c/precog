"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  checkCredentials, currentUser, endSession, hashPassword, requireUser,
  startSession, verifyPassword,
} from "@/lib/auth";
import {
  countRun, createApiKey, createProject, createShare, createUser, deleteProject,
  deleteRun, getUserByEmail, id, listRuns, projectForHost, putCapture, quota,
  revokeApiKey, revokeShare, saveRun, saveUser, type StoredRun,
} from "@/lib/db";
import { hostOf, runAnalysis, RunError } from "@/lib/pipeline";

/* Every mutation in the product. Kept in one file because they are all the
   same three moves — read the session, change one document, revalidate —
   and ten route handlers to say that would be nine files of ceremony. */

export type FormState = { error?: string; ok?: string } | null;

/* ── account ────────────────────────────────────────────────────────── */

export async function signUp(_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const name = String(form.get("name") ?? "").trim();

  const bad = checkCredentials(email, password);
  if (bad) return { error: bad };
  if (await getUserByEmail(email)) return { error: "There is already an account on that email." };

  const user = await createUser(email, name || email.split("@")[0], await hashPassword(password));
  await startSession(user.id);
  redirect("/app/onboarding");
}

export async function signIn(_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");

  const user = await getUserByEmail(email);
  /* One message for both halves. Saying which half was wrong tells an
     attacker which emails have accounts. */
  if (!user || !(await verifyPassword(password, user.passwordHash)))
    return { error: "That email and password do not match." };

  await startSession(user.id);
  redirect(user.goal ? "/app" : "/app/onboarding");
}

export async function signOut() {
  await endSession();
  redirect("/");
}

export async function setGoal(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  user.goal = String(form.get("goal") ?? "").trim() || "Rank landing page variants";
  await saveUser(user);
  redirect("/app/new?first=1");
}

export async function setPlan(plan: "free" | "pro") {
  const user = await requireUser();
  user.plan = plan;
  await saveUser(user);
  revalidatePath("/app/billing");
}

/* ── runs ───────────────────────────────────────────────────────────── */

export async function runPage(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const target = String(form.get("url") ?? "").trim();
  const label = String(form.get("label") ?? "").trim();
  if (!target) return { error: "Give it a URL." };

  const q = quota(user);
  if (q.over)
    return { error: `You have used all ${q.limit} runs this month. Upgrade on the billing page for more.` };

  let result;
  try {
    result = await runAnalysis(target);
  } catch (e) {
    if (e instanceof RunError) return { error: e.message };
    return { error: e instanceof Error ? e.message : "The run failed." };
  }

  const host = hostOf(result.page.finalUrl);
  const project = await projectForHost(user.id, host);
  const run: StoredRun = {
    id: id(10),
    userId: user.id,
    projectId: project.id,
    label: label || new URL(result.page.finalUrl).pathname.replace(/^\/$/, "home"),
    url: result.page.finalUrl,
    host,
    at: Date.now(),
    ms: result.ms,
    page: result.page,
    bands: result.bands,
    enc: result.enc,
    fc: result.fc,
    capture: { w: result.width, h: result.height },
  };

  /* The frame is written before the run, so a saved run can never point at
     a capture that is not there. */
  await putCapture(user.id, run.id, result.png);
  await saveRun(run);
  await countRun(user);

  revalidatePath("/app");
  redirect(`/app/runs/${run.id}`);
}

export async function removeRun(runId: string) {
  const user = await requireUser();
  await deleteRun(user.id, runId);
  revalidatePath("/app");
  redirect("/app");
}

export async function shareRun(runId: string) {
  const user = await requireUser();
  await createShare(user.id, runId);
  revalidatePath(`/app/runs/${runId}`);
}

export async function unshareRun(runId: string) {
  const user = await requireUser();
  await revokeShare(user.id, runId);
  revalidatePath(`/app/runs/${runId}`);
}

/* ── projects ───────────────────────────────────────────────────────── */

export async function addProject(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { error: "Give the project a name." };
  const p = await createProject(user.id, name, name.replace(/^https?:\/\//, "").split("/")[0]);
  revalidatePath("/app");
  redirect(`/app/projects/${p.id}`);
}

export async function removeProject(projectId: string) {
  const user = await requireUser();
  await deleteProject(user.id, projectId);
  revalidatePath("/app");
  redirect("/app");
}

/* ── API keys ───────────────────────────────────────────────────────── */

/** Returns the raw key once. It is stored only as a hash, so this is the
    single moment it can ever be read. */
export async function newApiKey(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const label = String(form.get("label") ?? "").trim() || "CLI";
  const { raw } = await createApiKey(user.id, label);
  revalidatePath("/app/settings");
  return { ok: raw };
}

export async function removeApiKey(keyId: string) {
  const user = await requireUser();
  await revokeApiKey(user.id, keyId);
  revalidatePath("/app/settings");
}

/* ── used by the dashboard for the sparkline of recent scores ───────── */

export async function recentScores() {
  const user = await currentUser();
  if (!user) return [];
  return (await listRuns(user.id)).slice(0, 30).map((r) => ({ at: r.at, ctr: r.fc.ctr }));
}
