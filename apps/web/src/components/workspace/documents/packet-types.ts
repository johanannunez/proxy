/**
 * Client-safe types shared by the workspace document packet experience
 * (DocumentPacket, PacketStepper, DocumentTimeline, CompletionCelebration).
 * No server-only imports — these are consumed by client components and tests.
 */
import type { DocumentDisplayStatus } from "@/lib/documents/status";

/** The action an owner can take on a packet item right now. */
export type PacketItemAction = "upload" | "fill" | "sign" | "view" | "waiting";

/**
 * One document inside a packet. The required trio (status, document_key, title)
 * is the minimal shape; the optional fields let the stepper render the full
 * detail view when the hub passes complete HubItem-derived data.
 */
export type PacketItem = {
  status: DocumentDisplayStatus;
  document_key: string | null;
  title: string;
  id?: string;
  description?: string;
  statusLabel?: string;
  action?: PacketItemAction;
  href?: string | null;
  fileUrl?: string | null;
  propertyLabel?: string | null;
  lockedReason?: string | null;
  isUrgent?: boolean;
  completedAt?: string | null;
  expiresAt?: string | null;
  /** Lifecycle history for the collapsible activity timeline, when known. */
  events?: TimelineEvent[];
};

/** Lifecycle moments rendered by the per-document activity timeline. */
export type TimelineEventKind =
  | "created"
  | "sent"
  | "viewed"
  | "signed"
  | "countersigned"
  | "on_file"
  | "declined"
  | "expired";

export type TimelineEvent = {
  event: TimelineEventKind;
  timestamp: string; // ISO timestamp
  actor?: string; // "Proxy" | owner name
  note?: string;
};

/** Terminal complete state for a packet item. */
export function isPacketItemComplete(item: PacketItem): boolean {
  return item.status === "on_file";
}

/** Count of completed items in a packet. */
export function packetCompletion(items: PacketItem[]): { complete: number; total: number } {
  return {
    complete: items.filter(isPacketItemComplete).length,
    total: items.length,
  };
}

/** Items where the owner has something to do right now (drives urgency copy). */
export function packetAttentionCount(items: PacketItem[]): number {
  return items.filter(
    (i) =>
      i.status === "needed" ||
      i.status === "action_required" ||
      i.status === "expired" ||
      i.status === "sent",
  ).length;
}
