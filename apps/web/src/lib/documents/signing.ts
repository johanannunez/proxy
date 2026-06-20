import "server-only";
/**
 * Signature orchestration on top of the DocuSeal adapter. Owns:
 *   - starting a signature (create submission, persist document_signers, set spine 'sent')
 *   - resolving a signer's embedded signing URL
 *   - applying DocuSeal webhook events through the status machine:
 *       sent → (owner signs) → awaiting_countersignature → (Proxy signs) → on_file
 *
 * Engine-agnostic above the adapter: only `@/lib/signing/docuseal` knows DocuSeal.
 */
import { createServiceClient } from "@/lib/supabase/service";
import {
  createSubmission,
  isDocuSealConfigured,
  type SubmissionSubmitter,
} from "@/lib/signing/docuseal";
import {
  SIGNER_ROLE,
  COUNTERSIGNER_ROLE,
} from "@/lib/signing/signature-config";
import { WORKSPACE_DOCUMENT_DEFINITIONS, type WorkspaceDocumentKey } from "@/lib/admin/documents-hub-shared";
import { resolveTemplateId, isSignatureDocumentKey } from "@/lib/admin/document-templates";
import { GATE_STEP, DOCUMENT_LIFECYCLE } from "./lifecycle";
import { isComplete, normalizeStatus, type DocumentStatus } from "./status";
import { syncSpineForOwner } from "./spine";

type SpineDocRow = {
  id: string;
  owner_id: string;
  workspace_id: string | null;
  document_key: string | null;
  status: string;
  source_ref: string | null;
};

function countersigner(): { email: string; name: string } | null {
  const email = process.env.DOCUSEAL_COUNTERSIGNER_EMAIL;
  const name = process.env.DOCUSEAL_COUNTERSIGNER_NAME ?? "Proxy";
  return email ? { email, name } : null;
}

export type StartSignatureResult =
  | { ok: true; embedUrl: string | null; status: "ready" | "preparing" }
  | { ok: false; error: string };

/**
 * Ensure a signature submission exists for a spine document and return the
 * embedded signing URL for the given signer profile. Idempotent: reuses an
 * existing submission. Enforces the gate (prerequisites must be On file).
 */
export async function ensureSignatureSubmission(input: {
  documentId: string;
  signerProfileId: string;
}): Promise<StartSignatureResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const { data: doc } = await db
    .from("documents")
    .select("id, owner_id, workspace_id, document_key, status, source_ref")
    .eq("id", input.documentId)
    .maybeSingle();
  const spine = doc as SpineDocRow | null;
  if (!spine) return { ok: false, error: "Document not found." };
  if (input.signerProfileId !== spine.owner_id) {
    return { ok: false, error: "Not authorized to sign this document." };
  }

  const key = spine.document_key;
  if (!key || !(await isSignatureDocumentKey(key))) {
    return { ok: false, error: "This document is not signed electronically." };
  }

  // Gate: a signature can only start once earlier gate steps are On file.
  const unlocked = await isDocumentUnlocked(db, spine);
  if (!unlocked) return { ok: false, error: "Complete the earlier required steps first." };

  // Already has signers? Return the requesting signer's embed URL.
  const existing = await getSignerRow(db, spine.id, input.signerProfileId);
  if (existing?.embedded_link) {
    return { ok: true, embedUrl: existing.status === "pending" ? existing.embedded_link : null, status: "ready" };
  }

  if (!isDocuSealConfigured()) {
    return { ok: true, embedUrl: null, status: "preparing" };
  }

  const templateId = await resolveTemplateId(key);
  if (!templateId) return { ok: true, embedUrl: null, status: "preparing" };

  // Resolve the owner signer + Proxy countersigner.
  const { data: owner } = await db.from("profiles").select("id, full_name, email").eq("id", spine.owner_id).maybeSingle();
  if (!owner?.email) return { ok: false, error: "Owner email is missing." };
  const cs = countersigner();

  const submitters = [
    { role: SIGNER_ROLE, email: owner.email as string, name: (owner.full_name as string) ?? undefined, externalId: spine.owner_id },
    ...(cs ? [{ role: COUNTERSIGNER_ROLE, email: cs.email, name: cs.name }] : []),
  ];

  const submission = await createSubmission({ templateId, submitters, sendEmail: false, orderPreserved: true });
  if (!submission) return { ok: false, error: "Could not start the signing session. Try again shortly." };

  await persistSubmission(db, spine, submission.submissionId, submission.submitters, owner.id, cs?.email ?? null);

  const mine = submission.submitters.find((s) => s.email === owner.email);
  return { ok: true, embedUrl: mine?.embedUrl ?? null, status: "ready" };
}

