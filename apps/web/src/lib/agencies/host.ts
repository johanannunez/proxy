/**
 * Pure host classification for multi-tenant routing (Sub-phase B2).
 *
 * Decides what a request's hostname means for organization resolution:
 *   - "default":       the Proxy org's own surfaces (www/app/apex, localhost,
 *                       Vercel previews). No database lookup needed.
 *   - "subdomain":      a tenant subdomain of myproxyhost.com, e.g.
 *                       acme.myproxyhost.com -> slug "acme".
 *   - "custom-domain":  any other host, e.g. a white-label portal.acme.com.
 *
 * This module is imported by src/proxy.ts (middleware) and by unit tests, so
 * it must stay dependency-free and side-effect-free.
 */

const APEX_DOMAIN = "myproxyhost.com";
const SUBDOMAIN_SUFFIX = `.${APEX_DOMAIN}`;

/**
 * Subdomains that belong to Proxy itself and never resolve to a tenant. These
 * short-circuit to the Proxy org before any slug lookup, which also makes them
 * unclaimable by an agency (a takeover vector once tenant subdomains go live):
 *   - www / app: the marketing site and the authenticated product.
 *   - platform: the super-admin Platform Console.
 *   - admin: reserved so no tenant can ever hold admin.myproxyhost.com.
 */
const RESERVED_SUBDOMAINS = new Set(["www", "app", "platform", "admin"]);

/** Local development hosts always serve the Proxy org. */
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

export type HostClassification =
  | { kind: "default" }
  | { kind: "subdomain"; slug: string }
  | { kind: "custom-domain"; domain: string };

export function classifyHost(rawHost: string | null | undefined): HostClassification {
  if (!rawHost) return { kind: "default" };

  // Normalize: strip a trailing :port and IPv6 brackets, lowercase.
  const host = rawHost
    .replace(/:\d+$/, "")
    .replace(/^\[|\]$/g, "")
    .toLowerCase();

  if (host.length === 0) return { kind: "default" };
  if (LOCAL_HOSTNAMES.has(host)) return { kind: "default" };
  if (host === APEX_DOMAIN) return { kind: "default" };
  if (host.endsWith(".vercel.app")) return { kind: "default" };

  if (host.endsWith(SUBDOMAIN_SUFFIX)) {
    const slug = host.slice(0, -SUBDOMAIN_SUFFIX.length);
    if (RESERVED_SUBDOMAINS.has(slug)) return { kind: "default" };
    // Nested labels (a.b.myproxyhost.com) can never match an org slug; they
    // flow through as a subdomain lookup, miss, and get redirected by the
    // proxy. That is the desired behavior for malformed hosts.
    return { kind: "subdomain", slug };
  }

  return { kind: "custom-domain", domain: host };
}
