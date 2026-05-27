import "server-only";

import { normalizePhone } from "@/lib/admin/normalize-phone";

function plainTextFromHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function smsTextFromHtml(html: string): string {
  const suffix = " - Parcel";
  const maxLength = 155 - suffix.length;
  const text = plainTextFromHtml(html).replace(/\s+/g, " ").trim();
  const trimmed = text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
  return `${trimmed}${suffix}`;
}

export async function sendOpenPhoneSms(args: {
  to: string;
  bodyHtml: string;
}): Promise<
  | { ok: true; normalizedTo: string; providerMessageId?: string }
  | { ok: false; error: string; normalizedTo?: string }
> {
  const key = process.env.OPENPHONE_API_KEY;
  const from = process.env.OPENPHONE_PHONE_NUMBER;
  const normalizedTo = normalizePhone(args.to);

  if (!normalizedTo.startsWith("+")) {
    return { ok: false, error: "Owner phone number is not a valid SMS destination.", normalizedTo };
  }

  if (!key || !from) {
    return { ok: false, error: "SMS delivery is not configured.", normalizedTo };
  }

  const response = await fetch("https://api.openphone.com/v1/messages", {
    method: "POST",
    headers: {
      Authorization: key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [normalizedTo],
      content: smsTextFromHtml(args.bodyHtml),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    return { ok: false, error: text || "OpenPhone rejected the SMS.", normalizedTo };
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  return {
    ok: true,
    normalizedTo,
    providerMessageId: extractProviderMessageId(payload),
  };
}

function extractProviderMessageId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const record = payload as Record<string, unknown>;
  if (typeof record.id === "string") return record.id;
  if (record.data && typeof record.data === "object") {
    const data = record.data as Record<string, unknown>;
    if (typeof data.id === "string") return data.id;
  }
  return undefined;
}
