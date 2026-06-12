"use server";

/**
 * Global document search for the paperwork hub. Matches owner names, document
 * titles, catalog keys, and statuses across the documents spine. Admin-gated:
 * server actions are callable by any authenticated user.
 */
import { createClient } from "@/lib/supabase/server";
import { untypedDatabase } from "@/lib/supabase/untyped";
import { DOCUMENT_STATUSES } from "@/lib/documents/status";

export type DocumentSearchResult = {
  id: string;
  title: string;
  document_key: string | null;
  status: string;
  owner_id: string;
  owner_name: string;
  owner_email: string;
  updated_at: string;
};

/* documents.owner_id references auth.users (not profiles), so PostgREST
   cannot embed the profile — owner names resolve in a second query. */
type SearchRow = {
  id: string;
  title: string;
  document_key: string | null;
  status: string;
  owner_id: string;
  updated_at: string;
};

type ProfileRow = { id: string; full_name: string | null; email: string | null };

const RESULT_LIMIT = 20;

/** Strips characters that break PostgREST `.or()` filter strings. */
function sanitizeTerm(query: string): string {
  return query.replace(/[,()%_\\]/g, " ").trim();
}

function toResult(row: SearchRow, profile: ProfileRow | undefined): DocumentSearchResult {
  return {
    id: row.id,
    title: row.title,
    document_key: row.document_key,
    status: row.status,
    owner_id: row.owner_id,
    owner_name: profile?.full_name ?? "Unknown owner",
    owner_email: profile?.email ?? "",
    updated_at: row.updated_at,
  };
}

export async function searchDocuments(query: string): Promise<DocumentSearchResult[]> {
  const term = sanitizeTerm(query);
  if (term.length < 2) return [];

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") return [];

  const db = untypedDatabase(supabase);
  const select = "id, title, document_key, status, owner_id, updated_at";

  // Status matching: a term like "awaiting" should hit status values too.
  const statusMatches = DOCUMENT_STATUSES.filter((s) =>
    s.replace(/_/g, " ").includes(term.toLowerCase()),
  );
  const statusFilter = statusMatches.length > 0
    ? `,status.in.(${statusMatches.join(",")})`
    : "";

  // Pass 1: title / catalog key / status on the documents spine itself.
  const { data: byDocument, error: docErr } = await db
    .from<SearchRow[]>("documents")
    .select(select)
    .is("form_key", null)
    .not("owner_id", "is", null)
    .or(`title.ilike.%${term}%,document_key.ilike.%${term}%${statusFilter}`)
    .order("updated_at", { ascending: false })
    .limit(RESULT_LIMIT);

  if (docErr) {
    console.error("[search-actions] document search error:", docErr.message);
  }

  // Pass 2: owner name → that owner's documents. PostgREST cannot OR across
  // a joined table, so resolve matching profiles first.
  const { data: matchingProfiles } = await db
    .from<Array<{ id: string }>>("profiles")
    .select("id")
    .ilike("full_name", `%${term}%`)
    .limit(10);

  let byOwner: SearchRow[] = [];
  const ownerIds = (matchingProfiles ?? []).map((p) => p.id);
  if (ownerIds.length > 0) {
    const { data, error } = await db
      .from<SearchRow[]>("documents")
      .select(select)
      .is("form_key", null)
      .in("owner_id", ownerIds)
      .order("updated_at", { ascending: false })
      .limit(RESULT_LIMIT);
    if (error) {
      console.error("[search-actions] owner search error:", error.message);
    }
    byOwner = data ?? [];
  }

  const seen = new Set<string>();
  const rows: SearchRow[] = [];
  for (const row of [...(byDocument ?? []), ...byOwner]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    rows.push(row);
    if (rows.length >= RESULT_LIMIT) break;
  }

  // Resolve owner names/emails for the merged set.
  const resolveIds = [...new Set(rows.map((r) => r.owner_id))];
  const profilesById = new Map<string, ProfileRow>();
  if (resolveIds.length > 0) {
    const { data: ownerProfiles } = await db
      .from<ProfileRow[]>("profiles")
      .select("id, full_name, email")
      .in("id", resolveIds);
    for (const p of ownerProfiles ?? []) profilesById.set(p.id, p);
  }

  return rows.map((row) => toResult(row, profilesById.get(row.owner_id)));
}
