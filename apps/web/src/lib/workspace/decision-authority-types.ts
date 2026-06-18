// Re-exports only type-level items so client components can import without
// pulling in server-only imports from decision-authority.ts.

export type {
  AuthorityDomain,
  AuthorityDomainAssignment,
  AuthorityEscalation,
  AuthorityConfig,
  AuthorityStatus,
  AuthorityWithAssignments,
  GovernanceMode,
  WorkspaceAuthority,
} from "@/types/decision-authority";

export {
  AUTHORITY_DOMAINS,
  DOMAIN_DESCRIPTIONS,
  DOMAIN_LABELS,
} from "@/types/decision-authority";
