import Link from "next/link";
import { Buildings, Stack, UsersThree, House, ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import { getAgenciesDirectory } from "@/lib/platform/agencies";
import { formatNumber, formatUsd, relativeTime } from "@/lib/platform/format";
import { PageHeader } from "@/components/platform/PageHeader";
import { SectionCard } from "@/components/platform/SectionCard";
import { KpiTile } from "@/components/platform/KpiTile";
import { Pill } from "@/components/platform/Pill";
import { StatusDot } from "@/components/platform/StatusDot";
import { EmptyState } from "@/components/platform/EmptyState";
import styles from "./Agencies.module.css";

export const dynamic = "force-dynamic";

function planLabel(tier: string | null): string {
  if (!tier) return "No plan";
  return tier
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default async function PlatformAgenciesPage() {
  const agencies = await getAgenciesDirectory();

  const totals = agencies.reduce(
    (acc, a) => ({
      workspaces: acc.workspaces + a.workspace_count,
      owners: acc.owners + a.owner_count,
      properties: acc.properties + a.property_count,
    }),
    { workspaces: 0, owners: 0, properties: 0 },
  );

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Mission control"
        title="Agencies"
        subtitle="Every subscriber agency on Proxy, with the workspaces, owners, properties, and revenue under each one."
      />

      <div className={styles.kpis}>
        <KpiTile icon={Buildings} label="Agencies" value={formatNumber(agencies.length)} sub="On the platform" />
        <KpiTile icon={Stack} label="Workspaces" value={formatNumber(totals.workspaces)} sub="Client hubs" />
        <KpiTile icon={UsersThree} label="Owners" value={formatNumber(totals.owners)} sub="Under management" />
        <KpiTile icon={House} label="Properties" value={formatNumber(totals.properties)} sub="Under management" />
      </div>

      <SectionCard
        eyebrow="Newest first"
        title="Directory"
        action={
          <Pill mono>
            {formatNumber(agencies.length)} {agencies.length === 1 ? "agency" : "agencies"}
          </Pill>
        }
      >
        {agencies.length === 0 ? (
          <EmptyState
            icon={Buildings}
            title="No agencies yet"
            message="As operators sign up, every agency appears here with its workspaces, owners, properties, and revenue."
          />
        ) : (
          <div className={styles.list}>
            <div className={styles.listHead} aria-hidden="true">
              <span className={styles.colAgency}>Agency</span>
              <span className={styles.colCounts}>Workspaces</span>
              <span className={styles.colCounts}>Members</span>
              <span className={styles.colCounts}>Owners</span>
              <span className={styles.colCounts}>Properties</span>
              <span className={styles.colMrr}>MRR</span>
              <span className={styles.colActive}>Last active</span>
            </div>

            {agencies.map((a) => (
              <Link key={a.id} href={`/platform/agencies/${a.id}`} className={styles.row}>
                <span className={styles.colAgency}>
                  <span className={styles.mark} aria-hidden="true">
                    {a.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className={styles.identity}>
                    <span className={styles.name}>{a.name}</span>
                    <span className={styles.planRow}>
                      <Pill>{planLabel(a.plan_tier)}</Pill>
                      <span className={styles.billing}>
                        <StatusDot
                          status={a.has_billing ? "ok" : "neutral"}
                          label={a.has_billing ? "Billing connected" : "No billing"}
                        />
                        <span className={styles.billingText}>{a.has_billing ? "Billing" : "Comped"}</span>
                      </span>
                    </span>
                  </span>
                </span>

                <span className={`${styles.colCounts} pc-mono`}>{formatNumber(a.workspace_count)}</span>
                <span className={`${styles.colCounts} pc-mono`}>{formatNumber(a.member_count)}</span>
                <span className={`${styles.colCounts} pc-mono`}>{formatNumber(a.owner_count)}</span>
                <span className={`${styles.colCounts} pc-mono`}>{formatNumber(a.property_count)}</span>

                <span className={styles.colMrr}>
                  <Pill accent mono>
                    {formatUsd(a.mrr_cents)}/mo
                  </Pill>
                </span>

                <span className={styles.colActive}>
                  <span className={styles.activeText}>{relativeTime(a.lastActiveAt)}</span>
                  <ArrowSquareOut size={15} weight="bold" className={styles.arrow} />
                </span>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
