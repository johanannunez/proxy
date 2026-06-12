/**
 * Client-safe types for the unified Templates tab. A template is a master:
 * either a signature document (PDF + DocuSeal fields) or a form (built schema).
 * Both render in one grid with kind badges; the server page maps each source
 * table into this shape.
 */

export type UnifiedTemplateKind = "signature" | "form";

export type UnifiedTemplateField = {
  label: string;
  type: string;
};

export type SendRecipient = {
  profileId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  propertyCount: number;
  /** Document keys this owner already has out for signature or on file. */
  activeDocumentKeys: string[];
};

export type UnifiedTemplate = {
  id: string;
  kind: UnifiedTemplateKind;
  name: string;
  description: string | null;
  isSystem: boolean;
  /** Signature: active with a DocuSeal layout. Form: published. */
  isReady: boolean;
  /** Signature templates only. */
  documentKey: string | null;
  docusealTemplateId: number | null;
  signerRoles: string[];
  /** First-page preview image from DocuSeal (signature templates). */
  previewImageUrl: string | null;
  /** Signature: document instances sent. */
  sentCount: number;
  /** Form: responses collected. */
  responseCount: number;
  fieldCount: number;
  /** First few schema fields, for the form thumbnail render. */
  previewFields: UnifiedTemplateField[];
  /** Form public link slug. */
  slug: string | null;
  isPublic: boolean;
};
