import "server-only";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

let _stripe: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return (
    typeof process.env.STRIPE_SECRET_KEY === "string" &&
    process.env.STRIPE_SECRET_KEY.length > 0
  );
}

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    // Pinning to the SDK-bundled default API version keeps types aligned
    // with @types/stripe. Bump when the SDK is upgraded.
    _stripe = new Stripe(key, { apiVersion: "2026-03-25.dahlia" });
  }
  return _stripe;
}

/**
 * Ensures a Stripe Customer exists for the given Proxy profile.
 * Creates one if missing, otherwise returns the existing stripe_customer_id.
 */
export async function ensureStripeCustomer(profileId: string): Promise<string> {
  // We intentionally use the RLS-scoped client. Admin callers are already
  // gated in their action; end-owner callers only see their own row.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const supabase = (await createClient()) as any;

  const { data: existing } = await supabase
    .from("stripe_customers")
    .select("stripe_customer_id")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (existing?.stripe_customer_id) return existing.stripe_customer_id as string;

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", profileId)
    .single();
  if (!profile) throw new Error(`Profile ${profileId} not found`);

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: profile.email ?? undefined,
    name: profile.full_name ?? undefined,
    metadata: { proxy_profile_id: profileId },
  });

  const { error: insertError } = await supabase.from("stripe_customers").insert({
    profile_id: profileId,
    stripe_customer_id: customer.id,
    email: profile.email,
  });
  if (insertError) throw insertError;

  return customer.id;
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

export type InvoiceLineInput = {
  description: string;
  amount_cents: number;
  quantity?: number;
};

export type InvoiceKind = "onboarding_fee" | "tech_fee" | "adhoc";

/**
 * Creates and finalizes a one-time Stripe Invoice for the given owner.
 * Returns the synced local invoice row id + hosted URL.
 */
