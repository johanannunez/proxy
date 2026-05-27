import "server-only";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { untypedDatabase } from "@/lib/supabase/untyped";
import type { Json } from "@/types/supabase";

type WorkspaceRow = {
  id: string;
  name: string;
};

type BillingProfileRow = {
  id: string;
  workspace_id: string;
  stripe_customer_id: string | null;
  billing_email: string | null;
};

type ContactRow = {
  email: string | null;
  full_name: string | null;
};

type BillingInvoiceLookupRow = {
  id: string;
  workspace_id: string;
  billing_profile_id: string;
};

type BillingPaymentMethodType =
  | "card"
  | "us_bank_account"
  | "apple_pay"
  | "google_pay"
  | "link"
  | "other";

function stripeInvoiceStatus(inv: Stripe.Invoice): string {
  if (inv.status === "paid") return "paid";
  if (inv.status === "open") return "open";
  if (inv.status === "draft") return "draft";
  if (inv.status === "void") return "void";
  if (inv.status === "uncollectible") return "uncollectible";
  return "open";
}

function paymentMethodType(pm: Stripe.PaymentMethod): BillingPaymentMethodType {
  if (pm.type === "us_bank_account") return "us_bank_account";
  if (pm.type === "card") {
    const wallet = pm.card?.wallet?.type;
    if (wallet === "apple_pay") return "apple_pay";
    if (wallet === "google_pay") return "google_pay";
    if (wallet === "link") return "link";
    return "card";
  }
  return "other";
}

function jsonMetadata(value: Stripe.Metadata | null | undefined): Json {
  return Object.fromEntries(Object.entries(value ?? {}));
}

async function resolveBillingEmail(workspaceId: string): Promise<string | null> {
  const supabase = createServiceClient();
  const db = untypedDatabase(supabase);
  const { data } = await db
    .from<ContactRow[]>("contacts")
    .select("email, full_name")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true })
    .limit(1);

  return data?.[0]?.email ?? null;
}

export async function ensureStripeCustomerForWorkspace(params: {
  workspaceId: string;
  createdBy?: string | null;
}): Promise<{ billingProfileId: string; stripeCustomerId: string }> {
  const supabase = createServiceClient();
  const db = untypedDatabase(supabase);

  const { data: existing } = await db
    .from<BillingProfileRow>("billing_profiles")
    .select("id, workspace_id, stripe_customer_id, billing_email")
    .eq("workspace_id", params.workspaceId)
    .maybeSingle();

  if (existing?.stripe_customer_id) {
    return {
      billingProfileId: existing.id,
      stripeCustomerId: existing.stripe_customer_id,
    };
  }

  const { data: workspace } = await db
    .from<WorkspaceRow>("workspaces")
    .select("id, name")
    .eq("id", params.workspaceId)
    .single();

  if (!workspace) {
    throw new Error(`Workspace ${params.workspaceId} not found`);
  }

  const billingEmail = existing?.billing_email ?? (await resolveBillingEmail(params.workspaceId));
  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: billingEmail ?? undefined,
    name: workspace.name,
    metadata: {
      parcel_workspace_id: params.workspaceId,
    },
  });

  if (existing) {
    const { data: updated, error } = await db
      .from<BillingProfileRow>("billing_profiles")
      .update({
        stripe_customer_id: customer.id,
        billing_email: billingEmail,
      })
      .eq("id", existing.id)
      .select("id, workspace_id, stripe_customer_id, billing_email")
      .single();
    if (error || !updated?.stripe_customer_id) {
      throw new Error(error?.message ?? "Could not update billing profile");
    }
    return {
      billingProfileId: updated.id,
      stripeCustomerId: updated.stripe_customer_id,
    };
  }

  const { data: created, error } = await db
    .from<BillingProfileRow>("billing_profiles")
    .insert({
      workspace_id: params.workspaceId,
      stripe_customer_id: customer.id,
      billing_email: billingEmail,
      created_by: params.createdBy ?? null,
    })
    .select("id, workspace_id, stripe_customer_id, billing_email")
    .single();

  if (error || !created?.stripe_customer_id) {
    throw new Error(error?.message ?? "Could not create billing profile");
  }

  return {
    billingProfileId: created.id,
    stripeCustomerId: created.stripe_customer_id,
  };
}

export async function createWorkspaceSetupIntent(params: {
  workspaceId: string;
  createdBy?: string | null;
}): Promise<{ clientSecret: string; stripeCustomerId: string; billingProfileId: string }> {
  const { billingProfileId, stripeCustomerId } = await ensureStripeCustomerForWorkspace(params);
  const stripe = getStripe();
  const intent = await stripe.setupIntents.create({
    customer: stripeCustomerId,
    usage: "off_session",
    automatic_payment_methods: {
      enabled: true,
    },
    metadata: {
      parcel_workspace_id: params.workspaceId,
      parcel_billing_profile_id: billingProfileId,
    },
  });

  if (!intent.client_secret) {
    throw new Error("Stripe did not return a setup intent client secret");
  }

  return {
    clientSecret: intent.client_secret,
    stripeCustomerId,
    billingProfileId,
  };
}

