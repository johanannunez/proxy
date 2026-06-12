import "server-only";

/**
 * Coverage view data — server fetch for tracked masters. Defensive by
 * design: the tracked/category columns ship in migration
 * 20260612090000_template_tracking. If the migration has not been applied
 * yet, the selects fail with undefined-column errors and Coverage falls
 * back to an empty column set (the view renders its empty state instead of
 * crashing).
 */

import { createServiceClient } from "@/lib/supabase/service";
import type { TrackedTemplate } from "./coverage-shared";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;
function db(): DB {
  return createServiceClient() as DB;
}

type TemplateRow = {
  id: string;
  display_name: string;
  document_key: string | null;
  tracked: boolean | null;
  category: string | null;
};

type FormRow = {
  id: string;
  name: string;
  tracked: boolean | null;
  category: string | null;
  archived_at: string | null;
};

export async function fetchTrackedTemplates(orgId?: string): Promise<TrackedTemplate[]> {
  const tracked: TrackedTemplate[] = [];

  // Signature/PDF masters. Errors (including missing columns pre-migration)
  // degrade to zero columns from this source.
  let templateQuery = db()
    .from("document_templates")
    .select("id, display_name, document_key, tracked, category")
    .eq("tracked", true)
    .eq("is_active", true);
  templateQuery = orgId
    ? templateQuery.or(`org_id.is.null,org_id.eq.${orgId}`)
    : templateQuery.is("org_id", null);
  const { data: templateRows, error: templateError } = await templateQuery;
  if (templateError) {
    console.error("[coverage] tracked templates:", templateError.message);
  } else {
    for (const row of (templateRows ?? []) as TemplateRow[]) {
      tracked.push({
        id: row.id,
        source: "document_template",
        name: row.display_name,
        documentKey: row.document_key,
        tracked: row.tracked ?? false,
        category: row.category ?? null,
      });
    }
  }

  // Form masters (org-scoped). Same defensive posture.
  if (orgId) {
    const { data: formRows, error: formError } = await db()
      .from("forms")
      .select("id, name, tracked, category, archived_at")
      .eq("org_id", orgId)
      .eq("tracked", true);
    if (formError) {
      console.error("[coverage] tracked forms:", formError.message);
    } else {
      for (const row of (formRows ?? []) as FormRow[]) {
        if (row.archived_at !== null) continue;
        tracked.push({
          id: row.id,
          source: "form",
          name: row.name,
          documentKey: null,
          tracked: row.tracked ?? false,
          category: row.category ?? null,
        });
      }
    }
  }

  return tracked;
}
