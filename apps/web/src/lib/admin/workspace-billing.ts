import "server-only";
import { createClient } from "@/lib/supabase/server";
import { untypedDatabase } from "@/lib/supabase/untyped";

export type WorkspaceBillingPaymentMethod = {
  id: string;
  type: "card" | "us_bank_account" | "apple_pay" | "google_pay" | "link" | "other";
  label: string;
  last4: string | null;
  status: string;
  isDefault: boolean;
  isExpiringSoon: boolean;
};

export type WorkspaceBillingInvoiceRow = {
  id: string;
  kind: string;
  status: string;
  collection_method: string;
  amount_cents: number;
  currency: string;
  description: string | null;
  due_at: string | null;
  paid_at: string | null;
  hosted_invoice_url: string | null;
  created_at: string;
  items: Array<{ description: string; amount_cents: number; quantity: number }>;
};

export type WorkspaceFinancialReceipt = {
  id: string;
  vendor: string;
  amountCents: number;
  currency: string;
  category: string;
  purchaseDate: string;
  visibility: string;
  notes: string | null;
  imageUrl: string | null;
  analysisKind: "receipt" | "invoice" | "recurring" | "to_pay" | null;
  analysisConfidence: "high" | "medium" | "low" | null;
  analysisSummary: string | null;
  analysisReasons: string[];
  analysisSource: "document" | "ai" | "rules" | "manual" | null;
  propertyLabel: string | null;
  source: "receipt";
};

export type WorkspaceBillingScheduleRow = {
  id: string;
  name: string;
  status: string;
  collectionMethod: string;
  interval: string;
  intervalCount: number;
  firstInvoiceDate: string;
  nextInvoiceDate: string | null;
  lineCount: number;
  totalCents: number;
};

export type WorkspaceBilling = {
  billingProfileId: string | null;
  stripeCustomerId: string | null;
  totalCollectedCents: number;
  nextInvoice: { amountCents: number; dueAt: string } | null;
  invoices: WorkspaceBillingInvoiceRow[];
  schedules: WorkspaceBillingScheduleRow[];
  managementFeePercent: number | null;
  propertyCount: number;
  paymentMethod: WorkspaceBillingPaymentMethod | null;
  paymentMethods: WorkspaceBillingPaymentMethod[];
  receipts: WorkspaceFinancialReceipt[];
  availableCreditCents: number;
};

type BillingProfileRow = {
  id: string;
  stripe_customer_id: string | null;
};

type ContactBillingRow = {
  management_fee_percent: number | null;
};

type PaymentMethodRow = {
  id: string;
  type: WorkspaceBillingPaymentMethod["type"];
  wallet_type: string | null;
  brand: string | null;
  bank_name: string | null;
  last4: string | null;
  exp_month: number | null;
  exp_year: number | null;
  status: string;
  is_default: boolean;
};

type ScheduleRow = {
  id: string;
  name: string;
  status: string;
  collection_method: string;
  interval: string;
  interval_count: number;
  first_invoice_date: string;
  next_invoice_date: string | null;
};

type ScheduleLineRow = {
  schedule_id: string;
  quantity: number;
  unit_price_cents: number;
  discount_cents: number;
  tax_rate_bps: number;
  taxable: boolean;
};

type BillingInvoiceRow = {
  id: string;
  status: string;
  collection_method: string;
  total_cents: number;
  currency: string;
  memo: string | null;
  due_at: string | null;
  paid_at: string | null;
  hosted_invoice_url: string | null;
  invoice_date: string;
  created_at: string;
};

type BillingInvoiceLineRow = {
  billing_invoice_id: string;
  title: string;
  line_total_cents: number;
  quantity: number;
};

type CreditRow = {
  remaining_cents: number;
};

type ReceiptPropertyRow = {
  name: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
};

type OwnerReceiptRow = {
  id: string;
  vendor: string;
  amount: number;
  currency: string | null;
  category: string;
  purchase_date: string;
  visibility: string;
  notes: string | null;
  image_url: string | null;
  analysis_kind: "receipt" | "invoice" | "recurring" | "to_pay" | null;
  analysis_confidence: "high" | "medium" | "low" | null;
  analysis_summary: string | null;
  analysis_reasons: string[] | null;
  analysis_source: "document" | "ai" | "rules" | "manual" | null;
  property: ReceiptPropertyRow | null;
};

