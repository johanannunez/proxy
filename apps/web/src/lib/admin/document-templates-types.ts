// apps/web/src/lib/admin/document-templates-types.ts

/**
 * Per-template settings bag (migration 20260613090000_template_settings).
 * Stored as a single jsonb column so new options ship without a migration each
 * time. Every field is optional; an empty object is the valid default.
 */
export type TemplateSettings = {
  email?: { subject?: string; message?: string };
  reminders?: { everyDays: number; maxCount: number } | null;
  expiresInDays?: number | null;
  afterSign?: { redirectUrl?: string; cc?: string[] };
  prefill?: boolean;
  accessPin?: string | null;
};

export type DocumentTemplate = {
  id: string;
  org_id: string | null;
  document_key: string;
  display_name: string;
  description: string | null;
  docuseal_template_id: number | null;
  signer_roles: string[];
  requires_countersignature: boolean;
  gate_step: number | null;
  is_system: boolean;
  is_active: boolean;
  /** Coverage tracking (migration 20260612090000_template_tracking). Until the
      migration runs the DB rows lack these columns; helpers normalize to
      false/null so the code path stays safe either way. */
  tracked: boolean;
  category: string | null;
  /** Optional display title override + flexible settings bag (migration
      20260613090000_template_settings). Rows read before the migration runs
      lack these columns; helpers normalize to null/{} so the path stays safe. */
  title: string | null;
  settings: TemplateSettings;
  created_at: string;
  updated_at: string;
};

export type CreateDocumentTemplateInput = {
  org_id?: string;
  document_key: string;
  display_name: string;
  description?: string;
  docuseal_template_id?: number;
  signer_roles: string[];
  requires_countersignature: boolean;
  gate_step?: number;
};

export type UpdateDocumentTemplateInput = Partial<Pick<
  DocumentTemplate,
  | "display_name"
  | "description"
  | "docuseal_template_id"
  | "signer_roles"
  | "requires_countersignature"
  | "gate_step"
  | "is_active"
  | "tracked"
  | "category"
>>;
