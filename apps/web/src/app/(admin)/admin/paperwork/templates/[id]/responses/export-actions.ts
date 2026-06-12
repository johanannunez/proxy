"use server";

/**
 * CSV export for the unified form-responses view. Re-queries server-side with
 * the caller's filters so the export always matches the filtered table, then
 * returns the CSV string for the client to download. Admin-gated.
 */
import { createClient } from "@/lib/supabase/server";
import { listAllFormResponses } from "@/lib/admin/forms";
import {
  buildResponsesCSV,
  filterResponses,
  type ResponseFilters,
} from "@/lib/admin/responses-csv";

export type ExportResult = { ok: true; csv: string } | { ok: false; error: string };

export async function exportResponsesCSV(filters: ResponseFilters): Promise<ExportResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") return { ok: false, error: "Admin access required." };

  const rows = await listAllFormResponses();
  return { ok: true, csv: buildResponsesCSV(filterResponses(rows, filters)) };
}
