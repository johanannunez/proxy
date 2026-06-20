import "server-only";
import { PostHog } from "posthog-node";

/**
 * Server-side PostHog product-event capture.
 *
 * The browser (PostHogProvider) only emits $pageview. This adds named product
 * events from server actions and webhooks — the activation-funnel signals the
 * M3 super-admin growth surface is built on (signup, invite, sign, payment,
 * churn). Uses the same project key + host as the client so events land on the
 * same person when the distinct_id is the Supabase user id.
 *
 * Serverless correctness: Vercel functions freeze between requests, so a
 * fire-and-forget capture would be lost. We configure flushAt:1 / flushInterval:0
 * and await flush() after each capture so the event is sent before the function
 * suspends. A singleton is safe under Fluid Compute (instances are reused).
 *
 * Analytics must NEVER break a request path: a missing key is a silent no-op and
 * every send is wrapped so a PostHog hiccup cannot throw into business logic.
 */

let client: PostHog | null = null;

function getClient(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  if (!client) {
    client = new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return client;
}

export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  const ph = getClient();
  if (!ph || !distinctId) return;
  try {
    ph.capture({ distinctId, event, properties });
    await ph.flush();
  } catch {
    // Analytics is best-effort and must never break the calling request.
  }
}
