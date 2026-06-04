import type { AIRiskDigestData } from "@/lib/admin/dashboard-v2";
import type { ActionItem } from "../types";

export function riskActionItems(data: AIRiskDigestData): ActionItem[] {
  return data.insights.map((i) => ({
    id: `risk:${i.id}`,
    type: "risk",
    lane: "riskGuests",
    title: i.title,
    context: i.propertyName,
    deadline: null,
    liveNow: i.isCritical,
    moneyAtRisk: null,
    ownerVisible: true,
    href: `/admin/properties/${i.propertyId}`,
  }));
}
