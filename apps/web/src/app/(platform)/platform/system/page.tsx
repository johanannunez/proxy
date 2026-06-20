import {
  Buildings,
  Stack,
  House,
  Plug,
  Clock,
  Pulse,
} from "@phosphor-icons/react/dist/ssr";
import { getSystemHealth } from "@/lib/platform/system-health";
import { formatNumber, relativeTime } from "@/lib/platform/format";
import { PageHeader } from "@/components/platform/PageHeader";
import { SectionCard } from "@/components/platform/SectionCard";
import { KpiTile } from "@/components/platform/KpiTile";
import { StatusDot } from "@/components/platform/StatusDot";
import { Pill } from "@/components/platform/Pill";
import { DataNote } from "@/components/platform/DataNote";
import styles from "./System.module.css";

export const dynamic = "force-dynamic";

export default async function PlatformSystemPage() {
  const health = await getSystemHealth();
  const operational = health.overall === "operational";

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Operational"
        title="System health"
        subtitle="Server-side credential presence and scheduled jobs across the platform. Day-one truth, not live uptime probing yet."
      />

      <section
        className={`${styles.banner}${operational ? ` ${styles.bannerOk}` : ` ${styles.bannerWarn}`}`}
      >
        <span className={styles.bannerLead}>
          <StatusDot status={operational ? "ok" : "warn"} label={health.overall} />
          <span className={styles.bannerHeadline}>
            {operational ? "All systems operational" : "Attention needed"}
          </span>
        </span>
        <span className={styles.bannerMeta}>
          <span className="pc-mono">
            {health.configuredCount}/{health.integrationCount}
          </span>{" "}
          integrations configured
        </span>
      </section>

      <SectionCard
        eyebrow="Credentials"
        title="Integrations"
        action={
          <DataNote label="What configured means">
            Configured means every required credential is present on the server. It does not measure live uptime, only that the keys exist.
          </DataNote>
        }
      >
        <div className={styles.integrationGrid}>
          {health.integrations.map((integration) => (
            <div key={integration.key} className={styles.integrationCard}>
              <span className={styles.integrationIcon} aria-hidden="true">
                <Plug size={17} weight="duotone" />
              </span>
              <span className={styles.integrationMeta}>
                <span className={styles.integrationName}>{integration.label}</span>
                <span className={styles.integrationCategory}>{integration.category}</span>
              </span>
              <span className={styles.integrationStatus}>
                <StatusDot
                  status={integration.configured ? "ok" : "neutral"}
                  label={integration.configured ? "Configured" : "Not configured"}
                />
                <span
                  className={`${styles.integrationStatusText}${integration.configured ? ` ${styles.integrationStatusOn}` : ""}`}
                >
                  {integration.configured ? "Configured" : "Not configured"}
                </span>
              </span>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Cron registry"
        title="Scheduled jobs"
        action={
          <DataNote label="About cron telemetry">
            Only some jobs write a run log today. Jobs marked tracked report a real last run, the rest are scheduled but not yet instrumented.
          </DataNote>
        }
      >
        <ul className={styles.cronList}>
          {health.crons.map((cron) => (
            <li key={cron.path} className={styles.cronRow}>
              <span className={styles.cronIcon} aria-hidden="true">
                <Clock size={16} weight="duotone" />
              </span>
              <span className={styles.cronMeta}>
                <span className={styles.cronName}>{cron.label}</span>
                <span className={`${styles.cronCadence} pc-mono`}>{cron.cadence}</span>
              </span>
              <span className={styles.cronRight}>
                {cron.instrumented ? (
                  <Pill accent>Tracked</Pill>
                ) : (
                  <Pill>Not instrumented</Pill>
                )}
                <span className={`${styles.cronLastRun} pc-mono`}>
                  {cron.lastRunAt ? relativeTime(cron.lastRunAt) : "no run log yet"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard eyebrow="Under management" title="Operational scope">
        <div className={styles.scopeGrid}>
          <KpiTile icon={Buildings} label="Agencies" value={formatNumber(health.scope.agencies)} sub="Subscriber agencies" />
          <KpiTile icon={Stack} label="Workspaces" value={formatNumber(health.scope.workspaces)} sub="Client hubs" />
          <KpiTile icon={House} label="Properties" value={formatNumber(health.scope.properties)} sub="Under management" />
        </div>
        <p className={styles.scopeFootnote}>
          <Pulse size={13} weight="bold" aria-hidden="true" />
          Live counts queried with service-role access across every agency.
        </p>
      </SectionCard>
    </div>
  );
}
