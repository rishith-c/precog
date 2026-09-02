import { NextResponse } from "next/server";
import { storeKind } from "@/lib/store";
import { mailConfigured } from "@/lib/email";

export const runtime = "nodejs";

/* What an uptime monitor and a person debugging a deploy both want: is it
   up, which store is it on, what is configured. No secrets, no user data. */
export function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "precog",
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
      region: process.env.VERCEL_REGION ?? "local",
      store: storeKind,
      accounts: storeKind !== "none",
      /* Sessions must be signed with one key across every function instance.
         Without PRECOG_SECRET each cold instance reads the key from the store
         and one that reads before the first write lands mints its own —
         cookies then fail on the next request. Say which mode this is. */
      sessions: process.env.PRECOG_SECRET ? "env-secret" : "store-secret (set PRECOG_SECRET for multi-instance)",
      mail: mailConfigured,
      payments: !!process.env.STRIPE_SECRET_KEY,
      time: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
