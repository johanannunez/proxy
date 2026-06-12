/**
 * Org resolution with a 60s in-memory TTL cache (Sub-phase B2).
 *
 * Called from src/proxy.ts on every request to translate the request host
 * into an organization context without paying a database roundtrip per
 * request. Production hosts (www/app/localhost/previews) short-circuit to the
 * Proxy org with no lookup at all, so the live site's request path is
 * unchanged.
 *
 * NOTE: no `import "server-only"` here on purpose. This module is imported by
 * the middleware (src/proxy.ts), where the server-only guard package throws at
 * build time. It never reaches the client bundle: only proxy.ts and server
 * code import it, and it reads SUPABASE_SECRET_KEY which does not exist in
 * client bundles. Lookups use a dedicated supabase-js service client (the same
 * pattern the CalDAV handler in src/proxy.ts uses) because organizations rows
 * are not anonymously readable under RLS.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { untypedDatabase } from "@/lib/supabase/untyped";
import { PROXY_ORG_ID, type OrgPlanTier } from "@/types/organizations";
import { classifyHost } from "./host";

export interface ResolvedOrg {
  id: string;
  slug: string;
  planTier: OrgPlanTier;
}

/** The Proxy org context served on all first-party hosts, with no DB lookup. */
export const PROXY_DEFAULT_ORG: ResolvedOrg = {
  id: PROXY_ORG_ID,
  slug: "proxy",
  planTier: "white_label",
};

export const ORG_CACHE_TTL_MS = 60_000;

/**
 * Minimal TTL cache. Exported for unit tests; the injectable clock exists so
 * expiry is testable without real timers. Negative results (null) are cached
 * too, so a hammered unknown subdomain costs one lookup per minute.
 */
export class TtlCache<T> {
  private entries = new Map<string, { value: T; expires: number }>();

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expires <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    this.entries.set(key, { value, expires: this.now() + this.ttlMs });
  }
}

const orgCache = new TtlCache<ResolvedOrg | null>(ORG_CACHE_TTL_MS);

let serviceClient: SupabaseClient | null = null;

function getServiceClient(): SupabaseClient {
  if (!serviceClient) {
    serviceClient = createClient(
      // Both vars are guaranteed in every runtime that executes the proxy
      // (same assertion style as the existing CalDAV service client).
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
    );
  }
  return serviceClient;
}

/** Row shape for the columns the proxy needs; generated types lag new tables. */
interface OrgRow {
  id: string;
  slug: string;
  plan_tier: OrgPlanTier;
}

async function fetchOrgBySlug(slug: string): Promise<ResolvedOrg | null> {
  const { data } = await untypedDatabase(getServiceClient())
    .from<OrgRow>("organizations")
    .select("id, slug, plan_tier")
    .eq("slug", slug)
    .maybeSingle();
  return data ? { id: data.id, slug: data.slug, planTier: data.plan_tier } : null;
}

async function fetchOrgByCustomDomain(domain: string): Promise<ResolvedOrg | null> {
  const { data } = await untypedDatabase(getServiceClient())
    .from<OrgRow>("organizations")
    .select("id, slug, plan_tier, organization_branding!inner(custom_domain)")
    .eq("organization_branding.custom_domain", domain)
    .maybeSingle();
  return data ? { id: data.id, slug: data.slug, planTier: data.plan_tier } : null;
}

/**
 * Resolve the organization context for a request hostname.
 *
 * Returns:
 *   - the Proxy org for all first-party hosts (no lookup),
 *   - the tenant org for a known subdomain or custom domain,
 *   - the Proxy org for an UNKNOWN custom domain (previews, tunnels, and
 *     misconfigured DNS must never hard-fail the whole site),
 *   - null only for an unknown *.myproxyhost.com subdomain, which the proxy
 *     redirects to the main site.
 */
export async function resolveOrgForRequestHost(
  hostname: string | null | undefined,
): Promise<ResolvedOrg | null> {
  const classified = classifyHost(hostname);
  if (classified.kind === "default") return PROXY_DEFAULT_ORG;

  const cacheKey =
    classified.kind === "subdomain"
      ? `slug:${classified.slug}`
      : `domain:${classified.domain}`;

  let org = orgCache.get(cacheKey);
  if (org === undefined) {
    org =
      classified.kind === "subdomain"
        ? await fetchOrgBySlug(classified.slug)
        : await fetchOrgByCustomDomain(classified.domain);
    orgCache.set(cacheKey, org);
  }

  if (classified.kind === "custom-domain") return org ?? PROXY_DEFAULT_ORG;
  return org;
}
