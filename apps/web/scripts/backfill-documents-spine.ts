/**
 * One-time (idempotent) backfill: materialize the documents spine for every
 * owner from the detail tables. Run with:
 *   doppler run -- npx tsx scripts/backfill-documents-spine.ts
 */
import { createServiceClient } from "../src/lib/supabase/service";
import { syncOwnerDocuments } from "../src/lib/documents/spine";

async function main() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;
  const { data: owners, error } = await db
    .from("profiles")
    .select("id, workspace_id, email")
    .is("deleted_at", null);
  if (error) throw new Error(error.message);

  let totalWritten = 0;
  for (const owner of (owners ?? []) as Array<{ id: string; workspace_id: string | null; email: string }>) {
    const { data: props } = await db.from("properties").select("id").eq("owner_id", owner.id);
    const propertyIds = ((props ?? []) as Array<{ id: string }>).map((p) => p.id);
    const { written } = await syncOwnerDocuments({
      ownerProfileId: owner.id,
      workspaceId: owner.workspace_id,
      propertyIds,
    });
    totalWritten += written;
    console.log(`  ${owner.email}: ${propertyIds.length} properties, ${written} spine rows`);
  }
  console.log(`\nDone. ${(owners ?? []).length} owners, ${totalWritten} spine rows written.`);
}

main().catch((e) => { console.error("Backfill failed:", e); process.exit(1); });
