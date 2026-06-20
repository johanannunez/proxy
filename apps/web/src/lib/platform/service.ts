import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { untypedDatabase, type UntypedDatabaseClient } from "@/lib/supabase/untyped";

/**
 * Shared data-access helpers for the super-admin Platform Console.
 *
 * Everything here reads cross-agency, so it goes through the service-role client
 * (RLS-bypass) wrapped with untypedDatabase() — the same post-Phase-1B convention
 * used in invite-actions.ts and viewing-as-actions.ts, since generated types lag
 * the agency_id / platform_role columns and the platform_* views.
 *
 * NEVER import this module from a Client Component.
 */

export function platformDb(): UntypedDatabaseClient {
  return untypedDatabase(createServiceClient());
}

/**
 * Map of auth user id -> last_sign_in_at (ISO) or null.
 *
 * last_sign_in_at is the truest "is this account active" signal we have —
 * activity_log is a sparse audit trail that most real usage never writes to.
 * profiles.id === auth.users.id, so callers join this map onto profiles.
 *
 * Uses the Auth admin API (one page covers today's user count). Paginates
 * defensively; at large scale this should move to a service-role SQL join, which
 * is tracked as a follow-up.
 */
export async function getLastSignInMap(): Promise<Map<string, string | null>> {
  const svc = createServiceClient();
  const map = new Map<string, string | null>();
  const perPage = 1000;
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage });
    if (error || !data) break;
    for (const u of data.users) map.set(u.id, u.last_sign_in_at ?? null);
    if (data.users.length < perPage) break;
  }
  return map;
}
