/**
 * Org subdomain slug rules (Sub-phase B3).
 *
 * Pure module shared by the signup server action (authoritative check) and
 * the signup client (instant format feedback while typing). The format mirrors
 * the database check constraint on organizations.slug:
 * `^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$` (3 to 32 chars).
 */

export const ORG_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;

/** Subdomains Proxy itself uses; never available to tenants. */
export const RESERVED_ORG_SLUGS: readonly string[] = [
  "proxy",
  "www",
  "app",
  "api",
  "admin",
  "mail",
  "status",
];

export function isValidOrgSlug(slug: string): boolean {
  if (!ORG_SLUG_PATTERN.test(slug)) return false;
  return !RESERVED_ORG_SLUGS.includes(slug);
}

/**
 * Best-effort conversion of a company name into a valid slug suggestion.
 * The result still goes through availability + validity checks; this only
 * exists so the subdomain field can prefill with something sensible.
 */
export function normalizeOrgSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
    .replace(/-+$/g, "");
}
