import "server-only";
import { createClient } from "@/lib/supabase/server";
import { untypedDatabase } from "@/lib/supabase/untyped";
import { getActiveWorkspaceAuthority } from "./decision-authority";
import type { AuthorityDomain } from "@/types/decision-authority";

/**
 * Returns the profile ID of the owner assigned to the given domain,
 * or null if no active authority exists or no assignment was made.
 *
 * For per_property governance_mode, pass propertyId to get the property-specific
 * assignment. Falls back to workspace-wide (property_id IS NULL) if no
 * property-specific record exists.
 */
export async function getAuthorityOwner(
  workspaceId: string,
  domain: AuthorityDomain,
  propertyId?: string
): Promise<string | null> {
  const authority = await getActiveWorkspaceAuthority(workspaceId);
  if (!authority) return null;

  const supabase = await createClient();
  const db = untypedDatabase(supabase);

  if (authority.governance_mode === "per_property" && propertyId) {
    // Try property-specific assignment first
    const { data: specific } = await db
      .from("workspace_authority_domains")
      .select("assigned_owner_id")
      .eq("authority_id", authority.id)
      .eq("domain", domain)
      .eq("property_id", propertyId)
      .maybeSingle();

    if ((specific as { assigned_owner_id?: string } | null)?.assigned_owner_id) {
      return (specific as { assigned_owner_id: string }).assigned_owner_id;
    }
  }

  // Workspace-wide assignment (property_id IS NULL)
  const { data } = await db
    .from("workspace_authority_domains")
    .select("assigned_owner_id")
    .eq("authority_id", authority.id)
    .eq("domain", domain)
    .is("property_id", null)
    .maybeSingle();

  return (data as { assigned_owner_id?: string } | null)?.assigned_owner_id ?? null;
}

/**
 * Returns the profile IDs to notify for guest escalations.
 * Returns an empty array when no active authority exists (caller falls back
 * to notifying all workspace members).
 */
export async function getEscalationOwners(
  workspaceId: string,
  propertyId?: string
): Promise<string[]> {
  const authority = await getActiveWorkspaceAuthority(workspaceId);
  if (!authority) return [];

  const supabase = await createClient();
  const db = untypedDatabase(supabase);

  if (authority.governance_mode === "per_property" && propertyId) {
    const { data: specific } = await db
      .from("workspace_authority_escalation")
      .select("notify_owner_ids")
      .eq("authority_id", authority.id)
      .eq("property_id", propertyId)
      .maybeSingle();

    const ids = (specific as { notify_owner_ids?: string[] } | null)?.notify_owner_ids;
    if (ids?.length) return ids;
  }

  const { data } = await db
    .from("workspace_authority_escalation")
    .select("notify_owner_ids")
    .eq("authority_id", authority.id)
    .is("property_id", null)
    .maybeSingle();

  return (data as { notify_owner_ids?: string[] } | null)?.notify_owner_ids ?? [];
}
