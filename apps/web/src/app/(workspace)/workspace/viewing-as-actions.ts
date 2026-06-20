"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { untypedDatabase } from "@/lib/supabase/untyped";

const VIEWING_AS_COOKIE = "proxy_viewing_as";
const SUPPORT_LOG_COOKIE = "proxy_support_log_id";
const SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours

/**
 * Set the admin "viewing as" cookie to impersonate a specific owner.
 * Only works if the caller is an admin — silently no-ops otherwise.
 *
 * Compliance scaffold (M3): every impersonation session is recorded to
 * activity_log from day one. This is the agency-admin → owner impersonation;
 * the platform-staff → agency support-access built later in M3 reuses the same
 * pattern. activity_log has no INSERT policy, so writes go through the service
 * client (same as invite-actions). Visibility is admin_only so the log stays
 * out of the owner's timeline. Logging is best-effort: a log failure never
 * blocks impersonation, but the start row's id is stashed in a cookie so
 * clearViewingAs can stamp the session end on the same row.
 */
export async function setViewingAs(ownerId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return;

  const cookieStore = await cookies();
  cookieStore.set(VIEWING_AS_COOKIE, ownerId, {
    httpOnly: true,
    sameSite: "strict",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });

  try {
    const svc = untypedDatabase(createServiceClient());
    const { data: owner } = await svc
      .from<{ agency_id: string }>("profiles")
      .select("agency_id")
      .eq("id", ownerId)
      .maybeSingle();

    const { data: logRow } = await svc
      .from<{ id: string }>("activity_log")
      .insert({
        actor_id: user.id,
        agency_id: owner?.agency_id ?? undefined,
        entity_type: "owner",
        entity_id: ownerId,
        action: "support_access_start",
        visibility: "admin_only",
        metadata: { access_mode: "full", started_at: new Date().toISOString() },
      })
      .select("id")
      .maybeSingle();

    if (logRow?.id) {
      cookieStore.set(SUPPORT_LOG_COOKIE, logRow.id, {
        httpOnly: true,
        sameSite: "strict",
        maxAge: SESSION_MAX_AGE,
        path: "/",
      });
    }
  } catch {
    // Logging is best-effort; impersonation still proceeds.
  }

  revalidatePath("/portal", "layout");
}

/**
 * Clear the "viewing as" cookie and return to the admin's own portal view.
 * Stamps the support-access session end (ended_at) on the start row.
 */
export async function clearViewingAs() {
  const cookieStore = await cookies();

  const logId = cookieStore.get(SUPPORT_LOG_COOKIE)?.value;
  if (logId) {
    try {
      const svc = untypedDatabase(createServiceClient());
      const { data: existing } = await svc
        .from<{ metadata: Record<string, unknown> | null }>("activity_log")
        .select("metadata")
        .eq("id", logId)
        .maybeSingle();
      await svc
        .from("activity_log")
        .update({
          metadata: {
            ...(existing?.metadata ?? {}),
            ended_at: new Date().toISOString(),
          },
        })
        .eq("id", logId);
    } catch {
      // Best-effort.
    }
    cookieStore.delete(SUPPORT_LOG_COOKIE);
  }

  cookieStore.delete(VIEWING_AS_COOKIE);
  revalidatePath("/portal", "layout");
}
