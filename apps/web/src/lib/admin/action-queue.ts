import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ActionQueueItem } from "./action-queue-types";

export type {
  ActionQueueItem,
  ActionQueueItemKind,
  ActionQueuePrimaryAction,
  ActionQueueUrgency,
} from "./action-queue-types";

/**
 * Fetches every document that needs admin attention, ranked by urgency.
 * Backed by the `fetch_admin_action_queue` Postgres function (security
 * definer, admin-gated inside the function), so a single round trip covers
 * declined signatures, stuck reviews, expirations, countersignatures, and
 * overdue unsigned documents.
 */
export async function fetchActionQueue(): Promise<ActionQueueItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    // Generated Supabase types predate this function; the cast scopes the gap
    // to the function name only.
    "fetch_admin_action_queue" as never,
  );
  if (error) {
    console.error("[action-queue] fetch error:", error.message);
    return [];
  }
  return (data as unknown as ActionQueueItem[] | null) ?? [];
}
