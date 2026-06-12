import type { OrgPlanTier } from "@/types/organizations";

/**
 * Client-safe billing summary types for /admin/settings/billing.
 * (Sibling *-types.ts so client components never import the server module.)
 */

export type OrgInvoiceSummary = {
  id: string;
  number: string | null;
  status: string;
  amountCents: number;
  currency: string;
  createdAt: string;
  hostedInvoiceUrl: string | null;
};

export type OrgBillingSummary = {
  orgId: string;
  orgName: string;
  orgSlug: string;
  planTier: OrgPlanTier;
  hasStripeCustomer: boolean;
  stripeConfigured: boolean;
  nextInvoice: {
    amountCents: number;
    currency: string;
    date: string | null;
  } | null;
  invoices: OrgInvoiceSummary[];
};

export const PLAN_TIER_LABELS: Record<OrgPlanTier, string> = {
  starter: "Starter",
  pro: "Pro",
  white_label: "White-label",
};

export function formatCents(amountCents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);
}
