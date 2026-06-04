import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Resolve the post-auth home for the current user, matching the role routing
 * used by the login action: admins land on /admin, everyone else on
 * /workspace/home. Returns null when there is no logged-in user.
 */
export async function getRoleHome(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return profile?.role === "admin" ? "/admin" : "/workspace/home";
}

/**
 * Validate an internal redirect target. Returns the path only when it is a
 * same-origin absolute path (starts with a single "/"), otherwise returns the
 * provided fallback. Prevents open-redirect via protocol-relative URLs.
 */
export function safeInternalPath(raw: string | null, fallback: string): string {
  if (!raw) return fallback;
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : fallback;
}
