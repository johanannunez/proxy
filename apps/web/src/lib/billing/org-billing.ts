import "server-only";
import type Stripe from "stripe";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { untypedDatabase } from "@/lib/supabase/untyped";
import type { Organization } from "@/types/organizations";
import {
  orgUpdateForSubscription,
  stripePriceEnv,
} from "./org-billing-core";
import type {
  OrgBillingSummary,
  OrgInvoiceSummary,
} from "./org-billing-types";

/**
 * Webhook-side sync: keeps organizations.plan_tier and
 * organizations.stripe_subscription_id aligned with the Stripe subscription
 * lifecycle. Decision logic is pure (org-billing-core.ts); this wrapper only
 * performs the database write with the service client, since organizations
 * rows are not writable under RLS.
 */
export async function syncOrgSubscriptionFromStripe(
  sub: Stripe.Subscription,
): Promise<void> {
  const decision = orgUpdateForSubscription(
    {
      id: sub.id,
      status: sub.status,
      customer: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
      metadata: sub.metadata ?? null,
      items: { data: sub.items?.data?.map((item) => ({ price: { id: item.price?.id ?? null } })) ?? [] },
    },
    stripePriceEnv(),
  );
  if (!decision) return;

  const supabase = createServiceClient();
  const { error } = await untypedDatabase(supabase)
    .from("organizations")
    .update(decision.update)
    .eq("id", decision.orgId);
  if (error) {
    console.error(
      "[org-billing] failed to sync subscription",
      sub.id,
      error.message,
    );
  }
}

export async function fetchOrgForBilling(
  orgId: string,
): Promise<Organization | null> {
  const supabase = createServiceClient();
  const { data } = await untypedDatabase(supabase)
    .from<Organization>("organizations")
    .select("*")
    .eq("id", orgId)
    .maybeSingle();
  return data;
}

/**
 * Billing summary for /admin/settings/billing. Every Stripe call degrades to
 * null/empty so the page renders cleanly when billing is not configured or
 * the org has no Stripe customer yet (Starter orgs).
 */
export async function fetchOrgBillingSummary(
  orgId: string,
): Promise<OrgBillingSummary | null> {
  const org = await fetchOrgForBilling(orgId);
  if (!org) return null;

  const summary: OrgBillingSummary = {
    orgId: org.id,
    orgName: org.name,
    orgSlug: org.slug,
    planTier: org.plan_tier,
    hasStripeCustomer: Boolean(org.stripe_customer_id),
    stripeConfigured: isStripeConfigured(),
    nextInvoice: null,
    invoices: [],
  };

  if (!org.stripe_customer_id || !summary.stripeConfigured) {
    return summary;
  }

  const stripe = getStripe();

  try {
    if (org.stripe_subscription_id) {
      const preview = await stripe.invoices.createPreview({
        customer: org.stripe_customer_id,
        subscription: org.stripe_subscription_id,
      });
      const dueTs = preview.next_payment_attempt ?? preview.period_end;
      summary.nextInvoice = {
        amountCents: preview.amount_due ?? 0,
        currency: preview.currency ?? "usd",
        date: dueTs ? new Date(dueTs * 1000).toISOString() : null,
      };
    }
  } catch (err) {
    console.error("[org-billing] upcoming invoice preview failed:", err);
  }

  try {
    const list = await stripe.invoices.list({
      customer: org.stripe_customer_id,
      limit: 10,
    });
    summary.invoices = list.data
      .filter((inv): inv is Stripe.Invoice & { id: string } => Boolean(inv.id))
      .map(
        (inv): OrgInvoiceSummary => ({
          id: inv.id,
          number: inv.number ?? null,
          status: inv.status ?? "open",
          amountCents: inv.amount_due ?? 0,
          currency: inv.currency ?? "usd",
          createdAt: new Date(inv.created * 1000).toISOString(),
          hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
        }),
      );
  } catch (err) {
    console.error("[org-billing] invoice list failed:", err);
  }

  return summary;
}
