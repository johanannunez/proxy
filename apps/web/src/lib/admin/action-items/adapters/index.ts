import type { EnrichedInsight } from "@/lib/admin/dashboard-data";
import type { CommunicationsDashboardData } from "@/lib/admin/fetch-communications";
import type {
  AIRiskDigestData,
  ColdLeadsData,
  OnboardingProgressData,
  OpenInvoicesData,
  ProjectBoardData,
  RecurringMaintenanceData,
  TodayScheduleData,
  WinbackQueueData,
} from "@/lib/admin/dashboard-v2";
import type { ActionItem } from "../types";
import { invoiceActionItems } from "./invoices";
import { scheduleActionItems } from "./schedule";
import { riskActionItems } from "./risk";
import { onboardingActionItems } from "./onboarding";
import { maintenanceActionItems } from "./maintenance";
import { projectActionItems } from "./projects";
import { coldLeadActionItems, winbackActionItems } from "./leads";
import { guestActionItems, callerActionItems } from "./guests";

export type ActionItemSources = {
  invoices: OpenInvoicesData;
  schedule: TodayScheduleData;
  risk: AIRiskDigestData;
  onboarding: OnboardingProgressData;
  maintenance: RecurringMaintenanceData;
  projects: ProjectBoardData;
  coldLeads: ColdLeadsData;
  winback: WinbackQueueData;
  houseActions: EnrichedInsight[];
  communications: CommunicationsDashboardData;
};

/** Flatten every source into one ActionItem stream. Pure. */
export function buildActionItems(s: ActionItemSources): ActionItem[] {
  return [
    ...invoiceActionItems(s.invoices),
    ...scheduleActionItems(s.schedule),
    ...riskActionItems(s.risk),
    ...onboardingActionItems(s.onboarding),
    ...maintenanceActionItems(s.maintenance),
    ...projectActionItems(s.projects),
    ...coldLeadActionItems(s.coldLeads),
    ...winbackActionItems(s.winback),
    ...guestActionItems(s.houseActions),
    ...callerActionItems(s.communications),
  ];
}

export {
  invoiceActionItems,
  scheduleActionItems,
  riskActionItems,
  onboardingActionItems,
  maintenanceActionItems,
  projectActionItems,
  coldLeadActionItems,
  winbackActionItems,
  guestActionItems,
  callerActionItems,
};
