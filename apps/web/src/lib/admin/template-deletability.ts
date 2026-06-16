/**
 * Pure deletability rule for a signature template. No I/O: the caller gathers the
 * inputs (local send-evidence count + an optional DocuSeal submission check) and
 * this is the single source of truth for the verdict, so it can be unit-tested
 * exhaustively and both the UI gate and the server action agree on "deletable."
 *
 *   isSystem ─────────────► blocked: system templates are shared infrastructure
 *   sendEvidenceCount > 0 ─► blocked: documents already sent under this key
 *   hasRemoteSubmissions ──► blocked: a live DocuSeal submission exists with no
 *                            local trace (the non-transactional persistSubmission
 *                            hole; see TODOS.md). Only checked when local looks clean.
 *   else ─────────────────► deletable (frees the document_key)
 */

export type DeletabilityInput = {
  isSystem: boolean;
  sendEvidenceCount: number;
  hasRemoteSubmissions: boolean;
};

export type DeletabilityVerdict = {
  canDelete: boolean;
  reason: string | null;
};

export function evaluateDeletability(input: DeletabilityInput): DeletabilityVerdict {
  if (input.isSystem) {
    return { canDelete: false, reason: "System templates cannot be deleted." };
  }
  if (input.sendEvidenceCount > 0) {
    return {
      canDelete: false,
      reason: "Documents have been sent under this signature. Archive it instead.",
    };
  }
  if (input.hasRemoteSubmissions) {
    return {
      canDelete: false,
      reason: "This signature has submissions with the signing provider. Archive it instead.",
    };
  }
  return { canDelete: true, reason: null };
}
