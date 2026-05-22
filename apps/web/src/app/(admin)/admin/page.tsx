// apps/web/src/app/(admin)/admin/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';

// Data layer
import {
  fetchCommandStripData,
  fetchPipelinePulse,
  fetchColdLeads,
  fetchOwnerActivity,
  fetchTodaySchedule,
  fetchOnboardingProgress,
  fetchAIRiskDigest,
  fetchAllocationHealth,
  fetchOpenInvoices,
  fetchRecurringMaintenance,
  fetchProjectBoard,
  fetchWinbackQueue,
  fetchPipelineTrend,
  fetchOwnerGrowthTrend,
  fetchRevenueCollectedTrend,
} from '@/lib/admin/dashboard-v2';
import { fetchDashboardData, fetchGuestIntelligenceInsights } from '@/lib/admin/dashboard-data';
import { fetchDailyBriefing } from '@/lib/admin/dashboard-briefing';
import { fetchCommunicationsDashboard } from '@/lib/admin/fetch-communications';

// Widgets
import { CommandStrip } from './CommandStrip';
import { AIBriefingCard } from './AIBriefingCard';
import { KPISparklineRow } from './KPISparklineRow';
import { PipelinePulse } from './PipelinePulse';
import { ColdLeadsWidget } from './ColdLeadsWidget';
import { OwnerActivityWidget } from './OwnerActivityWidget';
import { TodayScheduleWidget } from './TodayScheduleWidget';
import { OnboardingProgressWidget } from './OnboardingProgressWidget';
import { AIRiskDigest } from './AIRiskDigest';
import { AllocationHealthWidget } from './AllocationHealthWidget';
import { OpenInvoicesWidget } from './OpenInvoicesWidget';
import { RecurringMaintenanceWidget } from './RecurringMaintenanceWidget';
import { ProjectBoardWidget } from './ProjectBoardWidget';
import { WinbackQueueWidget } from './WinbackQueueWidget';
import { GuestPulse } from './GuestPulse';
import { DashboardClientShell } from './DashboardClientShell';
import { CommunicationsPanel } from '@/components/admin/CommunicationsPanel';

// Property health types
import type { PropertyHealthCard, CategoryHealth } from '@/lib/admin/dashboard-data';
import styles from './page.module.css';

export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

function worstColor(status: string | null): 'green' | 'amber' | 'red' {
  if (!status) return 'green';
  if (status === 'stuck') return 'red';
  return 'amber';
}

function overallColor(colors: Array<'green' | 'amber' | 'red'>): 'green' | 'amber' | 'red' {
  if (colors.includes('red')) return 'red';
  if (colors.includes('amber')) return 'amber';
  return 'green';
}

function catBarPct(health: CategoryHealth): number {
  return health.total > 0 ? Math.round((health.done / health.total) * 100) : 0;
}

