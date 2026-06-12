import { describe, expect, it } from "vitest";
import {
  orgUpdateForSubscription,
  planTierForPriceId,
  type OrgSubscriptionLike,
} from "../org-billing-core";

const PRICES = {
  proPriceId: "price_pro_123",
  whiteLabelPriceId: "price_wl_456",
};

function sub(overrides: Partial<OrgSubscriptionLike>): OrgSubscriptionLike {
  return {
    id: "sub_test",
    status: "active",
    metadata: { org_id: "org-1" },
    items: { data: [{ price: { id: "price_pro_123" } }] },
    ...overrides,
  };
}

describe("planTierForPriceId", () => {
  it("maps the pro price to the pro tier", () => {
    expect(planTierForPriceId("price_pro_123", PRICES)).toBe("pro");
  });

  it("maps the white-label price to the white_label tier", () => {
    expect(planTierForPriceId("price_wl_456", PRICES)).toBe("white_label");
  });

  it("returns null for unknown or missing prices", () => {
    expect(planTierForPriceId("price_other", PRICES)).toBeNull();
    expect(planTierForPriceId(null, PRICES)).toBeNull();
  });

  it("returns null when env price ids are unconfigured", () => {
    expect(
      planTierForPriceId("price_pro_123", { proPriceId: null, whiteLabelPriceId: null }),
    ).toBeNull();
  });
});

describe("orgUpdateForSubscription", () => {
  it("ignores subscriptions without an org_id (legacy owner subscriptions)", () => {
    expect(orgUpdateForSubscription(sub({ metadata: {} }), PRICES)).toBeNull();
  });

  it("upgrades the org tier when an active subscription matches a known price", () => {
    const result = orgUpdateForSubscription(sub({}), PRICES);
    expect(result).toEqual({
      orgId: "org-1",
      update: {
        stripe_subscription_id: "sub_test",
        plan_tier: "pro",
      },
    });
  });

  it("treats trialing like active for tier assignment", () => {
    const result = orgUpdateForSubscription(sub({ status: "trialing" }), PRICES);
    expect(result?.update.plan_tier).toBe("pro");
  });

  it("downgrades to starter and detaches the subscription when canceled", () => {
    const result = orgUpdateForSubscription(sub({ status: "canceled" }), PRICES);
    expect(result).toEqual({
      orgId: "org-1",
      update: {
        stripe_subscription_id: null,
        plan_tier: "starter",
      },
    });
  });

  it("keeps the current tier on past_due (grace period) but records the subscription id", () => {
    const result = orgUpdateForSubscription(sub({ status: "past_due" }), PRICES);
    expect(result).toEqual({
      orgId: "org-1",
      update: { stripe_subscription_id: "sub_test" },
    });
  });

  it("captures the Stripe customer id when the subscription carries one", () => {
    const result = orgUpdateForSubscription(
      sub({ customer: "cus_abc" }),
      PRICES,
    );
    expect(result).toEqual({
      orgId: "org-1",
      update: {
        stripe_subscription_id: "sub_test",
        stripe_customer_id: "cus_abc",
        plan_tier: "pro",
      },
    });
  });

  it("does not change tier when the price is not recognized", () => {
    const result = orgUpdateForSubscription(
      sub({ items: { data: [{ price: { id: "price_unknown" } }] } }),
      PRICES,
    );
    expect(result).toEqual({
      orgId: "org-1",
      update: { stripe_subscription_id: "sub_test" },
    });
  });
});
