import { createServiceClient } from "@/lib/supabase/service";
import { untypedDatabase } from "@/lib/supabase/untyped";
import {
  isPortalNotificationEnabled,
  preferencesFromRow,
  type OwnerNotificationPreferenceRow,
} from "@/lib/portal/notification-preferences";

async function ownerAllowsNotification(ownerId: string, type: NotificationType): Promise<boolean> {
  const svc = createServiceClient();
  const db = untypedDatabase(svc);
  const { data } = await db
    .from<OwnerNotificationPreferenceRow>("owner_notification_preferences")
    .select("owner_id, portal_messages, announcements, account_alerts, financial_documents")
    .eq("owner_id", ownerId)
    .maybeSingle();

  return isPortalNotificationEnabled(type, preferencesFromRow(data));
}

/**
 * Create an in-app notification for an owner.
 * Fire-and-forget: does not throw on failure.
 *
 * Use this from server actions when something happens that the
 * owner should know about (block request approved, payout processed,
 * new message received, etc.).
 */
export async function createNotification(args: {
  ownerId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
}) {
  const allowed = await ownerAllowsNotification(args.ownerId, args.type);
  if (!allowed) return;

  const svc = createServiceClient();

  const { error } = await svc.from("notifications").insert({
    owner_id: args.ownerId,
    type: args.type,
    title: args.title,
    body: args.body,
    link: args.link ?? null,
  });

  if (error) {
    console.error("[Notifications] Failed to create notification:", error);
  }
}

/**
 * Create a notification for all owners (e.g., system-wide announcement).
 */
export async function createNotificationForAllOwners(args: {
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
}) {
  const svc = createServiceClient();

  const { data: owners } = await svc
    .from("profiles")
    .select("id")
    .eq("role", "owner");

  if (!owners?.length) return;

  const allowedOwners = (
    await Promise.all(
      owners.map(async (owner) => ({
        id: owner.id,
        allowed: await ownerAllowsNotification(owner.id, args.type),
      })),
    )
  ).filter((owner) => owner.allowed);

  if (allowedOwners.length === 0) return;

  const rows = allowedOwners.map((owner) => ({
    owner_id: owner.id,
    type: args.type,
    title: args.title,
    body: args.body,
    link: args.link ?? null,
  }));

  const { error } = await svc.from("notifications").insert(rows);

  if (error) {
    console.error("[Notifications] Failed to create bulk notifications:", error);
  }
}

export type NotificationType =
  | "message_received"
  | "announcement"
  | "block_approved"
  | "block_denied"
  | "payout_processed"
  | "receipt_available"
  | "new_booking"
  | "setup_reminder";
