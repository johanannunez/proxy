import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { untypedDatabase } from "@/lib/supabase/untyped";

/**
 * Session-free core of recurring management-fee invoice generation.
 *
 * Extracted from generateWorkspaceDraftInvoiceAction so the exact same logic
 * can run two ways: from the admin "Generate draft" button (which supplies the
 * acting admin via requireAdminUser) and from the billing-schedules cron (which
 * has no session and supplies the system actor). The action is now a thin
 * wrapper around this; the cron loops due schedules and calls it directly.
 *
 * Everything runs on the service-role client — there was never a per-user RLS
 * dependency here, only `created_by` attribution, which is now a parameter.
 *
 * Idempotent per (schedule, invoice_date): if a draft already exists for the
 * schedule's current next_invoice_date it returns { code: "already_exists" }
 * without creating a duplicate. On success it advances next_invoice_date by one
 * interval, so a repeated run will not regenerate the same period.
 */

export type DraftInvoiceCode =
  | "not_found"
  | "no_date"
  | "no_lines"
  | "already_exists"
  | "error";

export type DraftInvoiceOutcome =
  | { ok: true; invoiceId: string }
  | { ok: false; code: DraftInvoiceCode; message: string };

type ScheduleRow = {
  id: string;
  billing_profile_id: string;
  workspace_id: string;
  name: string;
  collection_method: "auto_charge" | "send_invoice" | "manual";
  interval: "week" | "month" | "quarter" | "year";
  interval_count: number;
  next_invoice_date: string | null;
  payment_terms_days: number;
};

