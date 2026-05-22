import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

type SupabaseLike = ReturnType<typeof createServiceClient>;

export type InvoiceKind = "onboarding_fee" | "tech_fee" | "adhoc";
export type InvoiceStatus = "draft" | "open" | "paid" | "uncollectible" | "void";

export type PortalInvoice = {
  id: string;
  kind: InvoiceKind;
  status: InvoiceStatus;
  amountCents: number;
  currency: string;
  description: string | null;
  propertyId: string | null;
  propertyLabel: string | null;
  dueAt: string | null;
  paidAt: string | null;
  createdAt: string;
  hostedInvoiceUrl: string | null;
};

export type MonthlyGroup = {
  /** First day of the month, ISO date. */
  monthKey: string;
  /** Pre-formatted "May 2026" label. */
  monthLabel: string;
  invoices: PortalInvoice[];
};

export type OwnerFinancials = {
  monthlyGroups: MonthlyGroup[];
  /** Sum of `paid` invoices created in the current calendar year, in cents. */
  paidYearToDateCents: number;
  /** Sum of `open` invoices, in cents. */
  outstandingCents: number;
  /** ISO 4217. Always 'usd' today; future-proofed for international. */
  currency: string;
  /** Useful for "as of" labels in the UI. */
  asOf: string;
};

type RawInvoiceRow = {
  id: string;
  kind: InvoiceKind;
  status: InvoiceStatus;
  amount_cents: number;
  currency: string;
  description: string | null;
  property_id: string | null;
  due_at: string | null;
  paid_at: string | null;
  created_at: string;
  hosted_invoice_url: string | null;
};

type RawPropertyRow = {
  id: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
};

const monthLabelFormat = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

function propertyLabelFor(property: RawPropertyRow | undefined): string | null {
  if (!property) return null;
  const line1 = property.address_line1?.trim();
  const line2 = property.address_line2?.trim();
  if (line1 && line2) return `${line1} ${line2}`;
  return line1 ?? null;
}

function monthKeyOf(dateIso: string): string {
  const d = new Date(dateIso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export async function getOwnerFinancials(
  client: SupabaseLike,
  ownerId: string,
): Promise<OwnerFinancials> {
  // RLS on `invoices` already restricts authenticated callers to their
  // own rows via `invoices_owner_read`. The owner_id filter is belt
  // and suspenders, and required when getPortalContext is
  // impersonating (service-role client, RLS bypassed).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invoiceQuery = (client as any)
    .from("invoices")
    .select(
      "id, kind, status, amount_cents, currency, description, property_id, due_at, paid_at, created_at, hosted_invoice_url",
    )
    .eq("owner_id", ownerId)
    .neq("status", "draft")
    .order("created_at", { ascending: false }) as Promise<{
    data: RawInvoiceRow[] | null;
  }>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const propertyQuery = (client as any)
    .from("properties")
    .select("id, address_line1, address_line2, city, state")
    .eq("owner_id", ownerId) as Promise<{ data: RawPropertyRow[] | null }>;

  const [{ data: invoices }, { data: properties }] = await Promise.all([
    invoiceQuery,
    propertyQuery,
  ]);

  const propertyById = new Map<string, RawPropertyRow>();
  for (const p of properties ?? []) propertyById.set(p.id, p);

  const enriched: PortalInvoice[] = (invoices ?? []).map((row) => ({
    id: row.id,
    kind: row.kind,
    status: row.status,
    amountCents: row.amount_cents,
    currency: row.currency,
    description: row.description,
    propertyId: row.property_id,
    propertyLabel: row.property_id
      ? propertyLabelFor(propertyById.get(row.property_id))
      : null,
    dueAt: row.due_at,
    paidAt: row.paid_at,
    createdAt: row.created_at,
    hostedInvoiceUrl: row.hosted_invoice_url,
  }));

  const groups = new Map<string, MonthlyGroup>();
  for (const inv of enriched) {
    const key = monthKeyOf(inv.createdAt);
    let group = groups.get(key);
    if (!group) {
      group = {
        monthKey: key,
        monthLabel: monthLabelFormat.format(new Date(key)),
        invoices: [],
      };
      groups.set(key, group);
    }
    group.invoices.push(inv);
  }

  const monthlyGroups = [...groups.values()].sort((a, b) =>
    a.monthKey < b.monthKey ? 1 : a.monthKey > b.monthKey ? -1 : 0,
  );

  const currentYear = new Date().getUTCFullYear();
  let paidYearToDateCents = 0;
  let outstandingCents = 0;
  let currency = "usd";

  for (const inv of enriched) {
    currency = inv.currency || currency;
    if (inv.status === "paid") {
      const paidDate = inv.paidAt ?? inv.createdAt;
      if (new Date(paidDate).getUTCFullYear() === currentYear) {
        paidYearToDateCents += inv.amountCents;
      }
    }
    if (inv.status === "open") {
      outstandingCents += inv.amountCents;
    }
  }

  return {
    monthlyGroups,
    paidYearToDateCents,
    outstandingCents,
    currency,
    asOf: new Date().toISOString(),
  };
}

export const INVOICE_KIND_LABEL: Record<InvoiceKind, string> = {
  onboarding_fee: "Onboarding fee",
  tech_fee: "Tech fee",
  adhoc: "Other",
};

export const INVOICE_STATUS_STYLE: Record<
  InvoiceStatus,
  { background: string; foreground: string; label: string }
> = {
  draft: {
    background: "var(--color-warm-gray-100)",
    foreground: "var(--color-text-secondary)",
    label: "Draft",
  },
  open: {
    background: "rgba(245, 158, 11, 0.14)",
    foreground: "#b45309",
    label: "Open",
  },
  paid: {
    background: "rgba(22, 163, 74, 0.12)",
    foreground: "#15803d",
    label: "Paid",
  },
  uncollectible: {
    background: "rgba(220, 38, 38, 0.12)",
    foreground: "#b91c1c",
    label: "Uncollectible",
  },
  void: {
    background: "var(--color-warm-gray-100)",
    foreground: "var(--color-text-tertiary)",
    label: "Void",
  },
};
