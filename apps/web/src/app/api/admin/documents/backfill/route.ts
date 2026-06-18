import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { syncOwnerDocuments } from "@/lib/documents/spine";

export const dynamic = "force-dynamic";

/**
 * Maintenance endpoint: (re)materialize the documents spine for every owner from
 * the detail tables. Admin-only. Safe to re-run — sync is idempotent and never
 * regresses an advanced/reviewed status. Pass ?owner=<profileId> to scope to one.
 */
export async function GET(request: Request) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  // Resolve the caller: cookie session first, then a Bearer access token
  // (supports scripted/admin maintenance runs). Either way we require admin role.
  let userId: string | null = null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    userId = user.id;
  } else {
    const auth = request.headers.get("authorization") ?? "";
    const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
    if (token) {
      const { data: tokenUser } = await service.auth.getUser(token);
      userId = tokenUser?.user?.id ?? null;
    }
  }
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await service.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const onlyOwner = url.searchParams.get("owner");

  let ownerQuery = service.from("profiles").select("id, workspace_id").is("deleted_at", null);
  if (onlyOwner) ownerQuery = ownerQuery.eq("id", onlyOwner);
  const { data: owners, error: ownersError } = await ownerQuery;
  if (ownersError) return NextResponse.json({ error: ownersError.message }, { status: 500 });

  const results: Array<{ ownerId: string; properties: number; written: number }> = [];
  for (const owner of (owners ?? []) as Array<{ id: string; workspace_id: string | null }>) {
    const { data: props } = await service.from("properties").select("id").eq("owner_id", owner.id);
    const propertyIds = ((props ?? []) as Array<{ id: string }>).map((p) => p.id);
    const { written } = await syncOwnerDocuments({
      ownerProfileId: owner.id,
      workspaceId: owner.workspace_id,
      propertyIds,
    });
    results.push({ ownerId: owner.id, properties: propertyIds.length, written });
  }

  const totalWritten = results.reduce((sum, r) => sum + r.written, 0);
  return NextResponse.json({ ok: true, owners: results.length, totalWritten, results });
}
