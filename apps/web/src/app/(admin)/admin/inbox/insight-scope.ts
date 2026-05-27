import { normalizePhone } from "@/lib/admin/normalize-phone";
import type { CommunicationsDashboardData } from "@/lib/admin/fetch-communications";

export function scopeCommunicationsDashboard(args: {
  dashboard: CommunicationsDashboardData;
  selectedOwnerId: string | null;
  selectedOwnerPhone: string | null;
}): CommunicationsDashboardData {
  if (!args.selectedOwnerId) return args.dashboard;

  const ownerPhone = args.selectedOwnerPhone ? normalizePhone(args.selectedOwnerPhone) : null;

  return {
    recentActionItems: args.dashboard.recentActionItems.filter((item) => (
      item.entityType === "owner" && item.workspaceId === args.selectedOwnerId
    )),
    unresolvedCallers: ownerPhone
      ? args.dashboard.unresolvedCallers.filter((caller) => normalizePhone(caller.phone) === ownerPhone)
      : [],
  };
}