/**
 * Send any signature template (system or custom DocuSeal template) to one
 * owner: ensures a spine catalog row, creates the DocuSeal submission with the
 * email notification on, and persists the signer rows. Powers the unified
 * Templates tab send sheet. Statuses already out for signature are guarded.
 */
export async function sendTemplateToOwner(input: {
  templateRecordId: string;
  ownerProfileId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const { data: tpl } = await db
    .from("document_templates")
    .select("id, document_key, display_name, docuseal_template_id, is_active")
    .eq("id", input.templateRecordId)
    .maybeSingle();
  const template = tpl as {
    document_key: string;
    display_name: string;
    docuseal_template_id: number | null;
    is_active: boolean;
  } | null;
  if (!template) return { ok: false, error: "Template not found." };
  if (!template.docuseal_template_id || !template.is_active) {
    return { ok: false, error: "This template is not ready to send. Finish its field layout first." };
  }
  if (!isDocuSealConfigured()) {
    return { ok: false, error: "The e-signature engine is not configured." };
  }

  const { data: ownerRow } = await db
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", input.ownerProfileId)
    .maybeSingle();
  const owner = ownerRow as { id: string; full_name: string | null; email: string | null } | null;
  if (!owner?.email) return { ok: false, error: "That recipient has no email on file." };

  // Ensure the spine catalog row for (owner, document key).
  const { data: existingRow } = await db
    .from("documents")
    .select("id, owner_id, workspace_id, document_key, status, source_ref")
    .eq("owner_id", owner.id)
    .eq("document_key", template.document_key)
    .is("form_key", null)
    .is("property_id", null)
    .maybeSingle();
  let spine = existingRow as SpineDocRow | null;

  const activeStatuses = ["sent", "signed", "awaiting_countersignature", "on_file"];
  if (spine && activeStatuses.includes(normalizeStatus(spine.status))) {
    return { ok: false, error: `${owner.full_name ?? "This recipient"} already has ${template.display_name} out for signature or on file.` };
  }

  if (!spine) {
    const { data: inserted, error: insertErr } = await db
      .from("documents")
      .insert({
        owner_id: owner.id,
        document_key: template.document_key,
        doc_type: template.document_key,
        title: template.display_name,
        scope_kind: "owner",
        visibility: "client",
        source: "manual",
        status: "needed",
      })
      .select("id, owner_id, workspace_id, document_key, status, source_ref")
      .single();
    if (insertErr || !inserted) {
      console.error("[signing] sendTemplateToOwner spine insert:", insertErr?.message);
      return { ok: false, error: "Could not create the document record." };
    }
    spine = inserted as SpineDocRow;
  }

  const cs = countersigner();
  const submitters = [
    {
      role: SIGNER_ROLE,
      email: owner.email,
      name: owner.full_name ?? undefined,
      externalId: owner.id,
    },
    ...(cs ? [{ role: COUNTERSIGNER_ROLE, email: cs.email, name: cs.name }] : []),
  ];

  const submission = await createSubmission({
    templateId: template.docuseal_template_id,
    submitters,
    sendEmail: true,
    orderPreserved: true,
  });
  if (!submission) {
    return { ok: false, error: "Could not start the signing request. Try again shortly." };
  }

  await persistSubmission(
    db,
    spine,
    submission.submissionId,
    submission.submitters,
    owner.id,
    cs?.email ?? null,
  );

  return { ok: true };
}

/** Get the embedded signing URL for a signer if they still need to sign. */
export async function getSignerEmbedUrl(documentId: string, signerProfileId: string): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;
  const row = await getSignerRow(db, documentId, signerProfileId);
  return row && row.status === "pending" ? row.embedded_link : null;
}

/* ─── Webhook application ─── */

