/**
 * Client-safe types for the admin action queue. The server fetcher lives in
 * action-queue.ts (server-only); client components import from here.
 */

export type ActionQueueItemKind =
  | "declined_signature"
  | "stuck_review"
  | "expiring_document"
  | "pending_countersignature"
  | "overdue_unsigned";

export type ActionQueuePrimaryAction = "resend" | "countersign" | "review" | "remind";

export type ActionQueueUrgency = "high" | "medium" | "low";

export interface ActionQueueItem {
  id: string;
  kind: ActionQueueItemKind;
  owner_id: string;
  owner_name: string;
  owner_avatar_url: string | null;
  document_id: string;
  document_title: string;
  document_key: string;
  days_waiting: number;
  expires_at: string | null;
  primary_action: ActionQueuePrimaryAction;
  urgency: ActionQueueUrgency;
}
