import type { AgencyPlanTier } from "@/types/agencies";

/**
 * Pure agency-subscription mapping logic (Sub-phase B3).
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
): Extract<AgencyPlanTier, "pro" | "white_label"> | null {
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
    plan_tier?: AgencyPlanTier;
  };
};

const ENDED_STATUSES = new Set(["canceled", "incomplete_expired"]);
const ENTITLED_STATUSES = new Set(["active", "trialing"]);

/**
 * Decides what (if anything) to write back to the agencies row for a
 * subscription event. Returns null for subscriptions that do not belong to
 * an agency (e.g. legacy per-owner workspace subscriptions).
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
    // Checkout-created subscriptions are how an agency first gets a customer;
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

/** Structural subset of a Stripe subscription item this module reads for MRR. */
export type SubscriptionItemLike = {
  quantity?: number | null;
  price?: {
    unit_amount?: number | null;
    recurring?: { interval?: string | null; interval_count?: number | null } | null;
  } | null;
};

const PERIODS_PER_YEAR: Record<string, number> = {
  day: 365,
  week: 52,
  month: 12,
  year: 1,
};

/**
 * Normalize a subscription's recurring price to a monthly amount in cents (MRR).
 * Used by the Stripe webhook to attach the prior MRR to a `churn` event. Kept
 * pure (structural input, no Stripe SDK) so it unit-tests without mocks; the
 * caller passes `subscription.items.data`.
 */
export function monthlyMrrCents(items: SubscriptionItemLike[]): number {
  let cents = 0;
  for (const item of items) {
    const unit = item.price?.unit_amount ?? 0;
    const quantity = item.quantity ?? 1;
    const interval = item.price?.recurring?.interval ?? "month";
    const intervalCount = item.price?.recurring?.interval_count ?? 1;
    const periodsPerYear = PERIODS_PER_YEAR[interval] ?? 12;
    // amount per year = price-per-period * periods-per-year / interval_count.
    const annual = (unit * quantity * periodsPerYear) / (intervalCount || 1);
    cents += annual / 12;
  }
  return Math.round(cents);
}
