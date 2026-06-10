/**
 * Auth cookies must be scoped to `.myproxyhost.com` so the session is visible
 * on both www.myproxyhost.com (marketing + login) and app.myproxyhost.com
 * (workspace + admin). A host-only cookie set during login on www is invisible
 * to app., which traps the user in a www/login <-> app redirect loop in
 * src/proxy.ts. Every Supabase client that writes cookies must use this.
 *
 * Client-safe: no server-only imports.
 */
export function authCookieDomain(hostname: string | null | undefined): string | undefined {
  if (!hostname) return undefined;
  const host = hostname.split(":")[0];
  return host === "myproxyhost.com" || host.endsWith(".myproxyhost.com")
    ? ".myproxyhost.com"
    : undefined;
}
