"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { untypedDatabase } from "@/lib/supabase/untyped";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { fetchOrgForBilling } from "@/lib/billing/org-billing";
import { PROXY_ORG_ID } from "@/types/organizations";

type RedirectResult = { url?: string; error?: string };

/**
 * Server actions are directly callable endpoints, so each one re-checks that
 * the caller is allowed to manage this org's billing: either Proxy staff
 * (profiles.role = admin) or an org_owner/org_admin member of the org.
 */
async function requireBillingAccess(orgId: string): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "You need to be signed in.";

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role === "admin") return null;

  const service = createServiceClient();
  const { data: membership } = await untypedDatabase(service)
    .from<{ role: string }>("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("profile_id", user.id)
    .maybeSingle();

  if (membership && ["org_owner", "org_admin"].includes(membership.role)) {
    return null;
  }
  return "You do not have permission to manage billing for this workspace.";
}

async function resolveOrgId(): Promise<string> {
  const headerList = await headers();
  return headerList.get("x-org-id") ?? PROXY_ORG_ID;
}

async function resolveOrigin(): Promise<string> {
  const headerList = await headers();
  const origin = headerList.get("origin");
  if (origin) return origin;
  const host = headerList.get("host") ?? "www.myproxyhost.com";
  const protocol = host.startsWith("localhost") || host.startsWith("127.")
    ? "http"
    : "https";
  return `${protocol}://${host}`;
}

/** Stripe Customer Portal redirect for payment method management. */
export async function createBillingPortalSession(): Promise<RedirectResult> {
  const orgId = await resolveOrgId();
  const denied = await requireBillingAccess(orgId);
  if (denied) return { error: denied };

  if (!isStripeConfigured()) {
    return { error: "Billing is not configured yet." };
  }

  const org = await fetchOrgForBilling(orgId);
  if (!org?.stripe_customer_id) {
    return {
      error:
        "No payment method on file yet. Upgrade to a paid plan to add one.",
    };
  }

  try {
    const origin = await resolveOrigin();
    const session = await getStripe().billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${origin}/admin/settings/billing`,
    });
    return { url: session.url };
  } catch (err) {
    console.error("[billing] portal session failed:", err);
    return { error: "We could not open the billing portal. Try again shortly." };
  }
}

/**
 * Upgrade from the plan modal: a Stripe Checkout session in subscription
 * mode. Checkout collects the payment method, and the webhook
 * (customer.subscription.created with metadata.org_id) flips plan_tier.
 */
export async function startUpgradeCheckout(
  planTier: "pro" | "white_label",
): Promise<RedirectResult> {
  const orgId = await resolveOrgId();
  const denied = await requireBillingAccess(orgId);
  if (denied) return { error: denied };

  if (!isStripeConfigured()) {
    return {
      error:
        "Self-serve upgrades are not live yet. Email hello@myproxyhost.com and we will set you up.",
    };
  }

  const priceId =
    planTier === "pro"
      ? process.env.STRIPE_PRO_PRICE_ID
      : process.env.STRIPE_WHITE_LABEL_PRICE_ID;
  if (!priceId) {
    return {
      error:
        "Self-serve upgrades are not live yet. Email hello@myproxyhost.com and we will set you up.",
    };
  }

  const org = await fetchOrgForBilling(orgId);
  if (!org) return { error: "Workspace not found." };

  try {
    const origin = await resolveOrigin();
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      customer: org.stripe_customer_id ?? undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { metadata: { org_id: orgId } },
      client_reference_id: orgId,
      success_url: `${origin}/admin/settings/billing?upgraded=1`,
      cancel_url: `${origin}/admin/settings/billing`,
    });
    if (!session.url) {
      return { error: "Stripe did not return a checkout link. Try again." };
    }
    return { url: session.url };
  } catch (err) {
    console.error("[billing] upgrade checkout failed:", err);
    return { error: "We could not start the upgrade. Try again shortly." };
  }
}
