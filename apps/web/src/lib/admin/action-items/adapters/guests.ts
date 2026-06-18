import type { EnrichedInsight } from "@/lib/admin/dashboard-data";
import type { CommunicationsDashboardData } from "@/lib/admin/fetch-communications";
import type { ActionItem } from "../types";

export function guestActionItems(houseActions: EnrichedInsight[]): ActionItem[] {
  return houseActions.map((a) => ({
    id: `guest:${a.id}`,
    type: "guest",
    lane: "riskGuests",
    title: a.title,
    context: a.propertyName,
    deadline: null,
    liveNow: a.severity === "warning",
    moneyAtRisk: null,
    ownerVisible: true,
    href: `/admin/properties/${a.propertyId}`,
  }));
}

export function callerActionItems(data: CommunicationsDashboardData): ActionItem[] {
  return data.unresolvedCallers.map((c) => ({
    id: `caller:${c.phone}`,
    type: "guest",
    lane: "riskGuests",
    title: `Unresolved call from ${c.phone}`,
    context: c.claudeSummary ?? "No summary yet",
    deadline: c.createdAt,
    liveNow: true,
    moneyAtRisk: null,
    ownerVisible: false,
    href: "/admin/inbox",
  }));
}
