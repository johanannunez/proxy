import { timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { applyDocuSealEvent, type DocuSealEvent } from "@/lib/documents/signing";

export const dynamic = "force-dynamic";

/**
 * DocuSeal webhook. Configure in DocuSeal → Settings → Webhooks pointing at
 * /api/webhooks/docuseal with events: form.completed, submission.completed.
 * Set DOCUSEAL_WEBHOOK_SECRET and configure it in DocuSeal → Settings → Webhooks
 * as the secret value (sent as x-docuseal-secret header).
 */
export async function POST(request: NextRequest) {
  const secret = process.env.DOCUSEAL_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }
  const provided = request.headers.get("x-docuseal-secret") ?? "";
  const secretBuf = Buffer.from(secret, "utf8");
  const providedBuf = Buffer.from(provided, "utf8");
  if (
    secretBuf.length !== providedBuf.length ||
    !timingSafeEqual(secretBuf, providedBuf)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: {
    event_type?: string;
    timestamp?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: Record<string, any>;
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data = payload.data ?? {};
  const submissionId =
    typeof data.submission_id === "number"
      ? data.submission_id
      : typeof data.id === "number"
        ? data.id
        : null;
  const signedPdfUrl =
    (Array.isArray(data.documents) && data.documents[0]?.url) || data.audit_log_url || null;

  const event: DocuSealEvent = {
    eventType: payload.event_type ?? "",
    submissionId,
    email: typeof data.email === "string" ? data.email : null,
    completedAt: data.completed_at ?? payload.timestamp ?? null,
    signedPdfUrl: typeof signedPdfUrl === "string" ? signedPdfUrl : null,
  };

  try {
    await applyDocuSealEvent(event);
  } catch (err) {
    console.error("[docuseal-webhook] apply failed:", err instanceof Error ? err.message : err);
    // 200 so DocuSeal doesn't hammer retries on a transient app error we've logged.
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  return NextResponse.json({ ok: true });
}
