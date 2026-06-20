import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Stack,
  UsersThree,
  House,
  CurrencyDollar,
  FileText,
  ClockCounterClockwise,
} from "@phosphor-icons/react/dist/ssr";
import { getAgencyDetail } from "@/lib/platform/agencies";
import { formatNumber, formatUsd, relativeTime } from "@/lib/platform/format";
import { PageHeader } from "@/components/platform/PageHeader";
import { SectionCard } from "@/components/platform/SectionCard";
import { KpiTile } from "@/components/platform/KpiTile";
import { Pill } from "@/components/platform/Pill";
import { StatusDot } from "@/components/platform/StatusDot";
import { EmptyState } from "@/components/platform/EmptyState";
import { DataNote } from "@/components/platform/DataNote";
import { BarMeter } from "@/components/platform/BarMeter";
import { FunnelBars } from "@/components/platform/FunnelBars";
import styles from "./AgencyDetail.module.css";

export const dynamic = "force-dynamic";

function planLabel(tier: string | null): string {
  if (!tier) return "No plan";
  return tier
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default async function AgencyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getAgencyDetail(id);
  if (!detail) notFound();

  const { agency, mrr, people, clientFunnel, signedDocuments, workspaces, recentActivity } = detail;

  const mrrRows = [
    { label: "Reconciled", value: mrr.reconciledCents, display: `${formatUsd(mrr.reconciledCents)}/mo`, sublabel: "Confirmed against live billing" },
    { label: "Schedule", value: mrr.scheduleCents, display: `${formatUsd(mrr.scheduleCents)}/mo`, sublabel: "Committed on billing schedules" },
    { label: "Legacy", value: mrr.legacyCents, display: `${formatUsd(mrr.legacyCents)}/mo`, sublabel: "Attributed to a workspace" },
    {
      label: "Legacy, unattributed",
      value: mrr.legacyUnattributedCents,
      display: `${formatUsd(mrr.legacyUnattributedCents)}/mo`,
      sublabel: "Held out of reconciled MRR",
    },
  ];

  const funnelStages = clientFunnel.map((stage, i) => ({
    key: `client-${i}`,
    label: stage.label,
    count: stage.count,
    definition: stage.definition,
  }));

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Agency"
        title={agency.name}
        subtitle={`${planLabel(agency.plan_tier)} plan. Joined ${relativeTime(agency.created_at)}.`}
        actions={
          <Link href="/platform/agencies" className={styles.backLink}>
            <ArrowLeft size={14} weight="bold" />
            Back to agencies
          </Link>
        }
      />

      <div className={styles.kpis}>
        <KpiTile icon={Stack} label="Workspaces" value={formatNumber(workspaces.length)} sub="Client hubs" />
        <KpiTile icon={UsersThree} label="Owners" value={formatNumber(people.owners)} sub={`${formatNumber(people.staff)} staff`} />
        <KpiTile icon={House} label="Properties" value={formatNumber(agency.property_count)} sub="Under management" />
        <KpiTile icon={CurrencyDollar} label="Reconciled MRR" value={`${formatUsd(mrr.reconciledCents)}/mo`} sub="Live billing" />
      </div>

      <div className={styles.twoCol}>
        <SectionCard
          eyebrow="Operating revenue"
          title="MRR breakdown"
          action={
            <DataNote>
              Legacy, unattributed is an active legacy subscription whose owner has no workspace yet, so it is held out of reconciled MRR.
            </DataNote>
          }
        >
          <BarMeter rows={mrrRows} />
        </SectionCard>

        <SectionCard
          eyebrow="Client onboarding"
          title="Client funnel"
          action={
            <Pill mono>
              {formatNumber(workspaces.length)} {workspaces.length === 1 ? "workspace" : "workspaces"}
            </Pill>
          }
        >
          <FunnelBars stages={funnelStages} />
          <div className={styles.docStat}>
            <span className={styles.docStatIcon}>
              <FileText size={16} weight="duotone" />
            </span>
            <span className={styles.docStatLabel}>Documents signed</span>
            <span className={`${styles.docStatValue} pc-mono`}>{formatNumber(signedDocuments)}</span>
          </div>
        </SectionCard>
      </div>

      <div className={styles.twoCol}>
        <SectionCard
          eyebrow="Client hubs"
          title="Workspaces"
          action={
            <Pill mono>
              {formatNumber(workspaces.length)} {workspaces.length === 1 ? "workspace" : "workspaces"}
            </Pill>
          }
        >
          {workspaces.length === 0 ? (
            <EmptyState
              icon={Stack}
              compact
              title="No workspaces yet"
              message="When this agency creates its first client hub, it appears here with owners and billing status."
            />
          ) : (
            <div className={styles.workspaceList}>
              {workspaces.map((w) => (
                <div key={w.id} className={styles.workspaceRow}>
                  <span className={styles.workspaceMeta}>
                    <span className={styles.workspaceName}>{w.name}</span>
                    <span className={styles.workspaceSub}>
                      {w.type ? <span className={styles.workspaceType}>{w.type}</span> : null}
                      <span>
                        <span className="pc-mono">{formatNumber(w.owners)}</span>{" "}
                        {w.owners === 1 ? "owner" : "owners"}
                      </span>
                    </span>
                  </span>
                  <span className={styles.workspaceBilling}>
                    <StatusDot
                      status={w.hasPaidInvoice ? "ok" : "neutral"}
                      label={w.hasPaidInvoice ? "Has a paid invoice" : "No payment yet"}
                    />
                    <span className={styles.workspaceBillingText}>{w.hasPaidInvoice ? "Paid" : "Not yet"}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard eyebrow="Audit trail" title="Recent activity">
          {recentActivity.length === 0 ? (
            <EmptyState
              icon={ClockCounterClockwise}
              compact
              title="No recent activity"
              message="Actions taken inside this agency will show here as they happen."
            />
          ) : (
            <ol className={styles.timeline}>
              {recentActivity.map((event) => (
                <li key={event.id} className={styles.timelineItem}>
                  <span className={styles.timelineDot} aria-hidden="true" />
                  <span className={styles.timelineBody}>
                    <span className={styles.timelineAction}>{event.action}</span>
                    {event.entityType ? (
                      <span className={styles.timelineEntity}>{event.entityType}</span>
                    ) : null}
                  </span>
                  <span className={`${styles.timelineTime} pc-mono`}>{relativeTime(event.createdAt)}</span>
                </li>
              ))}
            </ol>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
