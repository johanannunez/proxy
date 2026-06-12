import type { OrgPlanTier } from "@/types/organizations";

/**
 * Pure org-subscription mapping logic (Sub-phase B3).
 *
 * Kept free of Stripe SDK and Supabase imports so it unit-tests without any
 * network or mocks. The impure wrapper that talks to the database lives in
 * `org-billing.ts`; the webhook route calls that wrapper.
 */

export type StripePriceEnv = {
  proPriceId: string | null;
  whiteLabelPriceId: string | null;
};

/** Structural subset of Stripe.Subscription that this module reads. */
export type OrgSubscriptionLike = {
  id: string;
  status: string;
  /** Stripe customer id, when expanded to a plain id. */
  customer?: string;
  metadata?: Record<string, string | undefined> | null;
  items?: { data?: Array<{ price?: { id?: string | null } | null }> } | null;
};

export function planTierForPriceId(
  priceId: string | null | undefined,
  env: StripePriceEnv,
): Extract<OrgPlanTier, "pro" | "white_label"> | null {
  if (!priceId) return null;
  if (env.proPriceId && priceId === env.proPriceId) return "pro";
  if (env.whiteLabelPriceId && priceId === env.whiteLabelPriceId) {
    return "white_label";
  }
  return null;
}

export type OrgSubscriptionUpdate = {
  orgId: string;
  update: {
    stripe_subscription_id: string | null;
    stripe_customer_id?: string;
    plan_tier?: OrgPlanTier;
  };
};

const ENDED_STATUSES = new Set(["canceled", "incomplete_expired"]);
const ENTITLED_STATUSES = new Set(["active", "trialing"]);

/**
 * Decides what (if anything) to write back to the organizations row for a
 * subscription event. Returns null for subscriptions that do not belong to
 * an org (e.g. legacy per-owner workspace subscriptions).
 *
 * Rules:
 * - canceled/expired: downgrade to starter, detach the subscription.
 * - active/trialing with a recognized price: set the matching tier.
 * - anything else (past_due, unpaid, incomplete, unknown price): record the
 *   subscription id but leave the tier alone. Dunning grace is Stripe's job;
 *   we only downgrade on a definitive cancellation.
 */
export function orgUpdateForSubscription(
  sub: OrgSubscriptionLike,
  env: StripePriceEnv,
): OrgSubscriptionUpdate | null {
  const orgId = sub.metadata?.org_id;
  if (!orgId) return null;

  if (ENDED_STATUSES.has(sub.status)) {
    return {
      orgId,
      update: { stripe_subscription_id: null, plan_tier: "starter" },
    };
  }

  const priceId = sub.items?.data?.[0]?.price?.id ?? null;
  const tier = planTierForPriceId(priceId, env);

  const base: OrgSubscriptionUpdate["update"] = {
    stripe_subscription_id: sub.id,
    // Checkout-created subscriptions are how an org first gets a customer;
    // capture it so the billing page and portal work afterwards.
    ...(sub.customer ? { stripe_customer_id: sub.customer } : {}),
  };

  if (tier && ENTITLED_STATUSES.has(sub.status)) {
    return { orgId, update: { ...base, plan_tier: tier } };
  }

  return { orgId, update: base };
}

export function stripePriceEnv(): StripePriceEnv {
  return {
    proPriceId: process.env.STRIPE_PRO_PRICE_ID ?? null,
    whiteLabelPriceId: process.env.STRIPE_WHITE_LABEL_PRICE_ID ?? null,
  };
}
