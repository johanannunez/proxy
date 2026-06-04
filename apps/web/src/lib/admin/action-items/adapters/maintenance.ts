import type { RecurringMaintenanceData } from "@/lib/admin/dashboard-v2";
import type { ActionItem } from "../types";

export function maintenanceActionItems(data: RecurringMaintenanceData): ActionItem[] {
  return data.tasks.map((t) => ({
    id: `maintenance:${t.id}`,
    type: "maintenance",
    lane: "riskGuests",
    title: `${t.templateName} at ${t.propertyName}`,
    context: t.isOverdue ? `${Math.abs(t.daysUntilDue)}d overdue` : `due in ${t.daysUntilDue}d`,
    deadline: t.nextDueAt,
    liveNow: false,
    moneyAtRisk: null,
    ownerVisible: false,
    href: t.propertyId ? `/admin/properties/${t.propertyId}` : "/admin/tasks",
  }));
}
