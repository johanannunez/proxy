import "server-only";
import { createClient } from "@/lib/supabase/server";
import { untypedDatabase } from "@/lib/supabase/untyped";
import type { Organization, OrganizationBranding } from "@/types/organizations";

/**
 * Org-layer query helpers (Sub-phase B1).
 *
 * The organizations tables are newer than the generated Supabase types, so
 * queries go through the untyped client wrapper with explicit row interfaces
 * from `@/types/organizations`.
 */

export async function getOrgBySlug(slug: string): Promise<Organization | null> {
  const supabase = await createClient();
  const { data } = await untypedDatabase(supabase)
    .from<Organization>("organizations")
    .select("*")
    .eq("slug", slug)
    .single();
  return data;
}

export async function getOrgByCustomDomain(domain: string): Promise<Organization | null> {
  const supabase = await createClient();
  const { data } = await untypedDatabase(supabase)
    .from<Organization>("organizations")
    .select("*, organization_branding!inner(custom_domain)")
    .eq("organization_branding.custom_domain", domain)
    .single();
  return data;
}

export async function getOrgBranding(orgId: string): Promise<OrganizationBranding | null> {
  const supabase = await createClient();
  const { data } = await untypedDatabase(supabase)
    .from<OrganizationBranding>("organization_branding")
    .select("*")
    .eq("org_id", orgId)
    .single();
  return data;
}
