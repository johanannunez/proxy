import type { Metadata } from "next";
import { headers } from "next/headers";
import { fetchOrgBillingSummary } from "@/lib/billing/org-billing";
import { DEFAULT_AGENCY_ID } from "@/types/agencies";
import { BillingSettings } from "./BillingSettings";

export const metadata: Metadata = {
  title: "Billing | Proxy",
};

export const dynamic = "force-dynamic";

export default async function BillingSettingsPage() {
  // Org context is injected by the middleware (src/proxy.ts) from the
  // request host; first-party hosts resolve to the Proxy org.
  const headerList = await headers();
  const orgId = headerList.get("x-org-id") ?? DEFAULT_AGENCY_ID;

  const summary = await fetchOrgBillingSummary(orgId);

  if (!summary) {
    return (
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "40px 24px" }}>
        <h1
          style={{
            fontFamily: "var(--font-sora), var(--font-sans)",
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: "-0.03em",
            color: "var(--color-text-primary)",
          }}
        >
          Billing
        </h1>
        <p style={{ fontSize: 14, color: "var(--color-text-secondary)", marginTop: 8 }}>
          We could not load billing for this workspace. Refresh the page or
          contact support if this keeps happening.
        </p>
      </div>
    );
  }

  return <BillingSettings summary={summary} />;
}
