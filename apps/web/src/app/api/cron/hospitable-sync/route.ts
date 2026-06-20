import { NextResponse, type NextRequest } from "next/server";
import { syncFromHospitable } from "@/lib/hospitable-sync";
import { resolveSystemActor } from "@/lib/admin/system-actor";
import { createServiceClient } from "@/lib/supabase/service";
import { untypedDatabase } from "@/lib/supabase/untyped";

/**
 * Daily cron: pull properties + reservations from Hospitable into Supabase.
 *
 * Until now this only ran when an admin clicked "Sync" on /admin/properties
 * (apps/web/src/app/(admin)/admin/properties/sync-action.ts). For software that
 * runs an agency, "nothing updates unless a human clicks" is a launch blocker,
 * so the same syncFromHospitable() now runs unattended.
 *
 * Schedule lives in apps/web/vercel.json. Auth: Vercel Cron sends
 * `Authorization: Bearer ${CRON_SECRET}` (the same secret the other cron routes
 * already use).
 *
 * syncFromHospitable is idempotent — properties are linked by
 * hospitable_property_id and bookings upsert on external_id — so re-running is
 * safe. Unmatched Hospitable properties are CREATED and assigned to the system
 * actor as a placeholder owner; because that happens with no human watching the
 * SyncResult, the cron records what it did to activity_log for an audit trail.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const actor = await resolveSystemActor();
  if (!actor) {
    return NextResponse.json(
      { error: "No system admin profile to attribute the sync to" },
      { status: 500 },
    );
  }

  const result = await syncFromHospitable(actor.id);

  // Best-effort audit trail of what an unattended sync created/changed. Never
  // fail the cron on a logging error.
  untypedDatabase(createServiceClient())
    .from("activity_log")
    .insert({
      actor_id: actor.id,
      agency_id: actor.agencyId,
      entity_type: "system",
      action: "hospitable_sync_cron",
      metadata: {
        propertiesMatched: result.propertiesMatched,
        propertiesCreated: result.propertiesCreated,
        propertiesUnmatched: result.propertiesUnmatched,
        reservationsUpserted: result.reservationsUpserted,
        errors: result.errors,
      },
    })
    .then(
      () => {},
      () => {},
    );

  console.log("[cron/hospitable-sync]", JSON.stringify(result));
  return NextResponse.json({ ok: true, ...result });
}