function formatPaymentMethod(row: PaymentMethodRow): WorkspaceBillingPaymentMethod {
  const now = new Date();
  const soon = new Date(now.getFullYear(), now.getMonth() + 2, 1);
  const expiresAt =
    row.exp_year && row.exp_month ? new Date(row.exp_year, row.exp_month - 1, 1) : null;
  const isExpiringSoon = !!expiresAt && expiresAt.getTime() < soon.getTime();

  const brand = row.wallet_type ?? row.brand ?? row.bank_name;
  const label =
    row.type === "us_bank_account"
      ? `${brand ?? "Bank account"}${row.last4 ? ` ending ${row.last4}` : ""}`
      : `${brand ?? row.type.replaceAll("_", " ")}${row.last4 ? ` ending ${row.last4}` : ""}`;

  return {
    id: row.id,
    type: row.type,
    label,
    last4: row.last4,
    status: row.status,
    isDefault: row.is_default,
    isExpiringSoon,
  };
}

export async function fetchWorkspaceBilling(
  workspaceId: string,
  activeContactId: string,
  propertyCount: number,
  ownerId?: string | null,
): Promise<WorkspaceBilling> {
  const supabase = await createClient();
  const db = untypedDatabase(supabase);

  const [{ data: profile }, { data: contactRow }] = await Promise.all([
    db
      .from<BillingProfileRow>("billing_profiles")
      .select("id, stripe_customer_id")
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    db
      .from<ContactBillingRow>("contacts")
      .select("management_fee_percent")
      .eq("id", activeContactId)
      .maybeSingle(),
  ]);

  const [
    { data: paymentMethodRows },
    { data: schedules },
    { data: scheduleLines },
    { data: invoiceRows },
    { data: credits },
    { data: receiptRows },
  ] = await Promise.all([
    db
      .from<PaymentMethodRow[]>("billing_payment_methods")
      .select("id, type, wallet_type, brand, bank_name, last4, exp_month, exp_year, status, is_default")
      .eq("workspace_id", workspaceId)
      .not("status", "eq", "removed")
      .order("is_default", { ascending: false }),
    db
      .from<ScheduleRow[]>("billing_schedules")
      .select("id, name, status, collection_method, interval, interval_count, first_invoice_date, next_invoice_date")
      .eq("workspace_id", workspaceId)
      .order("next_invoice_date", { ascending: true }),
    db
      .from<ScheduleLineRow[]>("billing_schedule_lines")
      .select("schedule_id, quantity, unit_price_cents, discount_cents, tax_rate_bps, taxable")
      .eq("workspace_id", workspaceId)
      .eq("active", true),
    db
      .from<BillingInvoiceRow[]>("billing_invoices")
      .select("id, status, collection_method, total_cents, currency, memo, due_at, paid_at, hosted_invoice_url, invoice_date, created_at")
      .eq("workspace_id", workspaceId)
      .order("invoice_date", { ascending: false })
      .limit(25),
    db
      .from<CreditRow[]>("billing_credits")
      .select("remaining_cents")
      .eq("workspace_id", workspaceId)
      .eq("status", "available"),
    ownerId
      ? db
          .from<OwnerReceiptRow[]>("owner_receipts")
          .select(
            "id, vendor, amount, currency, category, purchase_date, visibility, notes, image_url, analysis_kind, analysis_confidence, analysis_summary, analysis_reasons, analysis_source, property:properties(name, address_line1, city, state)",
          )
          .eq("owner_id", ownerId)
          .order("purchase_date", { ascending: false })
          .limit(200)
      : Promise.resolve({ data: [] as OwnerReceiptRow[] }),
  ]);

  const invoiceIds = (invoiceRows ?? []).map((invoice) => invoice.id);
  const { data: lineRows } = invoiceIds.length > 0
    ? await db
        .from<BillingInvoiceLineRow[]>("billing_invoice_lines")
        .select("billing_invoice_id, title, line_total_cents, quantity")
        .in("billing_invoice_id", invoiceIds)
    : { data: [] as BillingInvoiceLineRow[] };

  const linesByInvoice = new Map<
    string,
    Array<{ description: string; amount_cents: number; quantity: number }>
  >();
  for (const line of lineRows ?? []) {
    const list = linesByInvoice.get(line.billing_invoice_id) ?? [];
    list.push({
      description: line.title,
      amount_cents: line.line_total_cents,
      quantity: line.quantity,
    });
    linesByInvoice.set(line.billing_invoice_id, list);
  }

  const lineCountBySchedule = new Map<string, number>();
  const totalBySchedule = new Map<string, number>();
  for (const line of scheduleLines ?? []) {
    lineCountBySchedule.set(line.schedule_id, (lineCountBySchedule.get(line.schedule_id) ?? 0) + 1);
    const subtotal = Math.round(Number(line.quantity) * line.unit_price_cents);
    const taxableBase = Math.max(0, subtotal - line.discount_cents);
    const tax = line.taxable ? Math.round(taxableBase * (line.tax_rate_bps / 10000)) : 0;
    totalBySchedule.set(
      line.schedule_id,
      (totalBySchedule.get(line.schedule_id) ?? 0) + Math.max(0, taxableBase + tax),
    );
  }

  const invoices: WorkspaceBillingInvoiceRow[] = (invoiceRows ?? []).map((invoice) => ({
    id: invoice.id,
    kind: "recurring",
    status: invoice.status,
    collection_method: invoice.collection_method,
    amount_cents: invoice.total_cents,
    currency: invoice.currency,
    description: invoice.memo,
    due_at: invoice.due_at,
    paid_at: invoice.paid_at,
    hosted_invoice_url: invoice.hosted_invoice_url,
    created_at: invoice.created_at ?? invoice.invoice_date,
    items: linesByInvoice.get(invoice.id) ?? [],
  }));

  const schedulesOut: WorkspaceBillingScheduleRow[] = (schedules ?? []).map((schedule) => ({
    id: schedule.id,
    name: schedule.name,
    status: schedule.status,
    collectionMethod: schedule.collection_method,
    interval: schedule.interval,
    intervalCount: schedule.interval_count,
    firstInvoiceDate: schedule.first_invoice_date,
    nextInvoiceDate: schedule.next_invoice_date,
    lineCount: lineCountBySchedule.get(schedule.id) ?? 0,
    totalCents: totalBySchedule.get(schedule.id) ?? 0,
  }));

  const totalCollectedCents = invoices
    .filter((invoice) => invoice.status === "paid")
    .reduce((sum, invoice) => sum + invoice.amount_cents, 0);

  const nextInvoiceCandidate = invoices
    .filter((invoice) => ["draft", "review_ready", "approved", "open", "payment_failed"].includes(invoice.status))
    .filter((invoice) => invoice.due_at)
    .sort((a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime())[0];

  const paymentMethods = (paymentMethodRows ?? []).map(formatPaymentMethod);
  const paymentMethod =
    paymentMethods.find((method) => method.isDefault) ?? paymentMethods[0] ?? null;
  const receipts: WorkspaceFinancialReceipt[] = (receiptRows ?? []).map((receipt) => {
    const propertyLabel =
      receipt.property?.name ??
      [receipt.property?.address_line1, receipt.property?.city, receipt.property?.state]
        .filter(Boolean)
        .join(", ") ??
      null;

    return {
      id: receipt.id,
      vendor: receipt.vendor,
      amountCents: Math.round(Number(receipt.amount) * 100),
      currency: receipt.currency ?? "USD",
      category: receipt.category,
      purchaseDate: receipt.purchase_date,
      visibility: receipt.visibility,
      notes: receipt.notes,
      imageUrl: receipt.image_url,
      analysisKind: receipt.analysis_kind,
      analysisConfidence: receipt.analysis_confidence,
      analysisSummary: receipt.analysis_summary,
      analysisReasons: receipt.analysis_reasons ?? [],
      analysisSource: receipt.analysis_source,
      propertyLabel: propertyLabel || null,
      source: "receipt",
    };
  });

  return {
    billingProfileId: profile?.id ?? null,
    stripeCustomerId: profile?.stripe_customer_id ?? null,
    totalCollectedCents,
    nextInvoice: nextInvoiceCandidate
      ? {
          amountCents: nextInvoiceCandidate.amount_cents,
          dueAt: nextInvoiceCandidate.due_at!,
        }
      : null,
    invoices,
    schedules: schedulesOut,
    managementFeePercent: contactRow?.management_fee_percent ?? null,
    propertyCount,
    paymentMethod,
    paymentMethods,
    receipts,
    availableCreditCents: (credits ?? []).reduce(
      (sum, credit) => sum + credit.remaining_cents,
      0,
    ),
  };
}
