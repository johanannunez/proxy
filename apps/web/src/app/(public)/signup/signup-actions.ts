"use server";

import "server-only";

import { headers } from "next/headers";
import type Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { untypedDatabase } from "@/lib/supabase/untyped";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { isValidOrgSlug } from "@/lib/agencies/slug";
import { PLAN_FEATURES, PLAN_LIMITS } from "@/lib/agencies/features";
import { captureServerEvent } from "@/lib/analytics";
import type { AgencyPlanTier } from "@/types/agencies";
import type {
  CreateOrgResult,
  CreateSubscriptionResult,
} from "./signup-types";

const VALID_TIERS: ReadonlySet<string> = new Set([
  "starter",
  "pro",
  "white_label",
]);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Live subdomain availability check for step 2 of signup.
 * Format and reserved-name rules live in @/lib/agencies/slug so the
 * client can mirror them instantly; this action is the authoritative check
 * against existing agencies.
 */
export async function checkSubdomainAvailability(
  slug: string,
): Promise<{ available: boolean }> {
  const normalized = slug.trim().toLowerCase();
  if (!isValidOrgSlug(normalized)) {
    return { available: false };
  }

  // agencies rows are not anonymously readable under RLS, so the
  // existence check runs through the service client. Only a boolean leaves
  // this function.
  const supabase = createServiceClient();
  const { data } = await untypedDatabase(supabase)
    .from<{ id: string }>("agencies")
    .select("id")
    .eq("slug", normalized)
    .maybeSingle();

  return { available: !data };
}

/**
 * Final submit of the signup flow: creates the auth user, the agency,
 * the org_owner membership, and seeds branding + settings for the plan.
 *
 * Auth goes through the cookie-writing SSR client (sessions must be scoped
 * via authCookieDomain). Agency writes go through the service client
 * because agencies tables only allow service-role writes under RLS.
 */
export async function createOrganization(params: {
  name: string;
  slug: string;
  planTier: AgencyPlanTier;
  ownerEmail: string;
  ownerName: string;
  ownerPassword: string;
}): Promise<CreateOrgResult> {
  const name = params.name.trim();
  const slug = params.slug.trim().toLowerCase();
  const ownerEmail = params.ownerEmail.trim().toLowerCase();
  const ownerName = params.ownerName.trim();

  if (!name) {
    return failure("Please enter your company name.");
  }
  if (!isValidOrgSlug(slug)) {
    return failure("That subdomain is not available. Pick another one.");
  }
  if (!VALID_TIERS.has(params.planTier)) {
    return failure("Pick a plan to continue.");
  }
  if (!EMAIL_PATTERN.test(ownerEmail)) {
    return failure("Please enter a valid email address.");
  }
  if (params.ownerPassword.length < 8) {
    return failure("Password must be at least 8 characters.");
  }

  // 1. Create the Supabase auth user (profile row is created by the
  //    on_auth_user_created trigger).
  const supabase = await createClient();
  const headerList = await headers();
  const origin = headerList.get("origin") ?? "https://www.myproxyhost.com";

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: ownerEmail,
    password: params.ownerPassword,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: { full_name: ownerName || null },
    },
  });

  if (authError) {
    return failure(authError.message);
  }
  const user = authData.user;
  if (!user) {
    return failure("We could not create your account. Please try again.");
  }
  // Supabase returns a user with no identities when the email is already
  // registered (to avoid leaking account existence via error messages).
  if (user.identities && user.identities.length === 0) {
    return failure(
      "An account with this email already exists. Log in instead.",
    );
  }

  const service = createServiceClient();
  const db = untypedDatabase(service);

  // 2. Create the agency.
  const { data: org, error: orgError } = await db
    .from<{ id: string }>("agencies")
    .insert({ name, slug, plan_tier: params.planTier })
    .select("id")
    .single();

  if (orgError || !org) {
    if (orgError?.code === "23505") {
      return failure("That subdomain was just taken. Pick another one.");
    }
    console.error("[signup] agency insert failed:", orgError?.message);
    return failure("We could not create your workspace. Please try again.");
  }

  // 3. Owner membership + 4. seed branding and settings. If any of these
  //    fail, roll the agency back (cascade removes the partial rows) so a retry
  //    can reuse the slug.
  const { error: memberError } = await db
    .from("agency_members")
    .insert({ agency_id: org.id, profile_id: user.id, role: "org_owner" });

  const { error: brandingError } = memberError
    ? { error: memberError }
    : await db.from("organization_branding").insert({ agency_id: org.id });

  const { error: settingsError } = brandingError
    ? { error: brandingError }
    : await db.from("organization_settings").insert({
        agency_id: org.id,
        features: PLAN_FEATURES[params.planTier],
        limits: PLAN_LIMITS[params.planTier],
      });

  const seedError = memberError ?? brandingError ?? settingsError;
  if (seedError) {
    console.error("[signup] agency seed failed:", seedError.message);
    await db.from("agencies").delete().eq("id", org.id);
    return failure("We could not finish setting up your workspace. Please try again.");
  }

  // Activation-funnel signals (M3). The account and its agency are created
  // together here, so both milestones fire with the new user as distinct_id and
  // the agency as a property. Best-effort; never blocks signup.
  await captureServerEvent(
    user.id,
    "signup",
    { agency_id: org.id, plan_tier: params.planTier },
    { agency: org.id },
  );
  await captureServerEvent(
    user.id,
    "workspace_created",
    { agency_id: org.id, plan_tier: params.planTier },
    { agency: org.id },
  );

  // 5. Paid plans attach Stripe in createStripeSubscription (step 4).
  return {
    orgId: org.id,
    requiresEmailConfirmation: !authData.session,
  };
}

