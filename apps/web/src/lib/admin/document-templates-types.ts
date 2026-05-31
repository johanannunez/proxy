// apps/web/src/lib/admin/document-templates-types.ts

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
>>;
