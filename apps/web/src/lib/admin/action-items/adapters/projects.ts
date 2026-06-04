import type { ProjectBoardData } from "@/lib/admin/dashboard-v2";
import type { ActionItem } from "../types";

export function projectActionItems(data: ProjectBoardData): ActionItem[] {
  return data.blockedProjects.map((p) => ({
    id: `project:${p.id}`,
    type: "project",
    lane: "onboarding",
    title: `${p.emoji ? `${p.emoji} ` : ""}${p.name} is blocked`,
    context: `${p.daysSinceUpdate}d since last update`,
    deadline: null,
    liveNow: false,
    moneyAtRisk: null,
    ownerVisible: false,
    href: `/admin/projects/${p.id}`,
  }));
}
