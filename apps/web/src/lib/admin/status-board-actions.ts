"use server";

import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/admin/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { REQUIREMENT_CONFIG } from "@/lib/admin/status-board-config";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;
function db(): DB {
  return createServiceClient() as DB;
}

export type ActionResult = { ok: boolean; error?: string };

// reqKey is used to build DB filters, so it must be a known requirement key.
// Allowlisting against the config (and rejecting anything outside a safe
// charset) removes any path for PostgREST filter injection.
function isValidReqKey(reqKey: string): boolean {
  return (
    /^[a-z0-9_]+$/i.test(reqKey) &&
    Object.prototype.hasOwnProperty.call(REQUIREMENT_CONFIG, reqKey)
  );
}

/**
 * Sets `waived` on all `documents` rows for a workspace + req_key combo.
 * The req_key is matched against coalesce(document_key, form_key, doc_type).
 * This is the "mark not needed / undo" action for the status board.
 */
export async function setRequirementNotNeeded(
  workspaceId: string,
  reqKey: string,
  notNeeded: boolean,
): Promise<ActionResult> {
  try {
    await requireAdminUser();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Auth check failed";
    return { ok: false, error: msg };
  }

  if (!isValidReqKey(reqKey)) {
    return { ok: false, error: "Unknown requirement." };
  }

  // Match rows where coalesce(document_key, form_key, doc_type) = reqKey.
  // PostgREST has no coalesce in filters, so apply the three coalesce branches
  // as separate parameterized updates (.eq/.is encode values safely; no raw
  // filter string is built from user input).
  const updateBranch = (apply: (q: DB) => DB) =>
    apply(db().from("documents").update({ waived: notNeeded }).eq("workspace_id", workspaceId));

  const branches = [
    (q: DB) => q.eq("document_key", reqKey),
    (q: DB) => q.is("document_key", null).eq("form_key", reqKey),
    (q: DB) => q.is("document_key", null).is("form_key", null).eq("doc_type", reqKey),
  ];

  for (const branch of branches) {
    const { error } = await updateBranch(branch);
    if (error) {
      console.error("[status-board-actions] setRequirementNotNeeded:", error.message);
      return { ok: false, error: "Failed to update requirement. Please try again." };
    }
  }

  revalidatePath("/admin/paperwork");

  return { ok: true };
}
