import "server-only";
import { createClient } from "@/lib/supabase/server";
import { untypedDatabase } from "@/lib/supabase/untyped";

/**
 * Platform-staff authorization (the super-admin "wall").
 *
 * Distinct from {@link import("@/lib/admin/auth").requireAdminUser}: agency
 * admins (profiles.role = 'admin') run a single agency, whereas platform staff
 * (profiles.platform_role) operate Proxy itself across every agency. The two
 * namespaces are independent — Johan happens to hold both today.
 *
 * The platform_role enum (superadmin | support | compliance | finance) and the
 * is_superadmin() SQL helper already exist (migration 20260618_120000); these
 * helpers are the application-layer gate on top of that schema. Generated types
 * still lag the column, so the read goes through the untyped client (the same
 * casting convention used across post-Phase-1B code, e.g. invite-actions.ts).
 */

export type PlatformRole = "superadmin" | "support" | "compliance" | "finance";

type PlatformProfileRow = {
  role: string | null;
  platform_role: PlatformRole | null;
};

/**
 * Read the current user's platform_role, or null if they are not signed in or
 * hold no platform role. Never throws — callers that need enforcement should
 * use {@link requireSuperadmin} instead.
 */
export async function getPlatformRole(): Promise<PlatformRole | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await untypedDatabase(supabase)
    .from<PlatformProfileRow>("profiles")
    .select("role, platform_role")
    .eq("id", user.id)
    .maybeSingle();

  return data?.platform_role ?? null;
}

/**
 * Ensures the current request comes from the platform Superadmin. Throws a
 * tagged Error that server actions and route handlers can surface as a generic
 * failure. Returns the user on success.
 *
 * Mirrors requireAdminUser so callers get the same { supabase, user } shape.
 */
export async function requireSuperadmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("not authenticated");
  }

  const { data } = await untypedDatabase(supabase)
    .from<PlatformProfileRow>("profiles")
    .select("role, platform_role")
    .eq("id", user.id)
    .maybeSingle();

  if (data?.platform_role !== "superadmin") {
    throw new Error("forbidden: platform superadmin only");
  }
  return { supabase, user };
}
