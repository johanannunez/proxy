// apps/web/src/lib/signing/signature-config.ts

/**
 * Signing engine role constants. These must match the role names
 * defined in each DocuSeal template.
 * Document types and template IDs now live in the document_templates DB table.
 */

/** The role name for the property owner (primary signer). */
export const SIGNER_ROLE = "Owner";

/** The role name for Proxy's countersignature. */
export const COUNTERSIGNER_ROLE = "Proxy";
