'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { Phone, House } from '@phosphor-icons/react';
import type { ContactRow } from '@/lib/admin/contact-types';
import { useContactsFilters, matchesAssigneeFilter } from './ContactsFiltersProvider';
import styles from './ActiveOwnersGrid.module.css';

type Props = {
  rows: ContactRow[];
  basePath?: string;
  useWorkspaceId?: boolean;
};

type HealthTone = 'healthy' | 'attention' | 'risk';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000));
}

function relativeTime(days: number | null): string {
  if (days === null) return '\u2014';
  if (days < 1) return 'today';
  if (days === 1) return '1d';
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(months / 12)}y`;
}

function healthFor(days: number | null): HealthTone {
  if (days === null || days > 30) return 'risk';
  if (days > 7) return 'attention';
  return 'healthy';
}

const HEALTH_COPY: Record<HealthTone, string> = {
  healthy: 'Healthy',
  attention: 'Needs Attention',
  risk: 'At Risk',
};

function rowHref(row: ContactRow, basePath: string, useWorkspaceId: boolean): string {
  if (useWorkspaceId) return `${basePath}/${row.workspaceId ?? row.id}`;
  return `${basePath}/${row.id}`;
}

export function ActiveOwnersGrid({ rows, basePath = '/admin/people', useWorkspaceId = false }: Props) {
  const { sources, assignees } = useContactsFilters();

  const filteredRows = useMemo(() => {
    if (sources.length === 0 && assignees.length === 0) return rows;
    return rows.filter((r) => {
      if (sources.length > 0 && (!r.source || !sources.includes(r.source))) {
        return false;
      }
      if (!matchesAssigneeFilter(assignees, r.assignedTo)) return false;
      return true;
    });
  }, [rows, sources, assignees]);

  if (filteredRows.length === 0) {
    return <div className={styles.empty}>No active owners match the current filters.</div>;
  }

  const buckets: Record<HealthTone, number> = { healthy: 0, attention: 0, risk: 0 };
  for (const r of filteredRows) {
    buckets[healthFor(daysSince(r.lastActivityAt))]++;
  }
  const totalProperties = filteredRows.reduce((sum, r) => sum + r.propertyCount, 0);

  return (
    <div className={styles.wrap}>
      <div className={styles.summary}>
        <span className={styles.summaryItem}>
          <span className={styles.dotHealthy} aria-hidden />
          <strong>{buckets.healthy}</strong> healthy
        </span>
        <span className={styles.summaryItem}>
          <span className={styles.dotAttention} aria-hidden />
          <strong>{buckets.attention}</strong> need attention
        </span>
        <span className={styles.summaryItem}>
          <span className={styles.dotRisk} aria-hidden />
          <strong>{buckets.risk}</strong> at risk
        </span>
        <span className={styles.summarySep} aria-hidden />
        <span className={styles.summaryItem}>
          <strong>{totalProperties}</strong>{' '}
          <span className={styles.muted}>properties under management</span>
        </span>
      </div>

      <div className={styles.grid}>
        {filteredRows.map((r) => {
          const days = daysSince(r.lastActivityAt);
          const health = healthFor(days);
          const href = rowHref(r, basePath, useWorkspaceId);

          const displayedProperties = r.properties.slice(0, 5);
          const extraProperties = r.properties.length - 5;

          return (
            <Link key={r.id} href={href} className={styles.card} data-tone={health}>
              {/* Colored gradient strip */}
              <div className={styles.strip} data-tone={health}>
                <span className={styles.stripName}>{r.fullName}</span>
                <span className={styles.healthBadge}>{HEALTH_COPY[health]}</span>
              </div>

              {/* Avatar overlapping strip */}
              <div className={styles.avatarWrap}>
                {r.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- dynamic owner avatar URL from Supabase, dimensions unknown at render time
                  <img
                    src={r.avatarUrl}
                    alt={r.fullName}
                    className={styles.avatarImg}
                  />
                ) : (
                  <span className={styles.avatarInitials} aria-hidden>
                    {initials(r.fullName)}
                  </span>
                )}
              </div>

              {/* Identity block */}
              <div className={styles.identity}>
                <div className={styles.name}>{r.fullName}</div>
                {r.companyName ? (
                  <div className={styles.company}>{r.companyName}</div>
                ) : null}
                {(r.phone || r.email) ? (
                  <div className={styles.contactLine}>
                    <Phone size={13} weight="regular" className={styles.phoneIcon} />
                    {r.phone ? <span>{r.phone}</span> : null}
                    {r.phone && r.email ? <span className={styles.bullet}>&middot;</span> : null}
                    {r.email ? <span>{r.email}</span> : null}
                  </div>
                ) : null}
              </div>

              {/* Properties strip */}
              {(displayedProperties.length > 0 || r.propertyCount > 0) ? (
                <div className={styles.propertiesList}>
                  {displayedProperties.length > 0 ? (
                    <>
                      {displayedProperties.map((p) => {
                        const addr =
                          p.addressLine1 +
                          (p.city ? `, ${p.city}` : '') +
                          (p.state ? ` ${p.state}` : '');
                        return (
                          <div key={p.id} className={styles.propertyRow}>
                            <House size={11} weight="regular" className={styles.houseIcon} />
                            <span className={styles.propertyAddr}>{addr}</span>
                          </div>
                        );
                      })}
                      {extraProperties > 0 ? (
                        <div className={styles.propertyMore}>+{extraProperties} more</div>
                      ) : null}
                    </>
                  ) : (
                    <div className={styles.propertyRow}>
                      <House size={11} weight="regular" className={styles.houseIcon} />
                      <span className={styles.propertyAddr}>{r.propertyCount} properties</span>
                    </div>
                  )}
                </div>
              ) : null}

              {/* Footer stats */}
              <footer className={styles.foot}>
                <span className={styles.footStat}>
                  Owner for {relativeTime(daysSince(r.stageChangedAt))}
                </span>
                <span className={styles.footDot} aria-hidden>·</span>
                <span className={styles.footStat}>
                  Last spoke {relativeTime(days)}
                </span>
                <span className={styles.footDot} aria-hidden>·</span>
                {r.assignedToName ? (
                  <span className={styles.footAssignee}>
                    <span className={styles.assigneeDot} aria-hidden />
                    {r.assignedToName}
                  </span>
                ) : (
                  <span className={styles.footMuted}>Unassigned</span>
                )}
              </footer>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
