import { Buildings, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { getActivationFunnel, getAgencyRetention, getSignupsTrend } from "@/lib/platform/growth";
import { formatNumber } from "@/lib/platform/format";
import { PageHeader } from "@/components/platform/PageHeader";
import { SectionCard } from "@/components/platform/SectionCard";
import { KpiTile } from "@/components/platform/KpiTile";
import { StatDelta } from "@/components/platform/StatDelta";
import { FunnelBars } from "@/components/platform/FunnelBars";
import { RetentionGrid } from "@/components/platform/RetentionGrid";
import { BarSeries } from "@/components/platform/BarSeries";
import { Pill } from "@/components/platform/Pill";
import styles from "./Growth.module.css";

export const dynamic = "force-dynamic";

export default async function PlatformGrowthPage() {
  const [funnel, retention, signups] = await Promise.all([
    getActivationFunnel(),
    getAgencyRetention(),
    getSignupsTrend(12),
  ]);

  const agenciesDiff = signups.agenciesThisWeek - signups.agenciesLastWeek;
  const ownersDiff = signups.ownersThisWeek - signups.ownersLastWeek;

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Mission control"
        title="Growth"
        subtitle="How agencies arrive, activate, and stick. Signups, the activation funnel, and retention on one screen."
      />

      <div className={styles.kpis}>
        <KpiTile
          icon={Buildings}
          label="New agencies this week"
          value={formatNumber(signups.agenciesThisWeek)}
          delta={
            <StatDelta
              direction={agenciesDiff > 0 ? "up" : agenciesDiff < 0 ? "down" : "flat"}
              label={`${agenciesDiff >= 0 ? "+" : ""}${agenciesDiff} vs last`}
            />
          }
        />
        <KpiTile
          icon={UsersThree}
          label="New owners this week"
          value={formatNumber(signups.ownersThisWeek)}
          delta={
            <StatDelta
              direction={ownersDiff > 0 ? "up" : ownersDiff < 0 ? "down" : "flat"}
              label={`${ownersDiff >= 0 ? "+" : ""}${ownersDiff} vs last`}
            />
          }
        />
      </div>

      <SectionCard
        eyebrow="Agency lifecycle"
        title="Activation funnel"
        action={<Pill>{`n = ${funnel.totalAgencies} ${funnel.totalAgencies === 1 ? "agency" : "agencies"}`}</Pill>}
      >
        <FunnelBars stages={funnel.stages} />
      </SectionCard>

      <div className={styles.twoCol}>
        <SectionCard eyebrow="Are agencies sticking" title="Retention">
          <RetentionGrid cohorts={retention.cohorts} totalAgencies={retention.totalAgencies} />
        </SectionCard>

        <SectionCard eyebrow="Last 12 weeks" title="Signups">
          <BarSeries points={signups.points} />
        </SectionCard>
      </div>
    </div>
  );
}
