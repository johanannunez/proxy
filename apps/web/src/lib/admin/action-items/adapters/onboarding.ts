import type { OnboardingProgressData } from "@/lib/admin/dashboard-v2";
import type { ActionItem } from "../types";

const STALLED_DAYS = 7;

export function onboardingActionItems(data: OnboardingProgressData): ActionItem[] {
  return data.contacts
    .filter((c) => c.daysInStage >= STALLED_DAYS || c.properties.some((p) => p.worstStatus === "stuck"))
    .map((c) => {
      const stuck = c.properties.find((p) => p.worstStatus === "stuck");
      return {
        id: `onboarding:${c.id}`,
        type: "onboarding",
        lane: "onboarding",
        title: `${c.name}'s onboarding is stalled`,
        context: stuck
          ? `${stuck.address} stuck · ${c.daysInStage}d in stage`
          : `${c.daysInStage}d in stage`,
        deadline: null,
        liveNow: false,
        moneyAtRisk: null,
        ownerVisible: true,
        href: `/admin/people/${c.id}`,
      };
    });
}
