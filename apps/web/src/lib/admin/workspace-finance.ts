import "server-only";
import { createClient } from "@/lib/supabase/server";
import { untypedDatabase } from "@/lib/supabase/untyped";

// App-facing finance data reads from stable billing infrastructure tables.
export type WorkspaceFinancePaymentMethod = {
  id: string;
  type: "card" | "us_bank_account" | "apple_pay" | "google_pay" | "link" | "other";
  funding: "credit" | "debit" | "prepaid" | "unknown" | null;
  label: string;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  routingNumber: string | null;
  displayNumber: string | null;
  displayAccount: string | null;
  status: string;
  isDefault: boolean;
  isExpiringSoon: boolean;
};

export type WorkspaceFinanceInvoiceRow = {
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

export type FinanceRequestType =
  | "ach_authorization"
  | "card_authorization"
  | "receipt_upload"
  | "reimbursement_details"
  | "claim_evidence";

export type FinanceRequestStatus = "draft" | "sent" | "viewed" | "completed" | "cancelled";
export type FinanceRequestDeliveryMethod = "email" | "sms";

export type WorkspaceFinanceRequest = {
  id: string;
  workspaceId: string;
  contactId: string | null;
  requestType: FinanceRequestType;
  status: FinanceRequestStatus;
  deliveryMethod: FinanceRequestDeliveryMethod;
  message: string | null;
  requestUrl: string | null;
  lastSentAt: string | null;
  completedAt: string | null;
  createdAt: string;
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
  paymentSource: ReceiptPaymentSource;
  reimbursementStatus: ReceiptReimbursementStatus;
  claimProvider: ReceiptClaimProvider | null;
  claimReference: string | null;
  reimbursedAt: string | null;
  lineItems: WorkspaceFinancialReceiptLineItem[];
  propertyLabel: string | null;
  source: "receipt";
};

export type WorkspaceFinancialReceiptLineItem = {
  label: string;
  amount: string | null;
};

export type ReceiptPaymentSource =
  | "owner_card"
  | "company_card"
  | "owner_paid"
  | "vendor_invoice"
  | "airbnb_claim"
  | "insurance_claim"
  | "other";

export type ReceiptReimbursementStatus =
  | "none"
  | "reimbursement_needed"
  | "claim_needed"
  | "claim_submitted"
  | "reimbursed"
  | "denied_writeoff";

export type ReceiptClaimProvider = "airbnb" | "insurance" | "other";

export type WorkspaceFinanceScheduleRow = {
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

export type WorkspaceFinance = {
  billingProfileId: string | null;
  stripeCustomerId: string | null;
  totalCollectedCents: number;
  nextInvoice: { amountCents: number; dueAt: string } | null;
  invoices: WorkspaceFinanceInvoiceRow[];
  schedules: WorkspaceFinanceScheduleRow[];
  managementFeePercent: number | null;
  propertyCount: number;
  paymentMethod: WorkspaceFinancePaymentMethod | null;
  paymentMethods: WorkspaceFinancePaymentMethod[];
  receipts: WorkspaceFinancialReceipt[];
  financeRequests: WorkspaceFinanceRequest[];
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
  type: WorkspaceFinancePaymentMethod["type"];
  wallet_type: string | null;
  funding: WorkspaceFinancePaymentMethod["funding"];
  brand: string | null;
  bank_name: string | null;
  last4: string | null;
  exp_month: number | null;
  exp_year: number | null;
  status: string;
  is_default: boolean;
  metadata: Record<string, unknown> | null;
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
  payment_source: ReceiptPaymentSource | null;
  reimbursement_status: ReceiptReimbursementStatus | null;
  claim_provider: ReceiptClaimProvider | null;
  claim_reference: string | null;
  reimbursed_at: string | null;
  line_items: unknown;
  property: ReceiptPropertyRow | null;
};

type FinanceRequestRow = {
  id: string;
  workspace_id: string;
  contact_id: string | null;
  request_type: FinanceRequestType;
  status: FinanceRequestStatus;
  delivery_method: FinanceRequestDeliveryMethod;
  message: string | null;
  request_url: string | null;
  last_sent_at: string | null;
  completed_at: string | null;
  created_at: string;
};

function formatPaymentMethod(row: PaymentMethodRow): WorkspaceFinancePaymentMethod {
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

  const routingNumber =
    row.metadata && typeof row.metadata.routing_number === "string"
      ? row.metadata.routing_number
      : null;
  const displayNumber =
    row.metadata && typeof row.metadata.display_number === "string"
      ? row.metadata.display_number
      : null;
  const displayAccount =
    row.metadata && typeof row.metadata.display_account === "string"
      ? row.metadata.display_account
      : null;

  return {
    id: row.id,
    type: row.type,
    funding: row.funding,
    label,
    last4: row.last4,
    expMonth: row.exp_month,
    expYear: row.exp_year,
    routingNumber,
    displayNumber,
    displayAccount,
    status: row.status,
    isDefault: row.is_default,
    isExpiringSoon,
  };
}

function normalizeReceiptLineItems(value: unknown): WorkspaceFinancialReceiptLineItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const candidate = item as Record<string, unknown>;
      const label = typeof candidate.label === "string" ? candidate.label.trim() : "";
      if (!label) return null;
      const amount = typeof candidate.amount === "string" && candidate.amount.trim()
        ? candidate.amount.trim()
        : null;
      return { label, amount };
    })
    .filter((item): item is WorkspaceFinancialReceiptLineItem => item !== null)
    .slice(0, 20);
}

