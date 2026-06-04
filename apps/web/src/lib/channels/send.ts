import "server-only";

/**
 * Canonical channel senders for outbound communication (email + SMS).
 *
 * These wrap the Resend and OpenPhone HTTP APIs and are intentionally
 * best-effort: they never throw, returning a typed result instead so
 * callers can record per-channel delivery status. Shared by the
 * workspace Communication suite and the meeting notification flow.
 */

const DEFAULT_EMAIL_FROM = '"The Parcel Company" <hello@theparcelco.com>';

export type ChannelResult = {
  ok: boolean;
  /** Provider message id (Resend / OpenPhone), when available. */
  externalId?: string;
  error?: string;
};

// ---------------------------------------------------------------------------
// Phone helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a US phone number to E.164 (+15095551234).
 * Returns null when the input cannot be parsed to a 10/11-digit number,
 * so callers can skip the SMS channel cleanly.
 */
export function normalizePhoneE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (raw.trim().startsWith("+") && digits.length >= 10) return `+${digits}`;
  return null;
}

/**
 * Trim a body to a single SMS segment, leaving room for a " - Parcel"
 * suffix so the message stays under the 160-char GSM segment limit.
 */
export function smsText(body: string): string {
  const suffix = " - Parcel";
  const max = 155 - suffix.length;
  const clean = body.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  const trimmed = clean.length > max ? clean.slice(0, max - 1) + "…" : clean;
  return trimmed + suffix;
}

// ---------------------------------------------------------------------------
// Email (Resend)
// ---------------------------------------------------------------------------

export async function sendEmailChannel(args: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}): Promise<ChannelResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "RESEND_API_KEY not set" };
  if (!args.to) return { ok: false, error: "Missing recipient email" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: args.from ?? DEFAULT_EMAIL_FROM,
        to: args.to,
        subject: args.subject,
        html: args.html,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: text || `Resend ${res.status}` };
    }

    const json = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, externalId: json.id };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ---------------------------------------------------------------------------
// SMS (OpenPhone / Quo)
// ---------------------------------------------------------------------------

export async function sendSmsChannel(args: {
  to: string;
  content: string;
}): Promise<ChannelResult> {
  const key = process.env.OPENPHONE_API_KEY;
  const from = process.env.OPENPHONE_PHONE_NUMBER; // E.164 or PN* id
  if (!key || !from) return { ok: false, error: "OpenPhone not configured" };

  const to = normalizePhoneE164(args.to);
  if (!to) return { ok: false, error: "Invalid phone number" };

  try {
    const res = await fetch("https://api.openphone.com/v1/messages", {
      method: "POST",
      headers: {
        Authorization: key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], content: args.content }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: text || `OpenPhone ${res.status}` };
    }

    const json = (await res.json().catch(() => ({}))) as { data?: { id?: string } };
    return { ok: true, externalId: json.data?.id };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
