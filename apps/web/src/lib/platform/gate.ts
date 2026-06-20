/**
 * Pure super-admin wall decision.
 *
 * Extracted from the proxy so the security property ("only a superadmin reaches
 * /platform") is unit-testable without the middleware's Supabase client. Given a
 * profile's roles, returns the path to redirect a NON-superadmin to, or null to
 * allow them through.
 *
 * Imported by src/proxy.ts (middleware), so it must stay dependency-free with NO
 * `import "server-only"` (that guard throws at middleware build time). Fails
 * closed: a missing/unreadable profile is bounced, never allowed in.
 */
export type PlatformGateProfile = {
  role: string | null;
  platform_role: string | null;
};

export function resolvePlatformGateDest(profile: PlatformGateProfile | null): string | null {
  if (profile?.platform_role === "superadmin") return null;
  return profile?.role === "admin" ? "/admin" : "/workspace/home";
}
