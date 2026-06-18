import "server-only";
/**
 * Request ↔ spine completion sync. When an owner completes a document (the spine
 * row reaches `on_file`), this flips the matching workspace_request_items to
 * `completed` and rolls the parent workspace_request up to `partially_completed`
 * or `completed`. This is what makes an admin's "request" reflect reality instead
 * of sitting at "sent" forever.
 *
 * Server-only: uses the service client to update across the workspace.
 */
import { createServiceClient } from "@/lib/supabase/service";
import { isComplete, normalizeStatus } from "./status";

const ACTIVE_REQUEST_STATUSES = ["sent", "viewed", "partially_completed"];

type RequestRow = { id: string; status: string };
type ItemRow = { id: string; request_id: string; document_key: string | null; document_id: string | null; status: string };
type DocRow = { id: string; document_key: string | null; status: string };

export async function reconcileWorkspaceRequests(workspaceId: string): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any;

    const { data: requestsData } = await db
      .from("workspace_requests")
      .select("id, status")
      .eq("workspace_id", workspaceId)
      .in("status", ACTIVE_REQUEST_STATUSES);
    const requests = (requestsData ?? []) as RequestRow[];
    if (requests.length === 0) return;

    const requestIds = requests.map((r) => r.id);
    const { data: itemsData } = await db
      .from("workspace_request_items")
      .select("id, request_id, document_key, document_id, status")
      .in("request_id", requestIds);
    const items = (itemsData ?? []) as ItemRow[];
    if (items.length === 0) return;

    // Which documents in this workspace are complete (on file)?
    const { data: docsData } = await db
      .from("documents")
      .select("id, document_key, status")
      .eq("workspace_id", workspaceId);
    const completedKeys = new Set<string>();
    const completedIds = new Set<string>();
    for (const d of (docsData ?? []) as DocRow[]) {
      if (isComplete(normalizeStatus(d.status))) {
        if (d.document_key) completedKeys.add(d.document_key);
        completedIds.add(d.id);
      }
    }

    const now = new Date().toISOString();

    // Flip open items whose linked/keyed document is complete.
    for (const item of items) {
      if (item.status === "completed") continue;
      const done =
        (item.document_id && completedIds.has(item.document_id)) ||
        (item.document_key !== null && completedKeys.has(item.document_key));
      if (done) {
        await db.from("workspace_request_items").update({ status: "completed", completed_at: now }).eq("id", item.id);
        item.status = "completed";
      }
    }

    // Roll each request up to partially_completed / completed.
    for (const request of requests) {
      const reqItems = items.filter((i) => i.request_id === request.id);
      if (reqItems.length === 0) continue;
      const allDone = reqItems.every((i) => i.status === "completed");
      const anyDone = reqItems.some((i) => i.status === "completed");
      const next = allDone ? "completed" : anyDone ? "partially_completed" : request.status;
      if (next !== request.status) {
        await db
          .from("workspace_requests")
          .update({ status: next, ...(allDone ? { completed_at: now } : {}) })
          .eq("id", request.id);
      }
    }
  } catch (err) {
    console.error("[requests] reconcileWorkspaceRequests failed:", err instanceof Error ? err.message : err);
  }
}
