import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { store } from "./store";
import { getUser, type User } from "./db";

/* ══════════════════════════════════════════════════════════════════════
   AUTH — scrypt for passwords, an HMAC-signed cookie for the session.

   No provider, no redirect dance, no third-party account to create before
   the app runs. The signing secret is generated once and kept in the
   store, so a fresh deploy needs no environment variable to be correct;
   PRECOG_SECRET overrides it when you would rather hold it yourself.
   ══════════════════════════════════════════════════════════════════ */

const scrypt = promisify(_scrypt) as (p: string, s: string, k: number) => Promise<Buffer>;

const COOKIE = "precog_session";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

let cachedSecret: string | null = null;

async function secret() {
  if (process.env.PRECOG_SECRET) return process.env.PRECOG_SECRET;
  if (cachedSecret) return cachedSecret;
  const held = await store.get<{ value: string }>("config/secret");
  if (held) return (cachedSecret = held.value);
  const value = randomBytes(32).toString("hex");
  await store.put("config/secret", { value });
  return (cachedSecret = value);
}

/* ── passwords ──────────────────────────────────────────────────────── */

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, salt, hex] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hex) return false;
  const key = await scrypt(password, salt, 64);
  const known = Buffer.from(hex, "hex");
  return key.length === known.length && timingSafeEqual(key, known);
}

/* ── session cookie ─────────────────────────────────────────────────── */

async function sign(payload: string) {
  return createHmac("sha256", await secret()).update(payload).digest("base64url");
}

export async function startSession(userId: string) {
  const payload = `${userId}.${Date.now() + TTL_MS}`;
  const jar = await cookies();
  jar.set(COOKIE, `${payload}.${await sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

/** The signed-in user, or null. Every /app page and mutation calls this —
    there is no middleware doing it invisibly one layer away. */
export async function currentUser(): Promise<User | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;

  const cut = raw.lastIndexOf(".");
  if (cut < 0) return null;
  const payload = raw.slice(0, cut);
  const mac = raw.slice(cut + 1);

  const expected = await sign(payload);
  if (mac.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;

  const [userId, expiry] = payload.split(".");
  if (!userId || !expiry || Number(expiry) < Date.now()) return null;

  return getUser(userId);
}

export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/signin");
  return user;
}

/* ── validation, shared by the signup route and the form ────────────── */

export function checkCredentials(email: string, password: string) {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return "That does not look like an email address.";
  if (password.length < 8) return "Use at least 8 characters.";
  return null;
}
