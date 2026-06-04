import type { Metadata } from "next";
import {
  fetchOpenInvoices,
  fetchTodaySchedule,
  fetchAIRiskDigest,
  fetchOnboardingProgress,
  fetchRecurringMaintenance,
  fetchProjectBoard,
  fetchColdLeads,
  fetchWinbackQueue,
  fetchPipelinePulse,
  fetchRevenueCollectedTrend,
} from "@/lib/admin/dashboard-v2";
import { fetchDashboardData, fetchGuestIntelligenceInsights } from "@/lib/admin/dashboard-data";
import { fetchCommunicationsDashboard } from "@/lib/admin/fetch-communications";
import { buildActionItems } from "@/lib/admin/action-items/adapters";
import { composeCockpit } from "@/lib/admin/action-items/compose";
import { formatUsdShort } from "@/lib/admin/action-items/format";
import type { PulseAtom } from "@/lib/admin/action-items/types";
import { PulseBar } from "./PulseBar";
import { NowQueue } from "./NowQueue";
import { ClearState } from "./ClearState";
import { TriageLane } from "./TriageLane";
import styles from "./Today.module.css";

export const metadata: Metadata = { title: "Today" };
export const dynamic = "force-dynamic";

function greeting(now: Date): string {
  const h = now.getHours();
  const part = h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
  return `Good ${part}, Jo`;
}

export default async function AdminTodayPage() {
  const [
    invoices,
    schedule,
    risk,
    onboarding,
    maintenance,
    projects,
    coldLeads,
    winback,
    pipeline,
    revenueTrend,
    { propertyCards },
    communications,
  ] = await Promise.all([
    fetchOpenInvoices(),
    fetchTodaySchedule(),
    fetchAIRiskDigest(),
    fetchOnboardingProgress(),
    fetchRecurringMaintenance(),
    fetchProjectBoard(),
    fetchColdLeads(),
    fetchWinbackQueue(),
    fetchPipelinePulse(),
    fetchRevenueCollectedTrend().catch(() => [] as { date: string; value: number }[]),
    fetchDashboardData(),
    fetchCommunicationsDashboard().catch(() => ({ recentActionItems: [], unresolvedCallers: [] })),
  ]);

  const propertyRefs = propertyCards.map((c) => ({ id: c.id, name: c.address ?? c.name }));
  const { houseActions } = await fetchGuestIntelligenceInsights(propertyRefs).catch(() => ({
    ownerUpdates: [],
    houseActions: [],
  }));

  const items = buildActionItems({
    invoices,
    schedule,
    risk,
    onboarding,
    maintenance,
    projects,
    coldLeads,
    winback,
    houseActions,
    communications,
  });

  // This is a force-dynamic server component that renders once per request, so the
  // request-time clock is intentional and stable for this render. The purity rule
  // targets client render/hooks; it does not apply to a per-request server render.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const pipelineAtom: PulseAtom = {
    key: "pipeline",
    label: "pipeline",
    value: formatUsdShort(pipeline.totalPipelineValue),
    tone: "brand",
    href: "/admin/prospects",
  };
  const view = composeCockpit(items, now, [pipelineAtom]);

  const revenueCollected = revenueTrend.reduce((sum, p) => sum + p.value, 0);
  const healthyCount = propertyCards.length;
  const clearSubline = `${healthyCount} ${healthyCount === 1 ? "property" : "properties"} tracked · ${formatUsdShort(revenueCollected)} collected this month`;

  return (
    <div className={styles.page}>
      <PulseBar greeting={greeting(new Date(now))} atoms={view.pulse} />

      {view.hero.length > 0 ? (
        <NowQueue items={view.hero} overflowCount={view.heroOverflowCount} now={now} />
      ) : (
        <ClearState subline={clearSubline} />
      )}

      <div className={styles.lanes}>
        {view.lanes.map((lane) => (
          <TriageLane key={lane.key} lane={lane} />
        ))}
      </div>
    </div>
  );
}
