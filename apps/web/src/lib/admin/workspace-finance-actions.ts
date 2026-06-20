"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminUser } from "@/lib/admin/auth";
import {
  createWorkspacePaymentSetupSession,
  createWorkspaceSetupIntent,
  ensureStripeCustomerForWorkspace,
} from "@/lib/billing/stripe-workspace";
import { getStripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { untypedDatabase } from "@/lib/supabase/untyped";
import { generateDraftInvoiceForSchedule } from "@/lib/billing/generate-draft-invoice";

const WorkspaceInput = z.object({
  workspaceId: z.string().uuid(),
});

const FinanceLineInput = z.object({
  title: z.string().trim().min(1, "Line title is required.").max(120),
  description: z.string().trim().max(500).optional(),
  quantity: z.number().positive().max(999),
  unitPriceCents: z.number().int().min(0).max(10_000_000),
  unitCostCents: z.number().int().min(0).max(10_000_000).default(0),
});

const ScheduleInput = WorkspaceInput.extend({
  name: z.string().trim().min(1, "Schedule name is required.").max(120),
  collectionMethod: z.enum(["auto_charge", "send_invoice", "manual"]),
  interval: z.enum(["week", "month", "quarter", "year"]),
  intervalCount: z.number().int().min(1).max(36),
  firstInvoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a first invoice date."),
  paymentTermsDays: z.number().int().min(0).max(365),
  reviewDaysBeforeCharge: z.number().int().min(0).max(30),
  memo: z.string().trim().max(1000).optional(),
  lines: z.array(FinanceLineInput).min(1, "Add at least one line item.").max(20),
});

const ScheduleActionInput = WorkspaceInput.extend({
  scheduleId: z.string().uuid(),
});

const InvoiceActionInput = WorkspaceInput.extend({
  invoiceId: z.string().uuid(),
});

type FinanceProfileResult =
  | { ok: true; billingProfileId: string; stripeCustomerId: string }
  | { ok: false; error: string };

type RedirectResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

type SetupIntentResult =
  | {
      ok: true;
      billingProfileId: string;
      stripeCustomerId: string;
      clientSecret: string;
    }
  | { ok: false; error: string };

type MutationResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

type FinanceProfileRow = {
  id: string;
  stripe_customer_id: string | null;
};

type InvoiceRow = {
  id: string;
  billing_profile_id: string;
  workspace_id: string;
  schedule_id: string | null;
  stripe_invoice_id: string | null;
  status: string;
  collection_method: "auto_charge" | "send_invoice" | "manual";
  total_cents: number;
  currency: string;
  due_at: string | null;
  memo: string | null;
};

type InvoiceLineRow = {
  id: string;
  title: string;
  description: string | null;
  quantity: number;
  line_total_cents: number;
};

type PaymentMethodRow = {
  id: string;
};

function dollarsToCentsFromCents(cents: number): number {
  return Math.round(cents);
}

function lineTotalCents(line: z.infer<typeof FinanceLineInput>): number {
  return Math.max(
    0,
    Math.round(line.quantity * dollarsToCentsFromCents(line.unitPriceCents)),
  );
}

function lineCostCents(line: z.infer<typeof FinanceLineInput>): number {
  return Math.max(
    0,
    Math.round(line.quantity * dollarsToCentsFromCents(line.unitCostCents)),
  );
}

function humanError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export async function ensureWorkspaceFinanceProfileAction(
  raw: unknown,
): Promise<FinanceProfileResult> {
  const parsed = WorkspaceInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid workspace." };
  }

  try {
    const { user } = await requireAdminUser();
    const result = await ensureStripeCustomerForWorkspace({
      workspaceId: parsed.data.workspaceId,
      createdBy: user.id,
    });
    revalidatePath(`/admin/workspaces/${parsed.data.workspaceId}`);
    revalidatePath("/admin/finances");
    return { ok: true, ...result };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not create finance profile.",
    };
  }
}

export async function createWorkspacePaymentSetupSessionAction(
  raw: unknown,
): Promise<RedirectResult> {
  const parsed = WorkspaceInput.extend({
    returnBaseUrl: z.string().url(),
  }).safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid workspace." };
  }

  try {
    const { user } = await requireAdminUser();
    const result = await createWorkspacePaymentSetupSession({
      workspaceId: parsed.data.workspaceId,
      returnBaseUrl: parsed.data.returnBaseUrl,
      createdBy: user.id,
    });
    revalidatePath(`/admin/workspaces/${parsed.data.workspaceId}`);
    revalidatePath("/admin/finances");
    return { ok: true, url: result.url };
  } catch (error) {
    return {
      ok: false,
      error: humanError(error, "Could not start payment setup."),
    };
  }
}