export type DocuSealEvent = {
  eventType: string;
  submissionId: number | null;
  email: string | null;
  completedAt: string | null;
  signedPdfUrl: string | null;
};

/**
 * A document_signers row that transitioned to `signed` during this event.
 * Surfaced (not consumed here) so the webhook route can emit the activation-funnel
 * PostHog events without re-deriving the transition. `isAgencyFirstSign` is the
 * agency's first-ever completed signature, matching the console funnel's "first
 * document signed" step (a document_signers row with signed_at).
 */
export type SignedTransition = {
  agencyId: string | null;
  signerProfileId: string | null;
  signerEmail: string | null;
  documentId: string;
  isAgencyFirstSign: boolean;
};

export type DocuSealApplyResult = {
  signed: SignedTransition | null;
};

type SignerRow = {
  id: string;
  document_id: string;
  role: string;
  status: string;
  signer_email: string | null;
  signer_profile_id: string | null;
  agency_id: string | null;
};

/**
 * Apply a DocuSeal webhook event: mark the matching signer signed, then move the
 * spine document through the status machine and reconcile requests. Returns the
 * signer transition (if any) for best-effort analytics in the route.
 */
export async function applyDocuSealEvent(event: DocuSealEvent): Promise<DocuSealApplyResult> {
  if (!event.submissionId) return { signed: null };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const { data: signerRows } = await db
    .from("document_signers")
    .select("id, document_id, role, status, signer_email, signer_profile_id, agency_id")
    .eq("boldsign_document_id", String(event.submissionId));
  const signers = (signerRows ?? []) as SignerRow[];
  if (signers.length === 0) return { signed: null };

  const documentId = signers[0].document_id;

  // Visibility events: log to document_events and return — no status change.
  if (event.eventType === "form.viewed" || event.eventType === "form.started") {
    await db.from("document_events").insert({
      document_id: documentId,
      signer_email: event.email,
      event_type: event.eventType,
      occurred_at: event.completedAt ?? new Date().toISOString(),
    });
    return { signed: null };
  }

  // Expiry: move status and exit.
  if (event.eventType === "submission.expired") {
    await db.from("documents").update({ status: "expired" }).eq("id", documentId);
    return { signed: null };
  }

  // Declined: move to action_required.
  if (event.eventType === "form.declined") {
    await db.from("documents").update({ status: "action_required" }).eq("id", documentId);
    return { signed: null };
  }

  const isCompletion = event.eventType === "form.completed" || event.eventType === "submission.completed";

  // The signer row (if any) that flips to signed on THIS event. Captured so the
  // route can emit the activation-funnel events for exactly this transition.
  let signedRow: SignerRow | null = null;
  if (isCompletion && event.email) {
    const match = signers.find((s) => s.signer_email?.toLowerCase() === event.email?.toLowerCase());
    if (match && match.status !== "signed") {
      await db.from("document_signers").update({ status: "signed", signed_at: event.completedAt ?? new Date().toISOString() }).eq("id", match.id);
      match.status = "signed";
      signedRow = match;
    }
  }

  const allSigners = signers.filter((s) => s.role === "signer");
  const counter = signers.filter((s) => s.role === "countersigner");
  const allOwnerSigned = allSigners.length > 0 && allSigners.every((s) => s.status === "signed");
  const counterSigned = counter.length === 0 || counter.every((s) => s.status === "signed");
  const fullyExecuted = allOwnerSigned && counterSigned;

  const nextStatus: DocumentStatus = fullyExecuted
    ? "on_file"
    : allOwnerSigned
      ? "awaiting_countersignature"
      : "signed";

  const now = new Date().toISOString();
  // The spine row is the single signature record: status, completion timestamp,
  // and the signed PDF all live here. source_ref holds the provider submission id.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const docUpdate: Record<string, any> = { status: nextStatus };
  if (fullyExecuted) docUpdate.completed_at = now;
  if (event.signedPdfUrl) docUpdate.file_url = event.signedPdfUrl;
  await db.from("documents").update(docUpdate).eq("id", documentId);

  if (fullyExecuted) {
    const { data: docRow } = await db.from("documents").select("owner_id").eq("id", documentId).maybeSingle();
    if (docRow?.owner_id) await syncSpineForOwner(docRow.owner_id as string);
  }

  // Activation-funnel transition (M3). Analytics-only: a failure here must never
  // disturb the signing status machine above, so the first-ever lookup is
  // wrapped and the route's capture is itself best-effort.
  if (!signedRow) return { signed: null };

  let isAgencyFirstSign = false;
  try {
    if (signedRow.agency_id) {
      const { data: prior } = await db
        .from("document_signers")
        .select("id")
        .eq("agency_id", signedRow.agency_id)
        .not("signed_at", "is", null)
        .neq("id", signedRow.id)
        .limit(1);
      isAgencyFirstSign = ((prior ?? []) as unknown[]).length === 0;
    }
  } catch (err) {
    console.error("[signing] first-sign lookup failed:", err instanceof Error ? err.message : err);
  }

  return {
    signed: {
      agencyId: signedRow.agency_id,
      signerProfileId: signedRow.signer_profile_id,
      signerEmail: signedRow.signer_email,
      documentId,
      isAgencyFirstSign,
    },
  };
}

