/**
 * Canonical document status model — the single status vocabulary shared by the
 * admin views and the owner workspace. Replaces the three divergent vocabularies
 * that previously lived in the workspace tab (needed/requested/ready/...),
 * the global hub (completed/pending/not_sent), and the portal (pending/signed/...).
 *
 * Client-safe: no server-only imports. Import from anywhere.
 */

/** Stored lifecycle statuses (persisted on documents.status). */
export const DOCUMENT_STATUSES = [
  "needed", // not started; the owner must act
  "sent", // signature sent; awaiting an owner-side signature
  "signed", // at least one owner signer done, others/countersign still pending
  "awaiting_countersignature", // all owner signers done; admin must countersign
  "submitted", // uploaded / filled; awaiting admin review
  "under_review", // admin actively reviewing
  "on_file", // complete: fully executed signature, or reviewed-and-accepted upload/form
  "action_required", // rejected / needs fix / renewal needed
  "expired", // past expiration
] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

/**
 * `locked` is a *derived* display state (prerequisites in the gate chain are not
 * yet met). It is never stored — the reader computes it from the gate config.
 */
export type DocumentDisplayStatus = DocumentStatus | "locked";

export type DocumentLane = "action" | "signature" | "filed";

export const STATUS_LABELS: Record<DocumentDisplayStatus, string> = {
  needed: "Needed",
  sent: "Awaiting signature",
  signed: "Signed",
  awaiting_countersignature: "Awaiting our signature",
  submitted: "Submitted",
  under_review: "Under review",
  on_file: "On file",
  action_required: "Action required",
  expired: "Expired",
  locked: "Locked",
};

/** Owner-facing short copy, friendlier than the admin label where it differs. */
export const STATUS_LABELS_OWNER: Record<DocumentDisplayStatus, string> = {
  ...STATUS_LABELS,
  sent: "Ready to sign",
  awaiting_countersignature: "With Proxy for signature",
  submitted: "Submitted — under review",
  under_review: "Under review",
};

const LANE_BY_STATUS: Record<DocumentDisplayStatus, DocumentLane> = {
  needed: "action",
  action_required: "action",
  expired: "action",
  locked: "action",
  sent: "signature",
  signed: "signature",
  awaiting_countersignature: "signature",
  submitted: "filed",
  under_review: "filed",
  on_file: "filed",
};

export function laneFor(status: DocumentDisplayStatus): DocumentLane {
  return LANE_BY_STATUS[status];
}

/** Terminal complete state. */
export function isComplete(status: DocumentDisplayStatus): boolean {
  return status === "on_file";
}

/** The owner has something to do (excludes signature, handled per-signer). */
export function isOwnerActionable(status: DocumentDisplayStatus): boolean {
  return status === "needed" || status === "action_required" || status === "expired";
}

/** In the e-signature flow (any party still to sign, including countersign). */
export function isInSignatureFlow(status: DocumentDisplayStatus): boolean {
  return status === "sent" || status === "signed" || status === "awaiting_countersignature";
}

function isDocumentStatus(value: string): value is DocumentStatus {
  return (DOCUMENT_STATUSES as readonly string[]).includes(value);
}

/**
 * Normalize legacy/free-text status strings into the canonical vocabulary so the
 * spine reader is resilient to historical rows (pending/uploaded/completed/etc).
 */
export function normalizeStatus(raw: string | null | undefined): DocumentStatus {
  if (!raw) return "needed";
  const value = raw.toLowerCase().trim();
  if (isDocumentStatus(value)) return value;
  switch (value) {
    case "pending":
    case "not_sent":
    case "open":
    case "incomplete":
      return "needed";
    case "uploaded":
      return "submitted";
    case "in_review":
    case "reviewing":
      return "under_review";
    case "completed":
    case "complete":
    case "approved":
    case "verified":
    case "ready":
      return "on_file";
    case "rejected":
    case "declined":
      return "action_required";
    case "expiring":
      return "action_required";
    default:
      return "needed";
  }
}
