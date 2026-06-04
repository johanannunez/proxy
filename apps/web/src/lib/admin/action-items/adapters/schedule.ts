import type { TodayScheduleData } from "@/lib/admin/dashboard-v2";
import type { ActionItem } from "../types";

export function scheduleActionItems(data: TodayScheduleData): ActionItem[] {
  return data.items.map((it) => ({
    id: `schedule:${it.id}`,
    type: "schedule",
    lane: "riskGuests",
    title: it.title,
    context: [it.propertyName, it.contactName].filter(Boolean).join(" · ") || it.taskType,
    deadline: it.dueAt,
    liveNow: false,
    moneyAtRisk: null,
    ownerVisible: false,
    href: "/admin/tasks",
  }));
}