export async function createWorkspacePaymentSetupSession(params: {
  workspaceId: string;
  returnBaseUrl: string;
  createdBy?: string | null;
}): Promise<{ url: string; stripeCustomerId: string; billingProfileId: string }> {
  const { billingProfileId, stripeCustomerId } = await ensureStripeCustomerForWorkspace(params);
  const stripe = getStripe();
  const returnBaseUrl = params.returnBaseUrl.replace(/\/$/, "");
  const workspaceUrl = `${returnBaseUrl}/admin/workspaces/${params.workspaceId}?tab=billing`;

  const session = await stripe.checkout.sessions.create({
    mode: "setup",
    customer: stripeCustomerId,
    payment_method_types: ["card", "us_bank_account"],
    success_url: `${workspaceUrl}&payment_setup=success`,
    cancel_url: `${workspaceUrl}&payment_setup=canceled`,
    metadata: {
      parcel_workspace_id: params.workspaceId,
      parcel_billing_profile_id: billingProfileId,
    },
    setup_intent_data: {
      metadata: {
        parcel_workspace_id: params.workspaceId,
        parcel_billing_profile_id: billingProfileId,
      },
    },
  });

  if (!session.url) {
    throw new Error("Stripe did not return a payment setup URL");
  }

  return {
    url: session.url,
    stripeCustomerId,
    billingProfileId,
  };
}

export async function syncWorkspacePaymentMethodFromStripe(params: {
  paymentMethod: Stripe.PaymentMethod;
  workspaceId?: string | null;
}): Promise<void> {
  const pm = params.paymentMethod;
  const workspaceId = params.workspaceId ?? pm.metadata?.parcel_workspace_id;
  if (!workspaceId) return;

  const { billingProfileId } = await ensureStripeCustomerForWorkspace({ workspaceId });
  const supabase = createServiceClient();
  const db = untypedDatabase(supabase);
  const methodType = paymentMethodType(pm);

  const card = pm.card;
  const bank = pm.us_bank_account;
  const { data: paymentMethodRow } = await db
    .from<{ id: string }>("billing_payment_methods")
    .upsert(
      {
        billing_profile_id: billingProfileId,
        workspace_id: workspaceId,
        stripe_payment_method_id: pm.id,
        type: methodType,
        wallet_type: card?.wallet?.type ?? null,
        brand: card?.brand ?? null,
        bank_name: bank?.bank_name ?? null,
        last4: card?.last4 ?? bank?.last4 ?? null,
        exp_month: card?.exp_month ?? null,
        exp_year: card?.exp_year ?? null,
        status: "active",
        is_default: true,
        metadata: jsonMetadata(pm.metadata),
      },
      { onConflict: "stripe_payment_method_id" },
    )
    .select("id")
    .single();

  if (paymentMethodRow?.id) {
    await db
      .from("billing_payment_methods")
      .update({ is_default: false })
      .eq("workspace_id", workspaceId)
      .not("id", "eq", paymentMethodRow.id);
    await db
      .from("billing_profiles")
      .update({ default_payment_method_id: paymentMethodRow.id })
      .eq("id", billingProfileId);
  }
}

export async function syncWorkspaceInvoiceFromStripe(inv: Stripe.Invoice): Promise<void> {
  if (!inv.id) return;

  const billingInvoiceId = inv.metadata?.parcel_billing_invoice_id;
  const workspaceId = inv.metadata?.parcel_workspace_id;
  if (!billingInvoiceId && !workspaceId) return;

  const supabase = createServiceClient();
  const db = untypedDatabase(supabase);

  let invoiceRow: BillingInvoiceLookupRow | null = null;
  if (billingInvoiceId) {
    const { data } = await db
      .from<BillingInvoiceLookupRow>("billing_invoices")
      .select("id, workspace_id, billing_profile_id")
      .eq("id", billingInvoiceId)
      .maybeSingle();
    invoiceRow = data;
  }

  if (!invoiceRow) {
    const { data } = await db
      .from<BillingInvoiceLookupRow>("billing_invoices")
      .select("id, workspace_id, billing_profile_id")
      .eq("stripe_invoice_id", inv.id)
      .maybeSingle();
    invoiceRow = data;
  }

  if (!invoiceRow) return;

  const status = stripeInvoiceStatus(inv);
  await db
    .from("billing_invoices")
    .update({
      stripe_invoice_id: inv.id,
      status,
      total_cents: inv.amount_due ?? 0,
      paid_at: inv.status_transitions?.paid_at
        ? new Date(inv.status_transitions.paid_at * 1000).toISOString()
        : null,
      hosted_invoice_url: inv.hosted_invoice_url ?? null,
      due_at: inv.due_date ? new Date(inv.due_date * 1000).toISOString() : null,
      metadata: {
        stripe_status: inv.status,
        stripe_customer: typeof inv.customer === "string" ? inv.customer : inv.customer?.id ?? null,
      },
    })
    .eq("id", invoiceRow.id);
}

export async function recordWorkspaceBillingStripeEvent(event: Stripe.Event): Promise<void> {
  const object = event.data.object as { metadata?: Stripe.Metadata; id?: string };
  const workspaceId = object.metadata?.parcel_workspace_id ?? null;
  const invoiceId = object.metadata?.parcel_billing_invoice_id ?? null;

  const supabase = createServiceClient();
  const db = untypedDatabase(supabase);
  await db
    .from("billing_events")
    .upsert(
      {
        workspace_id: workspaceId,
        billing_invoice_id: invoiceId,
        stripe_event_id: event.id,
        event_type: event.type,
        payload: event as unknown as Json,
      },
      { onConflict: "stripe_event_id" },
    );
}