/* ─── internals ─── */

async function getSignerRow(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  documentId: string,
  signerProfileId: string,
): Promise<{ embedded_link: string | null; status: string } | null> {
  const { data } = await db
    .from("document_signers")
    .select("embedded_link, status")
    .eq("document_id", documentId)
    .eq("signer_profile_id", signerProfileId)
    .maybeSingle();
  return (data as { embedded_link: string | null; status: string } | null) ?? null;
}

async function persistSubmission(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  spine: SpineDocRow,
  submissionId: number,
  submitters: SubmissionSubmitter[],
  ownerProfileId: string,
  countersignerEmail: string | null,
): Promise<void> {
  const def = spine.document_key ? WORKSPACE_DOCUMENT_DEFINITIONS[spine.document_key as WorkspaceDocumentKey] : null;
  const now = new Date().toISOString();

  // The spine row IS the signature record: store the provider submission id in
  // source_ref, keep the catalog title, and mark the document sent.
  // Keep the existing catalog title for custom template keys (no lifecycle def).
  await db.from("documents").update({
    status: "sent",
    source: "signed_document",
    source_ref: String(submissionId),
    ...(def ? { title: def.label } : {}),
    sent_at: now,
  }).eq("id", spine.id);

  // One document_signers row per submitter.
  const rows = submitters.map((s, index) => ({
    document_id: spine.id,
    signer_profile_id: s.email && countersignerEmail && s.email.toLowerCase() === countersignerEmail.toLowerCase() ? null : ownerProfileId,
    signer_email: s.email,
    signer_name: null,
    role: countersignerEmail && s.email.toLowerCase() === countersignerEmail.toLowerCase() ? "countersigner" : "signer",
    role_index: index + 1,
    order_index: index,
    required: true,
    status: "pending",
    boldsign_document_id: String(submissionId),
    embedded_link: s.embedUrl,
    created_at: now,
    updated_at: now,
  }));
  await db.from("document_signers").insert(rows);
}

/** Gate check: every gate step below this document's step must be On file. */
async function isDocumentUnlocked(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  spine: SpineDocRow,
): Promise<boolean> {
  const key = spine.document_key as WorkspaceDocumentKey | null;
  if (!key) return true;
  const gateStep = DOCUMENT_LIFECYCLE[key].gateStep;
  if (gateStep === GATE_STEP.agreement) return true;

  const { data: docs } = await db
    .from("documents")
    .select("document_key, status")
    .eq("workspace_id", spine.workspace_id);
  const rows = (docs ?? []) as Array<{ document_key: string | null; status: string }>;
  const onFile = (k: WorkspaceDocumentKey) => {
    const matching = rows.filter((r) => r.document_key === k);
    return matching.length > 0 && matching.every((r) => isComplete(normalizeStatus(r.status)));
  };

  if (gateStep > GATE_STEP.agreement) {
    const agreements = rows.filter((r) => r.document_key === "host_rental_agreement");
    if (agreements.length > 0 && !agreements.every((r) => isComplete(normalizeStatus(r.status)))) return false;
  }
  if (gateStep > GATE_STEP.payment && !onFile("paid_onboarding_fee")) return false;
  if (gateStep > GATE_STEP.banking && !(onFile("ach_authorization") && onFile("card_authorization"))) return false;
  return true;
}