export default async function AdminDashboardPage() {
  // Fetch all data in parallel
  const [
    stripData,
    pipelineData,
    coldData,
    ownerActivityData,
    scheduleData,
    onboardingData,
    riskData,
    allocationData,
    invoicesData,
    maintenanceData,
    projectsData,
    winbackData,
    { propertyCards },
    pipelineTrend,
    ownerTrend,
    revenueTrend,
    communicationsDashboard,
  ] = await Promise.all([
    fetchCommandStripData(),
    fetchPipelinePulse(),
    fetchColdLeads(),
    fetchOwnerActivity(),
    fetchTodaySchedule(),
    fetchOnboardingProgress(),
    fetchAIRiskDigest(),
    fetchAllocationHealth(),
    fetchOpenInvoices(),
    fetchRecurringMaintenance(),
    fetchProjectBoard(),
    fetchWinbackQueue(),
    fetchDashboardData(),
    fetchPipelineTrend().catch(() => []),
    fetchOwnerGrowthTrend().catch(() => []),
    fetchRevenueCollectedTrend().catch(() => []),
    fetchCommunicationsDashboard().catch(() => ({ recentActionItems: [], unresolvedCallers: [] })),
  ]);

  const propertyRefs = propertyCards.map((c) => ({ id: c.id, name: c.address ?? c.name }));
  const [guestInsights, briefing] = await Promise.all([
    fetchGuestIntelligenceInsights(propertyRefs).catch(() => ({ ownerUpdates: [], houseActions: [] })),
    fetchDailyBriefing(stripData, {
      coldLeadsCount: coldData.total,
      onboardingCount: onboardingData.total,
      criticalInsights: riskData.criticalCount,
      warningInsights: riskData.warningCount,
      maintenanceOverdue: maintenanceData.overdueCount,
      maintenanceDueSoon: maintenanceData.dueSoonCount,
      projectsBlocked: projectsData.blocked,
      winbackCount: winbackData.total,
      invoicesOverdue: invoicesData.overdueCount,
      allocationStatus: allocationData.overallStatus,
    }).catch(() => null),
  ]);

  const revenueCollectedTotal = revenueTrend.reduce((sum, p) => sum + p.value, 0);

  return (
    <DashboardClientShell>
      <div className={styles.page}>
        {/* Zone A: Command Strip */}
        <div className={styles.commandStripRow}>
          <CommandStrip data={stripData} />
        </div>

        {/* Zone B: AI Daily Briefing */}
        <div className={styles.briefingRow}>
          <AIBriefingCard briefing={briefing} />
        </div>

        {/* Zone C: KPI Sparkline Row */}
        <div className={styles.kpiRow}>
          <KPISparklineRow
            pipelineMrr={pipelineData.totalPipelineValue}
            pipelineTrend={pipelineTrend}
            activeOwners={ownerActivityData.active}
            ownerTrend={ownerTrend}
            revenueCollected={revenueCollectedTotal}
            revenueTrend={revenueTrend}
          />
        </div>

        {/* Zone D: Bento Widget Grid */}
        <div className={styles.grid} id="dashboard-grid">
          {/* ── Operations ───────────────────────────────────────────── */}
          <div className={styles.sectionDivider}>Operations</div>
          <div className={styles.col2} data-widget="todaySchedule">
            <TodayScheduleWidget data={scheduleData} />
          </div>
          <div className={styles.col2} data-widget="onboarding">
            <OnboardingProgressWidget data={onboardingData} />
          </div>
          <div className={styles.col2} data-widget="recurringMaintenance">
            <RecurringMaintenanceWidget data={maintenanceData} />
          </div>

          {/* ── Intelligence ─────────────────────────────────────────── */}
          <div className={styles.sectionDivider}>Intelligence</div>
          <div className={styles.col2} data-widget="aiRiskDigest">
            <AIRiskDigest data={riskData} />
          </div>
          <div className={styles.col2} data-widget="projectBoard">
            <ProjectBoardWidget data={projectsData} />
          </div>

          {/* ── Financial ────────────────────────────────────────────── */}
          <div className={styles.sectionDivider}>Financial</div>
          <div className={styles.col2} data-widget="allocationHealth">
            <AllocationHealthWidget data={allocationData} />
          </div>
          <div className={styles.col2} data-widget="openInvoices">
            <OpenInvoicesWidget data={invoicesData} />
          </div>

          {/* ── Growth ───────────────────────────────────────────────── */}
          <div className={styles.sectionDivider}>Growth</div>
          <div className={styles.col2} data-widget="pipelinePulse">
            <PipelinePulse data={pipelineData} />
          </div>
          <div className={styles.col1} data-widget="ownerActivity">
            <OwnerActivityWidget data={ownerActivityData} />
          </div>
          <div className={styles.col1} data-widget="coldLeads">
            <ColdLeadsWidget data={coldData} />
          </div>
          <div className={styles.col2} data-widget="winbackQueue">
            <WinbackQueueWidget data={winbackData} />
          </div>
        </div>

        {/* Zone E: Guest Intelligence */}
        <div className={styles.guestIntelRow} data-widget="guestIntelligence">
          <div className={styles.sectionLabel}>Guest Intelligence</div>
          <GuestPulse
            ownerUpdates={guestInsights.ownerUpdates}
            houseActions={guestInsights.houseActions}
          />
        </div>

        {/* Zone F: Communications Panel */}
        <div className={styles.communicationsRow}>
          <CommunicationsPanel data={communicationsDashboard} />
        </div>

        {/* Zone G: Property Health Grid */}
        <div className={styles.healthRow}>
          <div className={styles.sectionLabel}>Property Health</div>
          <div className={styles.healthGrid}>
            {propertyCards.map((card: PropertyHealthCard) => {
              const docColor = worstColor(card.documents.worst);
              const finColor = worstColor(card.finances.worst);
              const listColor = worstColor(card.listings.worst);
              const borderCls = overallColor([docColor, finColor, listColor]);

              return (
                <Link
                  key={card.id}
                  href={card.href}
                  className={`${styles.healthCard} ${styles[`healthCard--${borderCls}`]}`}
                >
                  {card.coverPhotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={card.coverPhotoUrl} alt={card.name} className={styles.healthCover} />
                  ) : (
                    <div className={styles.healthCover} />
                  )}
                  <div className={styles.healthBody}>
                    <div className={styles.healthAddress}>{card.address ?? card.name}</div>
                    <div className={styles.healthLocation}>{card.city}, {card.state}</div>
                    <div className={styles.healthCats}>
                      {(
                        [
                          { label: 'Docs', health: card.documents, color: docColor },
                          { label: 'Fin',  health: card.finances,  color: finColor  },
                          { label: 'List', health: card.listings,  color: listColor },
                        ] as const
                      ).map(({ label, health, color }) => (
                        <div key={label} className={styles.healthCatRow}>
                          <span className={styles.healthCatLabel}>{label}</span>
                          <div className={styles.healthBarTrack}>
                            <div
                              className={`${styles.healthBarFill} ${styles[`healthBarFill--${color}`]}`}
                              style={{ width: `${catBarPct(health)}%` }}
                            />
                          </div>
                          <span className={styles.healthCatCount}>{health.done}/{health.total}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </DashboardClientShell>
  );
}