export async function createOneTimeInvoice(params: {
  ownerId: string;
  propertyId?: string | null;
  kind?: InvoiceKind;
  description?: string;
  lines: InvoiceLineInput[];
  dueInDays?: number;
  createdBy?: string | null;
}): Promise<{ invoiceId: string; hostedInvoiceUrl: string | null }> {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const supabase = (await createClient()) as any;
  const stripe = getStripe();
  const customerId = await ensureStripeCustomer(params.ownerId);

  const draft = await stripe.invoices.create({
    customer: customerId,
    collection_method: "send_invoice",
    days_until_due: params.dueInDays ?? 14,
    description: params.description,
    metadata: {
      proxy_owner_id: params.ownerId,
      proxy_property_id: params.propertyId ?? "",
      proxy_kind: params.kind ?? "adhoc",
    },
  });

  if (!draft.id) throw new Error("Stripe did not return an invoice id");

  for (const line of params.lines) {
    await stripe.invoiceItems.create({
      customer: customerId,
      invoice: draft.id,
      amount: line.amount_cents,
      currency: "usd",
      description: line.description,
      quantity: line.quantity ?? 1,
    });
  }

  const finalized = await stripe.invoices.finalizeInvoice(draft.id);

  const totalCents = params.lines.reduce(
    (sum, l) => sum + l.amount_cents * (l.quantity ?? 1),
    0,
  );

  const { data: row, error } = await supabase
    .from("invoices")
    .insert({
      owner_id: params.ownerId,
      property_id: params.propertyId ?? null,
      stripe_invoice_id: finalized.id,
      kind: params.kind ?? "adhoc",
      amount_cents: totalCents,
      currency: "usd",
      status: "open",
      due_at: finalized.due_date
        ? new Date(finalized.due_date * 1000).toISOString()
        : null,
      hosted_invoice_url: finalized.hosted_invoice_url ?? null,
      description: params.description ?? null,
      created_by: params.createdBy ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;

  for (const line of params.lines) {
    const { error: itemErr } = await supabase.from("invoice_items").insert({
      invoice_id: row.id,
      description: line.description,
      amount_cents: line.amount_cents,
      quantity: line.quantity ?? 1,
    });
    if (itemErr) throw itemErr;
  }

  return {
    invoiceId: row.id as string,
    hostedInvoiceUrl: finalized.hosted_invoice_url ?? null,
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

/**
 * Upserts a local invoices row from a Stripe Invoice object (used by webhooks).
 */
export async function syncInvoiceFromStripe(inv: Stripe.Invoice) {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const supabase = (await createClient()) as any;

  const status:
    | "draft"
    | "open"
    | "paid"
    | "uncollectible"
    | "void" =
    inv.status === "draft"
      ? "draft"
      : inv.status === "open"
        ? "open"
        : inv.status === "paid"
          ? "paid"
          : inv.status === "uncollectible"
            ? "uncollectible"
            : "void";

  const update = {
    status,
    amount_cents: inv.amount_due ?? 0,
    paid_at: inv.status_transitions?.paid_at
      ? new Date(inv.status_transitions.paid_at * 1000).toISOString()
      : null,
    hosted_invoice_url: inv.hosted_invoice_url ?? null,
    updated_at: new Date().toISOString(),
  };

  if (!inv.id) return;
  await supabase
    .from("invoices")
    .update(update)
    .eq("stripe_invoice_id", inv.id);
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

/**
 * Stripe SDK v22 (API 2026-03-25.dahlia) moves `current_period_end` off the
 * top-level Subscription onto each SubscriptionItem. Read from the first
 * item, falling back to the subscription-level field on older payloads.
 */
function readSubscriptionPeriodEnd(sub: Stripe.Subscription): number | null {
  const firstItem = sub.items?.data?.[0] as
    | (Stripe.SubscriptionItem & { current_period_end?: number })
    | undefined;
  if (firstItem?.current_period_end) return firstItem.current_period_end;
  const legacy = (sub as unknown as { current_period_end?: number })
    .current_period_end;
  return typeof legacy === "number" ? legacy : null;
}

export async function syncSubscriptionFromStripe(sub: Stripe.Subscription) {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const supabase = (await createClient()) as any;

  const ownerId = sub.metadata?.proxy_owner_id;
  if (!ownerId) return; // subscription not originated by Proxy

  const price = sub.items.data[0]?.price;
  const periodEnd = readSubscriptionPeriodEnd(sub);

  const update = {
    owner_id: ownerId,
    property_id: sub.metadata?.proxy_property_id || null,
    stripe_subscription_id: sub.id,
    stripe_price_id: price?.id ?? null,
    price_cents: price?.unit_amount ?? 0,
    currency: price?.currency ?? "usd",
    interval: price?.recurring?.interval ?? "month",
    status: sub.status,
    current_period_end: periodEnd
      ? new Date(periodEnd * 1000).toISOString()
      : null,
    cancel_at_period_end: sub.cancel_at_period_end ?? false,
  };

  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("stripe_subscription_id", sub.id)
    .maybeSingle();

  if (existing) {
    await supabase.from("subscriptions").update(update).eq("id", existing.id);
  } else {
    await supabase.from("subscriptions").insert(update);
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

export type InvoiceRow = {
  id: string;
  kind: string;
  status: string;
  amount_cents: number;
  currency: string;
  description: string | null;
  due_at: string | null;
  paid_at: string | null;
  hosted_invoice_url: string | null;
  created_at: string;
  items: Array<{ description: string; amount_cents: number; quantity: number }>;
};

export type StripePaymentMethod = {
  id: string;
  type: "card" | "us_bank_account" | "other";
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  isExpiringSoon: boolean;
};

export async function fetchPaymentMethod(profileId: string): Promise<StripePaymentMethod | null> {
  if (!isStripeConfigured()) return null;
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const supabase = (await createClient()) as any;
  const { data: customer } = await supabase
    .from("stripe_customers")
    .select("stripe_customer_id")
    .eq("profile_id", profileId)
    .maybeSingle();
  /* eslint-enable @typescript-eslint/no-explicit-any */

  if (!customer?.stripe_customer_id) return null;

  try {
    const stripe = getStripe();
    const paymentMethods = await stripe.customers.listPaymentMethods(customer.stripe_customer_id, { limit: 1 });
    const pm = paymentMethods.data[0];
    if (!pm) return null;

    const now = new Date();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    if (pm.type === "card" && pm.card) {
      const expYear = pm.card.exp_year;
      const expMonth = pm.card.exp_month;
      const expiryDate = new Date(expYear, expMonth - 1, 1);
      const isExpiringSoon = expiryDate.getTime() - now.getTime() < thirtyDaysMs;
      return {
        id: pm.id,
        type: "card",
        brand: pm.card.brand,
        last4: pm.card.last4,
        expMonth,
        expYear,
        isExpiringSoon,
      };
    }

    if (pm.type === "us_bank_account" && pm.us_bank_account) {
      return {
        id: pm.id,
        type: "us_bank_account",
        brand: pm.us_bank_account.bank_name ?? null,
        last4: pm.us_bank_account.last4,
        expMonth: null,
        expYear: null,
        isExpiringSoon: false,
      };
    }

    return { id: pm.id, type: "other", brand: null, last4: null, expMonth: null, expYear: null, isExpiringSoon: false };
  } catch (err) {
    console.error("[stripe] fetchPaymentMethod error:", err);
    return null;
  }
}

export async function listInvoicesForOwner(
  ownerId: string,
): Promise<InvoiceRow[]> {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const supabase = (await createClient()) as any;
  const { data: invoices } = await supabase
    .from("invoices")
    .select(
      "id, kind, status, amount_cents, currency, description, due_at, paid_at, hosted_invoice_url, created_at",
    )
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  if (!invoices || invoices.length === 0) return [];

  const ids = (invoices as Array<{ id: string }>).map((i) => i.id);
  const { data: items } = await supabase
    .from("invoice_items")
    .select("invoice_id, description, amount_cents, quantity")
    .in("invoice_id", ids);

  const byInvoice = new Map<
    string,
    Array<{ description: string; amount_cents: number; quantity: number }>
  >();
  for (const row of (items ?? []) as Array<{
    invoice_id: string;
    description: string;
    amount_cents: number;
    quantity: number;
  }>) {
    const list = byInvoice.get(row.invoice_id) ?? [];
    list.push({
      description: row.description,
      amount_cents: row.amount_cents,
      quantity: row.quantity,
    });
    byInvoice.set(row.invoice_id, list);
  }

  return (invoices as Array<Omit<InvoiceRow, "items">>).map((inv) => ({
    ...inv,
    items: byInvoice.get(inv.id) ?? [],
  }));
  /* eslint-enable @typescript-eslint/no-explicit-any */
}
