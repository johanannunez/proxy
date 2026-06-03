import * as webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Send a push notification to all of an owner's subscribed devices.
 * Fire-and-forget: does not throw on failure.
 */
export async function sendPushToOwner(args: {
  ownerId: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
}) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    console.warn("[Push] VAPID keys not set, skipping push notification");
    return;
  }

  webpush.setVapidDetails(
    "mailto:hello@myproxyhost.com",
    publicKey,
    privateKey,
  );

  const svc = createServiceClient();
  const { data: subscriptions } = await svc
    .from("push_subscriptions")
    .select("id, endpoint, keys")
    .eq("user_id", args.ownerId);

  if (!subscriptions?.length) return;

  const payload = JSON.stringify({
    title: args.title,
    body: args.body.replace(/<[^>]*>/g, "").slice(0, 100),
    data: { url: args.url ?? "/workspace/inbox" },
    tag: args.tag ?? "proxy-message",
  });

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys as { p256dh: string; auth: string },
          },
          payload,
        );
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        // 410 Gone or 404: subscription expired, clean it up
        if (statusCode === 410 || statusCode === 404) {
          await svc.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }),
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  if (sent > 0) {
    console.log(`[Push] Sent to ${sent}/${subscriptions.length} devices for user ${args.ownerId}`);
  }
}

/**
 * Send a push notification to ALL owners (for broadcasts).
 */
export async function sendPushToAllOwners(args: {
  title: string;
  body: string;
  url?: string;
}) {
  const svc = createServiceClient();
  const { data: owners } = await svc
    .from("profiles")
    .select("id")
    .eq("role", "owner");

  if (!owners?.length) return;

  await Promise.allSettled(
    owners.map((owner) =>
      sendPushToOwner({
        ownerId: owner.id,
        title: args.title,
        body: args.body,
        url: args.url,
        tag: "proxy-announcement",
      }),
    ),
  );
}