type ScheduleLineRow = {
  id: string;
  property_id: string | null;
  catalog_item_id: string | null;
  kind: string;
  title: string;
  description: string | null;
  quantity: number;
  unit_price_cents: number;
  unit_cost_cents: number;
  discount_cents: number;
  tax_rate_bps: number;
  taxable: boolean;
  sort_order: number;
};

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addInterval(date: Date, interval: ScheduleRow["interval"], count: number): Date {
  const next = new Date(date);
  if (interval === "week") next.setDate(next.getDate() + 7 * count);
  if (interval === "month") next.setMonth(next.getMonth() + count);
  if (interval === "quarter") next.setMonth(next.getMonth() + 3 * count);
  if (interval === "year") next.setFullYear(next.getFullYear() + count);
  return next;
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export async function generateDraftInvoiceForSchedule(args: {
  workspaceId: string;
  scheduleId: string;
  createdBy: string;
}): Promise<DraftInvoiceOutcome> {
  try {
    const supabase = createServiceClient();
    const db = untypedDatabase(supabase);

    const { data: schedule } = await db
      .from<ScheduleRow>("billing_schedules")
      .select(
        "id, billing_profile_id, workspace_id, name, collection_method, interval, interval_count, next_invoice_date, payment_terms_days",
      )
      .eq("id", args.scheduleId)
      .eq("workspace_id", args.workspaceId)
      .maybeSingle();

    if (!schedule) {
      return { ok: false, code: "not_found", message: "Schedule not found." };
    }
    if (!schedule.next_invoice_date) {
      return { ok: false, code: "no_date", message: "Schedule has no next invoice date." };
    }

    const { data: existingInvoice } = await db
      .from<{ id: string }>("billing_invoices")
      .select("id")
      .eq("schedule_id", schedule.id)
      .eq("invoice_date", schedule.next_invoice_date)
      .maybeSingle();

    if (existingInvoice) {
      return {
        ok: false,
        code: "already_exists",
        message: "A draft already exists for this schedule date.",
      };
    }

    const { data: lines } = await db
      .from<ScheduleLineRow[]>("billing_schedule_lines")
      .select(
        "id, property_id, catalog_item_id, kind, title, description, quantity, unit_price_cents, unit_cost_cents, discount_cents, tax_rate_bps, taxable, sort_order",
      )
      .eq("schedule_id", schedule.id)
      .eq("active", true)
      .order("sort_order", { ascending: true });

    if (!lines?.length) {
      return {
        ok: false,
        code: "no_lines",
        message: "Add at least one active schedule line before generating an invoice.",
      };
    }

    const invoiceDate = parseDateOnly(schedule.next_invoice_date);
    const dueAt = addDays(invoiceDate, schedule.payment_terms_days);
    const subtotalCents = lines.reduce(
      (sum, line) => sum + Math.round(Number(line.quantity) * line.unit_price_cents),
      0,
    );
    const discountCents = lines.reduce((sum, line) => sum + line.discount_cents, 0);
    const taxCents = lines.reduce((sum, line) => {
      const taxableBase = Math.max(
        0,
        Math.round(Number(line.quantity) * line.unit_price_cents) - line.discount_cents,
      );
      return sum + (line.taxable ? Math.round(taxableBase * (line.tax_rate_bps / 10000)) : 0);
    }, 0);
    const totalCents = Math.max(0, subtotalCents - discountCents + taxCents);
    const totalCostCents = lines.reduce(
      (sum, line) => sum + Math.round(Number(line.quantity) * line.unit_cost_cents),
      0,
    );

    const { data: invoice, error: invoiceError } = await db
      .from<{ id: string }>("billing_invoices")
      .insert({
        billing_profile_id: schedule.billing_profile_id,
        workspace_id: schedule.workspace_id,
        schedule_id: schedule.id,
        status: "review_ready",
        collection_method: schedule.collection_method,
        invoice_date: schedule.next_invoice_date,
        due_at: dueAt.toISOString(),
        subtotal_cents: subtotalCents,
        discount_cents: discountCents,
        tax_cents: taxCents,
        total_cents: totalCents,
        total_cost_cents: totalCostCents,
        margin_cents: totalCents - totalCostCents,
        memo: schedule.name,
        created_by: args.createdBy,
      })
      .select("id")
      .single();

    // The SELECT guard above is not atomic with this INSERT, so a concurrent
    // writer (cron + manual click) can race past it. The partial unique index
    // billing_invoices_schedule_date_unique is the real authority: a duplicate
    // surfaces as a 23505 unique violation, which we treat as already_exists
    // (the other writer won) rather than an error — no duplicate is created.
    if (invoiceError?.code === "23505") {
      return {
        ok: false,
        code: "already_exists",
        message: "A draft already exists for this schedule date.",
      };
    }
    if (invoiceError || !invoice) {
      throw new Error(invoiceError?.message ?? "Could not create invoice draft.");
    }

    const invoiceLines = lines.map((line) => {
      const lineSubtotal = Math.round(Number(line.quantity) * line.unit_price_cents);
      const lineTax = line.taxable
        ? Math.round(Math.max(0, lineSubtotal - line.discount_cents) * (line.tax_rate_bps / 10000))
        : 0;
      const lineTotal = Math.max(0, lineSubtotal - line.discount_cents + lineTax);
      const lineCost = Math.round(Number(line.quantity) * line.unit_cost_cents);
      return {
        billing_invoice_id: invoice.id,
        workspace_id: schedule.workspace_id,
        property_id: line.property_id,
        schedule_line_id: line.id,
        catalog_item_id: line.catalog_item_id,
        kind: line.kind,
        title: line.title,
        description: line.description,
        quantity: line.quantity,
        unit_price_cents: line.unit_price_cents,
        unit_cost_cents: line.unit_cost_cents,
        discount_cents: line.discount_cents,
        tax_rate_bps: line.tax_rate_bps,
        tax_cents: lineTax,
        line_total_cents: lineTotal,
        line_cost_cents: lineCost,
        margin_cents: lineTotal - lineCost,
        sort_order: line.sort_order,
      };
    });

    const { error: lineError } = await db.from("billing_invoice_lines").insert(invoiceLines);
    if (lineError) throw new Error(lineError.message);

    // Advance next_invoice_date so this period is not regenerated. If this fails
    // silently the schedule would freeze (every future run finds the draft now
    // exists and returns already_exists, never advancing), so surface the error
    // instead of leaving the schedule stuck.
    const { error: advanceError } = await db
      .from("billing_schedules")
      .update({
        next_invoice_date: toDateOnly(
          addInterval(invoiceDate, schedule.interval, schedule.interval_count),
        ),
      })
      .eq("id", schedule.id);
    if (advanceError) {
      throw new Error(
        `Invoice ${invoice.id} created but advancing the schedule failed: ${advanceError.message}`,
      );
    }

    return { ok: true, invoiceId: invoice.id };
  } catch (error) {
    return {
      ok: false,
      code: "error",
      message: error instanceof Error ? error.message : "Could not generate draft invoice.",
    };
  }
}