export async function createWorkspacePaymentSetupIntentAction(
  raw: unknown,
): Promise<SetupIntentResult> {
  const parsed = WorkspaceInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid workspace." };
  }

  try {
    const { user } = await requireAdminUser();
    const result = await createWorkspaceSetupIntent({
      workspaceId: parsed.data.workspaceId,
      createdBy: user.id,
    });
    revalidatePath(`/admin/workspaces/${parsed.data.workspaceId}`);
    revalidatePath("/admin/finances");
    return { ok: true, ...result };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not start payment setup.",
    };
  }
}

export async function createWorkspaceFinanceScheduleAction(
  raw: unknown,
): Promise<MutationResult> {
  const parsed = ScheduleInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid schedule." };
  }

  try {
    const { user } = await requireAdminUser();
    const supabase = createServiceClient();
    const db = untypedDatabase(supabase);
    const { billingProfileId } = await ensureStripeCustomerForWorkspace({
      workspaceId: parsed.data.workspaceId,
      createdBy: user.id,
    });

    const { data: schedule, error: scheduleError } = await db
      .from<{ id: string }>("billing_schedules")
      .insert({
        billing_profile_id: billingProfileId,
        workspace_id: parsed.data.workspaceId,
        name: parsed.data.name,
        status: "active",
        collection_method: parsed.data.collectionMethod,
        interval: parsed.data.interval,
        interval_count: parsed.data.intervalCount,
        first_invoice_date: parsed.data.firstInvoiceDate,
        next_invoice_date: parsed.data.firstInvoiceDate,
        review_days_before_charge: parsed.data.reviewDaysBeforeCharge,
        payment_terms_days: parsed.data.paymentTermsDays,
        intro_message: parsed.data.memo ?? null,
        created_by: user.id,
        activated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (scheduleError || !schedule) {
      throw new Error(scheduleError?.message ?? "Could not create finance schedule.");
    }

    const lineRows = parsed.data.lines.map((line, index) => {
      const total = lineTotalCents(line);
      const cost = lineCostCents(line);
      return {
        schedule_id: schedule.id,
        workspace_id: parsed.data.workspaceId,
        kind: "service",
        title: line.title,
        description: line.description || null,
        quantity: line.quantity,
        unit_price_cents: line.unitPriceCents,
        unit_cost_cents: line.unitCostCents,
        metadata: {
          preview_total_cents: total,
          preview_margin_cents: total - cost,
        },
        sort_order: index,
      };
    });

    const { error: lineError } = await db
      .from("billing_schedule_lines")
      .insert(lineRows);

    if (lineError) {
      throw new Error(lineError.message);
    }

    revalidatePath(`/admin/workspaces/${parsed.data.workspaceId}`);
    revalidatePath("/admin/finances");
    return { ok: true, message: "Recurring schedule created." };
  } catch (error) {
    return {
      ok: false,
      error: humanError(error, "Could not create recurring schedule."),
    };
  }
}

export async function generateWorkspaceDraftInvoiceAction(
  raw: unknown,
): Promise<MutationResult> {
  const parsed = ScheduleActionInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid schedule." };
  }

  let userId: string;
  try {
    const { user } = await requireAdminUser();
    userId = user.id;
  } catch {
    return { ok: false, error: "Admin access required." };
  }

  // The generation logic itself is session-free and shared with the
  // billing-schedules cron; the action only adds the admin gate + revalidation.
  const outcome = await generateDraftInvoiceForSchedule({
    workspaceId: parsed.data.workspaceId,
    scheduleId: parsed.data.scheduleId,
    createdBy: userId,
  });

  if (!outcome.ok) {
    return { ok: false, error: outcome.message };
  }

  revalidatePath(`/admin/workspaces/${parsed.data.workspaceId}`);
  revalidatePath("/admin/finances");
  return { ok: true, message: "Draft invoice generated for review." };
}

