import { ShieldCheck, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { getSupportAccessLog } from "@/lib/platform/support-access";
import { formatNumber, timestampUtc, formatDuration } from "@/lib/platform/format";
import { PageHeader } from "@/components/platform/PageHeader";
import { SectionCard } from "@/components/platform/SectionCard";
import { StatusDot } from "@/components/platform/StatusDot";
import { Pill } from "@/components/platform/Pill";
import { EmptyState } from "@/components/platform/EmptyState";
import styles from "./SupportAccess.module.css";

export const dynamic = "force-dynamic";

export default async function SupportAccessPage() {
  const log = await getSupportAccessLog();
  const hasActive = log.activeCount > 0;

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Compliance"
        title="Support access"
        subtitle="Every time platform staff view an agency as one of its owners, the session is recorded here. The wall stays up, and there is a paper trail behind it."
      />

      <SectionCard eyebrow="Live count" title="Access sessions">
        <div className={styles.summary}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>
              <StatusDot status={hasActive ? "warn" : "ok"} label={hasActive ? "active" : "clear"} />
              Active now
            </span>
            <span className={`${styles.statValue} pc-mono`}>{formatNumber(log.activeCount)}</span>
          </div>
          <div className={styles.statDivider} aria-hidden="true" />
          <div className={styles.stat}>
            <span className={styles.statLabel}>Total sessions</span>
            <span className={`${styles.statValue} pc-mono`}>{formatNumber(log.totalCount)}</span>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Audit log"
        title="Who entered which agency"
        action={<Pill mono>{`${formatNumber(log.totalCount)} ${log.totalCount === 1 ? "record" : "records"}`}</Pill>}
      >
        {log.sessions.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No one has entered an agency yet"
            message="That is the point. The moment platform staff view as an owner, the session, the owner viewed, and how long it lasted are recorded here for the record."
          />
        ) : (
          <ol className={styles.log}>
            {log.sessions.map((session) => (
              <li key={session.id} className={styles.row}>
                <span className={styles.rowIcon} aria-hidden="true">
                  <ShieldCheck size={18} weight="duotone" />
                </span>

                <div className={styles.rowBody}>
                  <p className={styles.rowPrincipals}>
                    <span className={styles.actor}>{session.actorName}</span>
                    <ArrowRight size={13} weight="bold" className={styles.arrow} aria-hidden="true" />
                    <span className={styles.agency}>{session.agencyName ?? "Unknown agency"}</span>
                  </p>
                  <p className={styles.rowMeta}>
                    Viewed as <span className={styles.owner}>{session.ownerName ?? "an owner"}</span>
                    <span className={styles.dot} aria-hidden="true">·</span>
                    Started <span className="pc-mono">{timestampUtc(session.startedAt)}</span>
                  </p>
                </div>

                <div className={styles.rowRight}>
                  <Pill accent={session.active}>{session.active ? "Active now" : "Ended"}</Pill>
                  {!session.active && (
                    <span className={`${styles.duration} pc-mono`}>{formatDuration(session.durationMs)}</span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </SectionCard>
    </div>
  );
}
