import { timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  applyDocuSealEvent,
  type DocuSealApplyResult,
  type DocuSealEvent,
} from "@/lib/documents/signing";
import { activateWorkspaceAuthority } from "@/lib/workspace/decision-authority";
import { captureServerEvent } from "@/lib/analytics";

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

  let applyResult: DocuSealApplyResult = { signed: null };
  try {
    applyResult = await applyDocuSealEvent(event);
    if (payload.event_type === "submission.completed" && submissionId !== null) {
      await activateWorkspaceAuthority(
        String(submissionId),
        event.completedAt ?? new Date().toISOString(),
      );
    }
  } catch (err) {
    console.error("[docuseal-webhook] apply failed:", err instanceof Error ? err.message : err);
    // 200 so DocuSeal doesn't hammer retries on a transient app error we've logged.
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  // Activation-funnel signals (M3). Emitted after the signing work commits, so a
  // PostHog hiccup can never affect the webhook result. captureServerEvent is
  // best-effort and never throws. distinct_id prefers the signer's profile id;
  // the countersigner row has none, so it falls back to a stable identifier.
  const signed = applyResult.signed;
  if (signed) {
    const distinctId =
      signed.signerProfileId ??
      signed.signerEmail ??
      (signed.agencyId ? `agency:${signed.agencyId}` : "");
    const groups = signed.agencyId ? { agency: signed.agencyId } : undefined;
    await captureServerEvent(
      distinctId,
      "document_signed",
      { agency_id: signed.agencyId, document_id: signed.documentId },
      groups,
    );
    if (signed.isAgencyFirstSign) {
      await captureServerEvent(
        distinctId,
        "first_sign",
        { agency_id: signed.agencyId, document_id: signed.documentId },
        groups,
      );
    }
  }

  return NextResponse.json({ ok: true });
}