export async function approveWorkspaceFinanceInvoiceAction(
  raw: unknown,
): Promise<MutationResult> {
  const parsed = InvoiceActionInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid invoice." };
  }

  try {
    const { user } = await requireAdminUser();
    const supabase = createServiceClient();
    const db = untypedDatabase(supabase);

    const { data: invoice } = await db
      .from<InvoiceRow>("billing_invoices")
      .select("id, billing_profile_id, workspace_id, schedule_id, stripe_invoice_id, status, collection_method, total_cents, currency, due_at, memo")
      .eq("id", parsed.data.invoiceId)
      .eq("workspace_id", parsed.data.workspaceId)
      .maybeSingle();

    if (!invoice) return { ok: false, error: "Invoice not found." };
    if (!["review_ready", "approved"].includes(invoice.status)) {
      return { ok: false, error: "Only review-ready invoices can be approved." };
    }
    if (invoice.stripe_invoice_id) {
      return { ok: false, error: "This invoice has already been sent to Stripe." };
    }
    if (invoice.collection_method === "manual") {
      await db
        .from("billing_invoices")
        .update({
          status: "approved",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", invoice.id);
      revalidatePath(`/admin/workspaces/${parsed.data.workspaceId}`);
      revalidatePath("/admin/finances");
      return { ok: true, message: "Manual invoice approved." };
    }

    const [{ data: profile }, { data: paymentMethod }, { data: lines }] = await Promise.all([
      db
        .from<FinanceProfileRow>("billing_profiles")
        .select("id, stripe_customer_id")
        .eq("id", invoice.billing_profile_id)
        .maybeSingle(),
      db
        .from<PaymentMethodRow>("billing_payment_methods")
        .select("id")
        .eq("workspace_id", invoice.workspace_id)
        .eq("is_default", true)
        .eq("status", "active")
        .maybeSingle(),
      db
        .from<InvoiceLineRow[]>("billing_invoice_lines")
        .select("id, title, description, quantity, line_total_cents")
        .eq("billing_invoice_id", invoice.id)
        .order("id", { ascending: true }),
    ]);

    if (!profile?.stripe_customer_id) {
      return { ok: false, error: "Create a Stripe customer before approving this invoice." };
    }
    if (invoice.collection_method === "auto_charge" && !paymentMethod) {
      return { ok: false, error: "Auto-charge requires a default payment method." };
    }
    if (!lines?.length) {
      return { ok: false, error: "Invoice has no lines." };
    }

    const stripe = getStripe();
    const collectionMethod = invoice.collection_method === "auto_charge"
      ? "charge_automatically"
      : "send_invoice";
    const dueDate = invoice.due_at ? new Date(invoice.due_at) : null;
    const daysUntilDue = dueDate
      ? Math.max(0, Math.ceil((dueDate.getTime() - Date.now()) / 86_400_000))
      : 0;

    const stripeInvoice = await stripe.invoices.create({
      customer: profile.stripe_customer_id,
      collection_method: collectionMethod,
      days_until_due: collectionMethod === "send_invoice" ? daysUntilDue : undefined,
      auto_advance: false,
      description: invoice.memo ?? undefined,
      metadata: {
        proxy_workspace_id: invoice.workspace_id,
        proxy_billing_invoice_id: invoice.id,
        proxy_billing_profile_id: invoice.billing_profile_id,
      },
    });

    if (!stripeInvoice.id) {
      throw new Error("Stripe did not return an invoice id.");
    }

    for (const line of lines) {
      await stripe.invoiceItems.create({
        customer: profile.stripe_customer_id,
        invoice: stripeInvoice.id,
        amount: line.line_total_cents,
        currency: invoice.currency,
        description: line.description
          ? `${line.title}: ${line.description}`
          : line.title,
        metadata: {
          proxy_workspace_id: invoice.workspace_id,
          proxy_billing_invoice_id: invoice.id,
          proxy_billing_invoice_line_id: line.id,
        },
      });
    }

    const finalized = await stripe.invoices.finalizeInvoice(stripeInvoice.id);
    await db
      .from("billing_invoices")
      .update({
        stripe_invoice_id: finalized.id,
        status: finalized.status === "paid" ? "paid" : "open",
        hosted_invoice_url: finalized.hosted_invoice_url ?? null,
        due_at: finalized.due_date ? new Date(finalized.due_date * 1000).toISOString() : invoice.due_at,
        paid_at: finalized.status_transitions?.paid_at
          ? new Date(finalized.status_transitions.paid_at * 1000).toISOString()
          : null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        metadata: {
          stripe_status: finalized.status,
        },
      })
      .eq("id", invoice.id);

    revalidatePath(`/admin/workspaces/${parsed.data.workspaceId}`);
    revalidatePath("/admin/finances");
    return { ok: true, message: "Invoice approved and sent to Stripe." };
  } catch (error) {
    return {
      ok: false,
      error: humanError(error, "Could not approve invoice."),
    };
  }
}

export async function voidWorkspaceFinanceInvoiceAction(
  raw: unknown,
): Promise<MutationResult> {
  const parsed = InvoiceActionInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid invoice." };
  }

  try {
    const { user } = await requireAdminUser();
    const db = untypedDatabase(createServiceClient());
    const { data: invoice } = await db
      .from<InvoiceRow>("billing_invoices")
      .select("id, workspace_id, stripe_invoice_id, status")
      .eq("id", parsed.data.invoiceId)
      .eq("workspace_id", parsed.data.workspaceId)
      .maybeSingle();

    if (!invoice) return { ok: false, error: "Invoice not found." };
    if (invoice.stripe_invoice_id) {
      return { ok: false, error: "Void Stripe invoices from Stripe for now." };
    }

    await db
      .from("billing_invoices")
      .update({
        status: "void",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", invoice.id);

    revalidatePath(`/admin/workspaces/${parsed.data.workspaceId}`);
    revalidatePath("/admin/finances");
    return { ok: true, message: "Invoice voided." };
  } catch (error) {
    return {
      ok: false,
      error: humanError(error, "Could not void invoice."),
    };
  }
}