function failure(error: string): CreateOrgResult {
  return { orgId: "", requiresEmailConfirmation: false, error };
}

/**
 * Creates the Stripe customer + subscription for a paid plan (step 4).
 * Returns the payment intent client secret when the first invoice needs
 * on-session confirmation (3DS or initial card charge).
 */
export async function createStripeSubscription(params: {
  orgId: string;
  planTier: "pro" | "white_label";
  paymentMethodId: string;
}): Promise<CreateSubscriptionResult> {
  // Server actions are directly callable endpoints: without this gate any
  // caller could attach payment methods or rewrite Stripe ids on an arbitrary
  // agency. The signup flow always has the org_owner membership in place before
  // step 4 (createOrganization seeds it), so legitimate callers pass.
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) {
    return {
      subscriptionId: "",
      error: "Your session expired. Log in and upgrade from Settings.",
    };
  }

  const membershipDb = untypedDatabase(createServiceClient());
  const { data: membership } = await membershipDb
    .from<{ role: string }>("agency_members")
    .select("role")
    .eq("agency_id", params.orgId)
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!membership || !["org_owner", "org_admin"].includes(membership.role)) {
    return {
      subscriptionId: "",
      error: "You are not authorized to manage billing for this workspace.",
    };
  }

  if (!isStripeConfigured()) {
    return {
      subscriptionId: "",
      error:
        "Card payments are not configured yet. Your workspace is ready on the Starter plan; upgrade from Settings once billing goes live.",
    };
  }

  const priceId =
    params.planTier === "pro"
      ? process.env.STRIPE_PRO_PRICE_ID
      : process.env.STRIPE_WHITE_LABEL_PRICE_ID;
  if (!priceId) {
    return {
      subscriptionId: "",
      error:
        "This plan is not available for self-serve checkout yet. Your workspace is ready on the Starter plan; upgrade from Settings once billing goes live.",
    };
  }

  const service = createServiceClient();
  const db = untypedDatabase(service);

  const { data: org } = await db
    .from<{ id: string; name: string; stripe_customer_id: string | null }>(
      "agencies",
    )
    .select("id, name, stripe_customer_id")
    .eq("id", params.orgId)
    .maybeSingle();
  if (!org) {
    return { subscriptionId: "", error: "Workspace not found." };
  }

  try {
    const stripe = getStripe();

    // Create (or reuse) the customer.
    let customerId = org.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: org.name,
        metadata: { org_id: params.orgId },
      });
      customerId = customer.id;
    }

    // Attach the payment method and make it the default.
    await stripe.paymentMethods.attach(params.paymentMethodId, {
      customer: customerId,
    });
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: params.paymentMethodId },
    });

    // Create the subscription. metadata.org_id is what the webhook uses to
    // keep agencies.plan_tier in sync for the rest of the lifecycle.
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      expand: ["latest_invoice.confirmation_secret"],
      metadata: { org_id: params.orgId },
    });

    const { error: updateError } = await db
      .from("agencies")
      .update({
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
      })
      .eq("id", params.orgId);
    if (updateError) {
      console.error(
        "[signup] failed to store Stripe ids on agency:",
        updateError.message,
      );
    }

    const invoice = subscription.latest_invoice as Stripe.Invoice | null;
    const clientSecret = invoice?.confirmation_secret?.client_secret;

    return {
      subscriptionId: subscription.id,
      clientSecret: clientSecret ?? undefined,
    };
  } catch (err) {
    console.error("[signup] Stripe subscription failed:", err);
    return {
      subscriptionId: "",
      error:
        "We could not start your subscription. Your card was not charged; please try again.",
    };
  }
}