export async function fetchWorkspaceFinance(
  workspaceId: string,
  activeContactId: string,
  propertyCount: number,
  ownerId?: string | null,
): Promise<WorkspaceFinance> {
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
    { data: financeRequestRows },
  ] = await Promise.all([
    db
      .from<PaymentMethodRow[]>("billing_payment_methods")
      .select("id, type, wallet_type, funding, brand, bank_name, last4, exp_month, exp_year, status, is_default, metadata")
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
            "id, vendor, amount, currency, category, purchase_date, visibility, notes, image_url, analysis_kind, analysis_confidence, analysis_summary, analysis_reasons, analysis_source, payment_source, reimbursement_status, claim_provider, claim_reference, reimbursed_at, line_items, property:properties(name, address_line1, city, state)",
          )
          .eq("owner_id", ownerId)
          .order("purchase_date", { ascending: false })
          .limit(200)
      : Promise.resolve({ data: [] as OwnerReceiptRow[] }),
    db
      .from<FinanceRequestRow[]>("finance_requests")
      .select("id, workspace_id, contact_id, request_type, status, delivery_method, message, request_url, last_sent_at, completed_at, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(50),
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

  const invoices: WorkspaceFinanceInvoiceRow[] = (invoiceRows ?? []).map((invoice) => ({
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

  const schedulesOut: WorkspaceFinanceScheduleRow[] = (schedules ?? []).map((schedule) => ({
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
      paymentSource: receipt.payment_source ?? "owner_card",
      reimbursementStatus: receipt.reimbursement_status ?? "none",
      claimProvider: receipt.claim_provider,
      claimReference: receipt.claim_reference,
      reimbursedAt: receipt.reimbursed_at,
      lineItems: normalizeReceiptLineItems(receipt.line_items),
      propertyLabel: propertyLabel || null,
      source: "receipt",
    };
  });
  const financeRequests: WorkspaceFinanceRequest[] = (financeRequestRows ?? []).map((request) => ({
    id: request.id,
    workspaceId: request.workspace_id,
    contactId: request.contact_id,
    requestType: request.request_type,
    status: request.status,
    deliveryMethod: request.delivery_method,
    message: request.message,
    requestUrl: request.request_url,
    lastSentAt: request.last_sent_at,
    completedAt: request.completed_at,
    createdAt: request.created_at,
  }));

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
    financeRequests,
    availableCreditCents: (credits ?? []).reduce(
      (sum, credit) => sum + credit.remaining_cents,
      0,
    ),
  };
}
