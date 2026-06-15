import "server-only";
import { createClient } from "@/lib/supabase/server";
import { untypedDatabase } from "@/lib/supabase/untyped";
import type {
  WorkspaceAuthority,
  AuthorityWithAssignments,
  AuthorityConfig,
  AuthorityDomain,
  GovernanceMode,
} from "@/types/decision-authority";

export interface WorkspaceMember {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

/** Returns the single active authority record for a workspace, or null. */
export async function getActiveWorkspaceAuthority(
  workspaceId: string
): Promise<WorkspaceAuthority | null> {
  const supabase = await createClient();
  const db = untypedDatabase(supabase);
  const { data, error } = await db
    .from("workspace_authority")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .single();
  if (error || !data) return null;
  return data as WorkspaceAuthority;
}

/** Returns the most recent non-superseded authority record (active or pending). */
export async function getCurrentWorkspaceAuthority(
  workspaceId: string
): Promise<WorkspaceAuthority | null> {
  const supabase = await createClient();
  const db = untypedDatabase(supabase);
  const { data, error } = await db
    .from("workspace_authority")
    .select("*")
    .eq("workspace_id", workspaceId)
    .in("status", ["active", "pending_signatures", "draft"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as WorkspaceAuthority;
}

/** Returns all profiles that belong to this workspace. */
export async function getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const supabase = await createClient();
  const db = untypedDatabase(supabase);
  const { data, error } = await db
    .from("profiles")
    .select("id, full_name, email, avatar_url")
    .eq("workspace_id", workspaceId);
  if (error || !data) return [];
  return data as WorkspaceMember[];
}

/** Returns the full authority record with domain assignments and escalation. */
export async function getAuthorityWithAssignments(
  authorityId: string
): Promise<AuthorityWithAssignments | null> {
  const supabase = await createClient();
  const db = untypedDatabase(supabase);

  const [
    { data: authority, error: authErr },
    { data: domains, error: domainsErr },
    { data: escalations, error: escalationsErr },
  ] = await Promise.all([
    db.from("workspace_authority").select("*").eq("id", authorityId).single(),
    db.from("workspace_authority_domains").select("*").eq("authority_id", authorityId),
    db.from("workspace_authority_escalation").select("*").eq("authority_id", authorityId),
  ]);

  if (authErr || !authority || domainsErr || escalationsErr) return null;

  // Group domains and escalation into AuthorityConfig per property_id (null = workspace-wide)
  const configMap = new Map<string | null, AuthorityConfig>();

  const domainRows = (domains ?? []) as Array<{
    property_id: string | null;
    domain: AuthorityDomain;
    assigned_owner_id: string;
  }>;

  const escalationRows = (escalations ?? []) as Array<{
    property_id: string | null;
    notify_owner_ids: string[];
  }>;

  for (const d of domainRows) {
    const key = d.property_id ?? null;
    if (!configMap.has(key)) {
      configMap.set(key, { property_id: key, domains: {}, escalation_owner_ids: [] });
    }
    configMap.get(key)!.domains[d.domain] = d.assigned_owner_id;
  }

  for (const e of escalationRows) {
    const key = e.property_id ?? null;
    if (!configMap.has(key)) {
      configMap.set(key, { property_id: key, domains: {}, escalation_owner_ids: [] });
    }
    configMap.get(key)!.escalation_owner_ids = e.notify_owner_ids;
  }

  return {
    authority: authority as WorkspaceAuthority,
    configs: Array.from(configMap.values()),
  };
}

export interface SaveAuthorityInput {
  workspaceId: string;
  orgId: string;
  governanceMode: GovernanceMode;
  configs: AuthorityConfig[];
}

/**
 * Creates a new draft authority record for this workspace, then supersedes any
 * existing non-superseded records only after all new data is safely inserted.
 * This ordering prevents data loss: if any insert fails, prior active records
 * remain untouched.
 * Returns the new authority ID, or null on error.
 */
export async function saveWorkspaceAuthority(
  input: SaveAuthorityInput
): Promise<string | null> {
  const supabase = await createClient();
  const db = untypedDatabase(supabase);

  // Insert new draft record FIRST — if anything below fails, prior records are untouched
  const { data: newAuth, error: authErr } = await db
    .from("workspace_authority")
    .insert({
      workspace_id: input.workspaceId,
      org_id: input.orgId,
      governance_mode: input.governanceMode,
      status: "draft",
    })
    .select("id")
    .single();

  if (authErr || !newAuth) return null;

  const authorityId = (newAuth as { id: string }).id;

  // Insert domain assignments
  const domainRows = input.configs.flatMap((config) =>
    (Object.entries(config.domains) as [AuthorityDomain, string][]).map(
      ([domain, assigned_owner_id]) => ({
        authority_id: authorityId,
        property_id: config.property_id,
        domain,
        assigned_owner_id,
      })
    )
  );

  if (domainRows.length > 0) {
    const { error: domErr } = await db
      .from("workspace_authority_domains")
      .insert(domainRows);
    if (domErr) return null;
  }

  // Insert escalation routing
  const escalationRows = input.configs
    .filter((c) => c.escalation_owner_ids.length > 0)
    .map((config) => ({
      authority_id: authorityId,
      property_id: config.property_id,
      notify_owner_ids: config.escalation_owner_ids,
    }));

  if (escalationRows.length > 0) {
    const { error: escErr } = await db
      .from("workspace_authority_escalation")
      .insert(escalationRows);
    if (escErr) return null;
  }

  // Supersede existing records ONLY after all new data is safely inserted
  await db
    .from("workspace_authority")
    .update({ status: "superseded" })
    .eq("workspace_id", input.workspaceId)
    .neq("id", authorityId)
    .in("status", ["draft", "pending_signatures", "active"]);

  return authorityId;
}

/** Marks an authority record as pending_signatures after DocuSeal submission is created. */
export async function markAuthorityPendingSignatures(
  authorityId: string,
  docusealSubmissionId: string
): Promise<boolean> {
  const supabase = await createClient();
  const db = untypedDatabase(supabase);
  const { error } = await db
    .from("workspace_authority")
    .update({ status: "pending_signatures", docuseal_submission_id: docusealSubmissionId })
    .eq("id", authorityId);
  return !error;
}

/** Called by the DocuSeal webhook when all owners have signed. */
export async function activateWorkspaceAuthority(
  docusealSubmissionId: string,
  signedAt: string
): Promise<boolean> {
  const supabase = await createClient();
  const db = untypedDatabase(supabase);
  const { error } = await db
    .from("workspace_authority")
    .update({ status: "active", signed_at: signedAt })
    .eq("docuseal_submission_id", docusealSubmissionId)
    .eq("status", "pending_signatures");
  return !error;
}
