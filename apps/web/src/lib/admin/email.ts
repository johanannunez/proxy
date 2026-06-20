import "server-only";

const FROM = "Proxy <hello@myproxyhost.com>";

/**
 * Sends a single transactional email via Resend.
 *
 * Shared helper so invite / notification flows do not each re-implement the
 * fetch (the same shape currently lives inline in the inbox, meetings, and
 * reserve send paths). Returns { ok: false } instead of throwing so callers can
 * degrade gracefully when RESEND_API_KEY is absent or Resend errors.
 */
export async function sendViaResend(args: {
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
}): Promise<{ ok: boolean; resendId?: string; error?: string }> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.warn("[email] RESEND_API_KEY not set, skipping email");
    return { ok: false, error: "RESEND_API_KEY not set" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: args.to,
        cc: args.cc && args.cc.length > 0 ? args.cc : undefined,
        subject: args.subject,
        html: args.html,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[email] Resend error:", text);
      return { ok: false, error: text };
    }

    const data = await res.json();
    return { ok: true, resendId: data.id };
  } catch (err) {
    console.error("[email] Resend send failed:", err);
    return { ok: false, error: String(err) };
  }
}
