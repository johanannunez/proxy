import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { untypedDatabase } from "@/lib/supabase/untyped";

/**
 * The profile an unattended job (cron) acts as.
 *
 * Several pieces of logic that were written for an interactive admin need a
 * profile id for attribution (e.g. hospitable-sync stamps net-new properties
 * with an owner_id; invoice generation stamps created_by). When the same logic
 * runs from a cron there is no session, so we attribute it to the platform
 * superadmin (falling back to any agency admin so the jobs keep working before
 * a superadmin is assigned).
 *
 * Reads go through the untyped client because platform_role / agency_id lag the
 * generated types post-Phase-1B (same convention as invite-actions.ts).
 */

export type SystemActor = { id: string; agencyId: string };

type ActorRow = { id: string; agency_id: string };

export async function resolveSystemActor(): Promise<SystemActor | null> {
  const db = untypedDatabase(createServiceClient());

  // Prefer the platform superadmin (the founder / platform owner).
  const { data: superadmin } = await db
    .from<ActorRow>("profiles")
    .select("id, agency_id")
    .eq("platform_role", "superadmin")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (superadmin?.id) {
    return { id: superadmin.id, agencyId: superadmin.agency_id };
  }

  // Fallback: any agency admin, so crons still run pre-superadmin assignment.
  const { data: admin } = await db
    .from<ActorRow>("profiles")
    .select("id, agency_id")
    .eq("role", "admin")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return admin?.id ? { id: admin.id, agencyId: admin.agency_id } : null;
}
