import type { OpenInvoicesData } from "@/lib/admin/dashboard-v2";
import { formatUsdCents } from "../format";
import type { ActionItem } from "../types";

export function invoiceActionItems(data: OpenInvoicesData): ActionItem[] {
  return data.invoices.map((inv) => ({
    id: `invoice:${inv.id}`,
    type: "invoice",
    lane: "money",
    title: `${inv.ownerName} owes ${formatUsdCents(inv.amountCents)}`,
    context: inv.daysOverdue > 0 ? `${inv.daysOverdue}d overdue · ${inv.kind}` : inv.kind,
    deadline: inv.dueAt,
    liveNow: false,
    moneyAtRisk: inv.amountCents / 100,
    ownerVisible: true,
    href: "/admin/finances",
  }));
}
