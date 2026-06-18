/* eslint-disable @typescript-eslint/no-explicit-any */
// owner_timeline table is not yet in the generated Supabase types.
import { createServiceClient } from "@/lib/supabase/service";

type TimelineEventParams = {
  ownerId: string;
  eventType: string;
  category:
    | "account"
    | "property"
    | "financial"
    | "calendar"
    | "document"
    | "communication";
  title: string;
  body?: string;
  propertyId?: string;
  visibility?: "owner" | "admin_only";
  isPinned?: boolean;
  icon?: string;
  metadata?: Record<string, unknown>;
  createdBy?: string;
  publishAt?: string;
};

type TimelineResult = { ok: boolean; error?: string };

const NOTIFICATION_CONFIG: Record<
  string,
  { notify: boolean; email: boolean; link: string }
> = {
  // Account
  welcome: { notify: true, email: true, link: "/workspace/home" },
  onboarding_complete: { notify: true, email: false, link: "/workspace/home" },
  profile_updated: { notify: false, email: false, link: "/workspace/account" },
  password_reset: { notify: true, email: false, link: "/workspace/account" },

  // Property
  property_added: { notify: true, email: false, link: "/workspace/properties" },
  property_updated: { notify: true, email: false, link: "/workspace/properties" },
  property_deactivated: {
    notify: true,
    email: false,
    link: "/workspace/properties",
  },

  // Financial
  payout_issued: { notify: true, email: true, link: "/workspace/finances" },
  payout_paid: { notify: true, email: true, link: "/workspace/finances" },

  // Calendar
  booking_created: { notify: true, email: true, link: "/workspace/reserve" },
  booking_cancelled: { notify: true, email: false, link: "/workspace/reserve" },
  block_request_submitted: {
    notify: false,
    email: false,
    link: "/workspace/reserve",
  },
  block_request_approved: {
    notify: true,
    email: false,
    link: "/workspace/reserve",
  },
  block_request_denied: {
    notify: true,
    email: false,
    link: "/workspace/reserve",
  },

  // Document
  document_uploaded: { notify: true, email: false, link: "/workspace/documents" },
  agreement_signed: { notify: true, email: true, link: "/workspace/documents" },

  // Communication
  message_sent: { notify: false, email: false, link: "/workspace/inbox" },
};

export async function logTimelineEvent(
  params: TimelineEventParams,
): Promise<TimelineResult> {
  try {
    const svc = createServiceClient();

    const { error: timelineError } = await (svc as any)
      .from("owner_timeline")
      .insert({
        owner_id: params.ownerId,
        event_type: params.eventType,
        category: params.category,
        title: params.title,
        body: params.body ?? null,
        property_id: params.propertyId ?? null,
        visibility: params.visibility ?? "owner",
        is_pinned: params.isPinned ?? false,
        icon: params.icon ?? null,
        metadata: params.metadata ?? null,
        created_by: params.createdBy ?? null,
        publish_at: params.publishAt ?? null,
      });

    if (timelineError) {
      return { ok: false, error: timelineError.message };
    }

    // Check if this event type should also create a notification
    const config = NOTIFICATION_CONFIG[params.eventType];

    if (config?.notify) {
      const { error: notificationError } = await (svc as any)
        .from("notifications")
        .insert({
          owner_id: params.ownerId,
          type: params.eventType,
          title: params.title,
          body: params.body ?? null,
          link: config.link,
          read: false,
        });

      if (notificationError) {
        console.error(
          `[timeline] notification insert failed for event "${params.eventType}":`,
          notificationError.message,
        );
        // Don't fail the whole function; the timeline entry was saved successfully
      }
    }

    return { ok: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown timeline error";
    console.error("[timeline] logTimelineEvent failed:", message);
    return { ok: false, error: message };
  }
}
