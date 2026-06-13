/**
 * Pure helpers for editable template meta. Kept free of "use server" and
 * "server-only" so the lock logic can be unit-tested directly in the node
 * vitest environment (importing the server action module would pull in
 * server-only and throw).
 */

export type MetaEditInput = {
  title?: string | null;
  display_name?: string;
  description?: string | null;
  document_key?: string;
  signer_roles?: string[];
};

/**
 * Once a template has been sent, its document key and signer roles are locked:
 * editing them would orphan documents already out for signature. Cosmetic
 * fields (title, name, description) stay editable forever.
 */
export function metaEditLocked(hasBeenSent: boolean, input: MetaEditInput): boolean {
  if (!hasBeenSent) return false;
  return input.document_key !== undefined || input.signer_roles !== undefined;
}

const DOCUMENT_KEY_PATTERN = /^[a-z0-9_]+$/;

/** True when a document key is well-formed (lowercase, numbers, underscores). */
export function isValidDocumentKey(documentKey: string): boolean {
  return DOCUMENT_KEY_PATTERN.test(documentKey);
}
