import Link from "next/link";
import { Buildings, Stack, UsersThree, House, UserPlus, CaretRight, ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import { getPlatformOverview } from "@/lib/platform/overview";
import { formatNumber, formatUsd, relativeTime } from "@/lib/platform/format";
import { PageHeader } from "@/components/platform/PageHeader";
import { SectionCard } from "@/components/platform/SectionCard";
import { KpiTile } from "@/components/platform/KpiTile";
import { StatDelta } from "@/components/platform/StatDelta";
import { HeroVitalSigns } from "@/components/platform/HeroVitalSigns";
import { FunnelBars } from "@/components/platform/FunnelBars";
import { RetentionGrid } from "@/components/platform/RetentionGrid";
import { StatusDot } from "@/components/platform/StatusDot";
import { Pill } from "@/components/platform/Pill";
import styles from "./Overview.module.css";

export const dynamic = "force-dynamic";

export default async function PlatformOverviewPage() {
  const { kpis, mrr, funnel, retention, health, recentAgencies } = await getPlatformOverview();

  const signupDiff = kpis.signupsThisWeek - kpis.signupsLastWeek;
  const freshestCron = health.crons
    .map((c) => c.lastRunAt)
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1);

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Mission control"
        title="Overview"
        subtitle="The platform's vital signs on one screen. Every agency, owner, and dollar under management."
      />

      <HeroVitalSigns mrr={mrr} />

      <div className={styles.kpis}>
        <KpiTile icon={Buildings} label="Active agencies" value={formatNumber(kpis.activeAgencies)} href="/platform/agencies" />
        <KpiTile icon={Stack} label="Workspaces" value={formatNumber(kpis.workspaces)} sub="Client hubs" />
        <KpiTile icon={UsersThree} label="Owners" value={formatNumber(kpis.owners)} sub="Under management" />
        <KpiTile icon={House} label="Properties" value={formatNumber(kpis.properties)} sub="Under management" />
        <KpiTile
          icon={UserPlus}
          label="New agencies this week"
          value={formatNumber(kpis.signupsThisWeek)}
          delta={
            <StatDelta
              direction={signupDiff > 0 ? "up" : signupDiff < 0 ? "down" : "flat"}
              label={`${signupDiff >= 0 ? "+" : ""}${signupDiff} vs last`}
            />
          }
        />
      </div>

      <div className={styles.twoCol}>
        <SectionCard
          eyebrow="Agency lifecycle"
          title="Activation funnel"
          action={<Pill>{`n = ${funnel.totalAgencies} ${funnel.totalAgencies === 1 ? "agency" : "agencies"}`}</Pill>}
        >
          <FunnelBars stages={funnel.stages} />
        </SectionCard>

        <SectionCard eyebrow="Are agencies sticking" title="Retention">
          <RetentionGrid cohorts={retention.cohorts} totalAgencies={retention.totalAgencies} />
        </SectionCard>
      </div>

      <div className={styles.twoCol}>
        <SectionCard
          eyebrow="Operational"
          title="System health"
          action={
            <Link href="/platform/system" className={styles.cardLink}>
              Details <CaretRight size={12} weight="bold" />
            </Link>
          }
        >
          <div className={styles.healthGlance}>
            <div className={styles.healthOverall}>
              <StatusDot status={health.overall === "operational" ? "ok" : "warn"} label={health.overall} />
              <span className={styles.healthOverallText}>
                {health.overall === "operational" ? "All systems operational" : "Attention needed"}
              </span>
            </div>
            <dl className={styles.healthStats}>
              <div className={styles.healthStat}>
                <dt>Integrations</dt>
                <dd className="pc-mono">{health.configuredCount}/{health.integrationCount} configured</dd>
              </div>
              <div className={styles.healthStat}>
                <dt>Crons registered</dt>
                <dd className="pc-mono">{health.crons.length}</dd>
              </div>
              <div className={styles.healthStat}>
                <dt>Last cron run</dt>
                <dd className="pc-mono">{freshestCron ? relativeTime(freshestCron) : "no run log yet"}</dd>
              </div>
            </dl>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Newest first"
          title="Agencies"
          action={
            <Link href="/platform/agencies" className={styles.cardLink}>
              View all <CaretRight size={12} weight="bold" />
            </Link>
          }
        >
          <div className={styles.agencyList}>
            {recentAgencies.map((a) => (
              <Link key={a.id} href={`/platform/agencies/${a.id}`} className={styles.agencyRow}>
                <span className={styles.agencyMark} aria-hidden="true">
                  {a.name.slice(0, 1).toUpperCase()}
                </span>
                <span className={styles.agencyMeta}>
                  <span className={styles.agencyName}>{a.name}</span>
                  <span className={styles.agencySub}>
                    <span className="pc-mono">{a.workspace_count}</span> workspaces ·{" "}
                    <span className="pc-mono">{a.owner_count}</span> owners ·{" "}
                    <span className="pc-mono">{a.property_count}</span> properties
                  </span>
                </span>
                <span className={styles.agencyRight}>
                  <Pill accent mono>{formatUsd(a.mrr_cents)}/mo</Pill>
                  <span className={styles.agencyActive}>{relativeTime(a.lastActiveAt)}</span>
                </span>
                <ArrowSquareOut size={15} weight="bold" className={styles.agencyArrow} />
              </Link>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
