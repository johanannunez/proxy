import "server-only";
import { createClient } from "@/lib/supabase/server";
import { untypedDatabase } from "@/lib/supabase/untyped";
import type { Agency, AgencyBranding } from "@/types/agencies";

/**
 * Agency-layer query helpers (Sub-phase B1).
 *
 * The agencies tables are newer than the generated Supabase types, so
 * queries go through the untyped client wrapper with explicit row interfaces
 * from `@/types/agencies`.
 */

export async function getOrgBySlug(slug: string): Promise<Agency | null> {
  const supabase = await createClient();
  const { data } = await untypedDatabase(supabase)
    .from<Agency>("agencies")
    .select("*")
    .eq("slug", slug)
    .single();
  return data;
}

export async function getOrgByCustomDomain(domain: string): Promise<Agency | null> {
  const supabase = await createClient();
  const { data } = await untypedDatabase(supabase)
    .from<Agency>("agencies")
    .select("*, organization_branding!inner(custom_domain)")
    .eq("organization_branding.custom_domain", domain)
    .single();
  return data;
}

export async function getOrgBranding(orgId: string): Promise<AgencyBranding | null> {
  const supabase = await createClient();
  const { data } = await untypedDatabase(supabase)
    .from<AgencyBranding>("organization_branding")
    .select("*")
    .eq("agency_id", orgId)
    .single();
  return data;
}
