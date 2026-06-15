export const AUTHORITY_DOMAINS = [
  "documents_legal",
  "finances_payouts",
  "operations_maintenance",
] as const;

export type AuthorityDomain = (typeof AUTHORITY_DOMAINS)[number];

export const DOMAIN_LABELS: Record<AuthorityDomain, string> = {
  documents_legal: "Documents & Legal",
  finances_payouts: "Finances & Payouts",
  operations_maintenance: "Operations & Maintenance",
};

export const DOMAIN_DESCRIPTIONS: Record<AuthorityDomain, string> = {
  documents_legal:
    "Receives DocuSeal signature requests for W-9s, management agreements, and leases.",
  finances_payouts:
    "Receives payout reports, approves expenses, and is routed financial decisions.",
  operations_maintenance:
    "Approves maintenance requests, owner blocks, and property-level operational decisions.",
};

export type GovernanceMode = "workspace" | "per_property";

export type AuthorityStatus = "draft" | "pending_signatures" | "active" | "superseded";

export interface WorkspaceAuthority {
  id: string;
  workspace_id: string;
  org_id: string;
  governance_mode: GovernanceMode;
  status: AuthorityStatus;
  docuseal_submission_id: string | null;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthorityDomainAssignment {
  id: string;
  authority_id: string;
  property_id: string | null;
  domain: AuthorityDomain;
  assigned_owner_id: string;
}

export interface AuthorityEscalation {
  id: string;
  authority_id: string;
  property_id: string | null;
  notify_owner_ids: string[];
}

/** Flattened config used by the form — one per property or null for workspace-wide. */
export interface AuthorityConfig {
  property_id: string | null;
  domains: Partial<Record<AuthorityDomain, string>>; // domain -> owner profile id
  escalation_owner_ids: string[];
}

/** Full authority record with related assignments loaded. */
export interface AuthorityWithAssignments {
  authority: WorkspaceAuthority;
  configs: AuthorityConfig[];
}
