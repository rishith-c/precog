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
      mail: mailConfigured,
      payments: !!process.env.STRIPE_SECRET_KEY,
      time: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
