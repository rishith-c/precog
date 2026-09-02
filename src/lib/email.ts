import "server-only";

/* Transactional mail through Resend when a key is present, and a console
   line when it is not. The app never blocks on mail: a welcome message that
   fails to send is a log line, not a failed signup. */

export interface Mail { to: string; subject: string; text: string }

export const mailConfigured = !!process.env.RESEND_API_KEY;

export async function sendMail(m: Mail): Promise<{ sent: boolean; reason?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.info(`[mail:dry-run] to=${m.to} subject=${JSON.stringify(m.subject)}`);
    return { sent: false, reason: "RESEND_API_KEY not set" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "Precog <onboarding@resend.dev>",
        to: [m.to], subject: m.subject, text: m.text,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { sent: false, reason: `resend HTTP ${res.status}` };
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : "send failed" };
  }
}

export function welcome(name: string, origin: string): Omit<Mail, "to"> {
  return {
    subject: "Precog: your first twenty runs",
    text:
`${name || "Hello"},

You have twenty runs a month on Precog. A run renders a page in real Chrome, measures it, and forecasts the click — every coefficient printed.

Run your first page: ${origin}/app/new
Make an API key for CI:  ${origin}/app/settings
How the number is made:  ${origin}/method

Treat the percentage as a ranking between variants, not a revenue forecast. The Method page says why.

— Precog`,
  };
}
