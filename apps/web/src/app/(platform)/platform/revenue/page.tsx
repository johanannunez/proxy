import { Receipt, ChartLineUp, Stack, CreditCard } from "@phosphor-icons/react/dist/ssr";
import { getMrrSummary, getActiveBilling } from "@/lib/platform/revenue";
import { formatUsd, shortDate } from "@/lib/platform/format";
import { PageHeader } from "@/components/platform/PageHeader";
import { SectionCard } from "@/components/platform/SectionCard";
import { StatDelta } from "@/components/platform/StatDelta";
import { Sparkline } from "@/components/platform/Sparkline";
import { BarMeter } from "@/components/platform/BarMeter";
import { DataNote } from "@/components/platform/DataNote";
import { EmptyState } from "@/components/platform/EmptyState";
import { Pill } from "@/components/platform/Pill";
import { StatusDot } from "@/components/platform/StatusDot";
import styles from "./Revenue.module.css";

export const dynamic = "force-dynamic";

export default async function PlatformRevenuePage() {
  const [summary, billing] = await Promise.all([getMrrSummary(), getActiveBilling()]);

  const { delta } = summary;
  const net =
    delta.hasHistory && delta.previousCents != null ? delta.currentCents - delta.previousCents : 0;
  const netLabel = `${net >= 0 ? "+" : "−"}${formatUsd(Math.abs(net))}`;
  const netDirection = net > 0 ? "up" : net < 0 ? "down" : "flat";

  const planTierRows = summary.byPlanTier.map((tier) => ({
    label: tier.planTier.replace(/_/g, " "),
    value: tier.cents,
    display: formatUsd(tier.cents),
    sublabel: `${tier.agencies} ${tier.agencies === 1 ? "agency" : "agencies"}`,
  }));

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Mission control"
        title="Revenue"
        subtitle="Two distinct revenue stories kept separate on purpose. What agencies bill their clients, and what agencies pay Proxy."
      />

      <div className={styles.split}>
        <SectionCard className={styles.heroCard}>
          <div className={styles.heroHead}>
            <span className={styles.heroEyebrow}>Reconciled MRR</span>
            <DataNote>
              Agency-operating MRR. What agencies bill their own clients on Proxy, reconciled across
              legacy subscriptions and new billing schedules. This is not platform-SaaS MRR.
            </DataNote>
          </div>
          <div className={styles.figureRow}>
            <span className={`${styles.figure} pc-mono`}>{formatUsd(summary.reconciledCents)}</span>
            <span className={styles.per}>/mo</span>
          </div>
          <div className={styles.trendRow}>
            {delta.hasHistory ? (
              <StatDelta direction={netDirection} label={`${netLabel} vs yesterday`} />
            ) : (
              <span className={styles.tracking}>
                Tracking since <span className="pc-mono">{shortDate(delta.sinceDate)}</span>
              </span>
            )}
            <span className={styles.trendNote}>
              Across <span className="pc-mono">{summary.totalAgencies}</span>{" "}
              {summary.totalAgencies === 1 ? "agency" : "agencies"}
            </span>
          </div>
          <div className={styles.spark}>
            <Sparkline id="rev-mrr" data={summary.trend.map((p) => p.cents)} height={56} />
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="What agencies pay Proxy"
          title="Platform-SaaS MRR"
          action={
            <Pill mono>
              {summary.billingAgencyCount}{" "}
              {summary.billingAgencyCount === 1 ? "billing agency" : "billing agencies"}
            </Pill>
          }
        >
          <div className={styles.saasBody}>
            <div className={styles.saasFigureRow}>
              <span className={`${styles.saasFigure} pc-mono`}>
                {formatUsd(summary.platformSaasCents)}
              </span>
              <span className={styles.saasPer}>/mo</span>
              <DataNote>
                What agencies pay Proxy. $0 today, the only agency is comped. This is intentional, not
                missing data.
              </DataNote>
            </div>
            <p className={styles.saasNote}>
              No platform price model is wired yet, so this is $0 by construction today. The single
              agency under management is comped.
            </p>
          </div>
        </SectionCard>
      </div>

      <div className={styles.split}>
        <SectionCard eyebrow="Composition" title="MRR by plan tier" action={<ChartLineUp size={17} weight="duotone" className={styles.cardGlyph} />}>
          {planTierRows.length > 0 ? (
            <BarMeter rows={planTierRows} />
          ) : (
            <EmptyState
              icon={Stack}
              title="No agencies on a plan yet"
              message="Plan tier composition fills in as agencies are assigned a plan."
              compact
            />
          )}
        </SectionCard>

        <SectionCard eyebrow="Period over period" title="MRR movement">
          {delta.hasHistory ? (
            <div className={styles.movement}>
              <span className={styles.movementLabel}>Net change vs yesterday</span>
              <div className={styles.movementFigureRow}>
                <span className={`${styles.movementFigure} pc-mono`}>{netLabel}</span>
                <StatDelta direction={netDirection} label="net" />
              </div>
              <p className={styles.movementNote}>
                The new, expansion, contraction, and churn breakdown populates as more daily
                snapshots accumulate.
              </p>
            </div>
          ) : (
            <EmptyState
              icon={ChartLineUp}
              title="Movement accumulates with billing history"
              message="New, expansion, contraction, and churn populate once there are multiple daily snapshots to compare. Today there is only the baseline."
            />
          )}
        </SectionCard>
      </div>

      <SectionCard
        eyebrow="Live subscriptions"
        title="Active billing"
        action={
          <Pill mono>
            {billing.length} {billing.length === 1 ? "line" : "lines"}
          </Pill>
        }
      >
        {billing.length > 0 ? (
          <ul className={styles.billingList}>
            {billing.map((line) => (
              <li key={line.id} className={styles.billingRow}>
                <span className={styles.billingMark} aria-hidden="true">
                  <CreditCard size={16} weight="duotone" />
                </span>
                <span className={styles.billingMeta}>
                  <span className={styles.billingLabel}>{line.label}</span>
                  {!line.attributed && (
                    <span className={styles.billingWarn}>
                      <StatusDot status="warn" label="Unattributed" />
                      <span>
                        Legacy subscription with no workspace, held out of reconciled MRR.
                      </span>
                    </span>
                  )}
                </span>
                <span className={styles.billingRight}>
                  <span className={`${styles.billingPrice} pc-mono`}>
                    {formatUsd(line.priceCents)}/{line.interval}
                  </span>
                  <Pill>{line.status}</Pill>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={Receipt}
            title="No active subscriptions"
            message="Active and trialing subscriptions appear here as agencies begin billing."
          />
        )}
      </SectionCard>
    </div>
  );
}
