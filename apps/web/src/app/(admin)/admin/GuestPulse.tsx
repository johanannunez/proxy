'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { AnimatePresence } from 'motion/react';
import { ArrowsClockwise, X } from '@phosphor-icons/react';
import ConfirmModal from '@/components/admin/ConfirmModal';
import type { EnrichedInsight } from '@/lib/admin/dashboard-data';
import { dismissInsight, triggerGuestIntelligenceSync } from '@/lib/admin/insight-actions';
import { InsightDetailPanel } from './InsightDetailPanel';
import styles from './GuestPulse.module.css';

const MAX_PER_COLUMN = 4;

type Props = {
  ownerUpdates: EnrichedInsight[];
  houseActions: EnrichedInsight[];
};

function severityLabel(severity: EnrichedInsight['severity'], isCritical: boolean): string {
  if (isCritical) return 'Critical';
  if (severity === 'warning') return 'Warning';
  if (severity === 'recommendation') return 'Recommendation';
  return 'Info';
}

function categoryLabel(isCritical: boolean, bucket: string): string {
  if (isCritical) return 'Emergency';
  if (bucket === 'house_action') return 'House Fix';
  return 'Owner Update';
}

function excerpt(body: string): string {
  if (body.length <= 110) return body;
  return body.slice(0, 110).trimEnd() + '…';
}

function InsightCard({
  insight,
  onOpen,
  onDismiss,
}: {
  insight: EnrichedInsight;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const isCritical = Boolean(insight.payload.isCritical);
  const { severity } = insight;
  const badgeCls =
    isCritical ? styles.badgeCritical :
    severity === 'warning' ? styles.badgeWarning :
    severity === 'recommendation' ? styles.badgeRecommendation :
    styles.badgeInfo;

  return (
    <div
      className={`${styles.card}${isCritical ? ` ${styles.cardEmergency}` : ''}`}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
    >
      <div className={styles.cardTop}>
        <div className={styles.badgeRow}>
          <span className={`${styles.badge} ${badgeCls}`}>
            {severityLabel(severity, isCritical)}
          </span>
          <span className={styles.categoryChip}>
            {categoryLabel(isCritical, insight.payload.bucket)}
          </span>
          <span className={styles.sourceCount}>
            {insight.payload.sourceCount}{' '}
            {insight.payload.sourceCount === 1 ? 'mention' : 'mentions'}
          </span>
        </div>
        <button
          type="button"
          className={styles.dismissBtn}
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          aria-label="Dismiss"
        >
          <X size={11} weight="bold" />
        </button>
      </div>
      <div className={styles.cardTitle}>{insight.title}</div>
      <p className={styles.cardExcerpt}>{excerpt(insight.body)}</p>
      <div className={styles.propName}>{insight.propertyName}</div>
    </div>
  );
}

function Column({
  label,
  labelMod,
  insights,
  dismissed,
  onOpen,
  onRequestDismiss,
}: {
  label: string;
  labelMod?: string;
  insights: EnrichedInsight[];
  dismissed: Set<string>;
  onOpen: (ins: EnrichedInsight) => void;
  onRequestDismiss: (ins: EnrichedInsight) => void;
}) {
  const visible = insights.filter((i) => !dismissed.has(i.id));
  const shown = visible.slice(0, MAX_PER_COLUMN);
  const overflow = visible.length - MAX_PER_COLUMN;

  return (
    <div className={styles.col}>
      <div className={`${styles.colLabel}${labelMod ? ` ${labelMod}` : ''}`}>{label}</div>
      <div className={styles.cardList}>
        {shown.length === 0 ? (
          <div className={styles.empty}>None right now.</div>
        ) : (
          shown.map((ins) => (
            <InsightCard
              key={ins.id}
              insight={ins}
              onOpen={() => onOpen(ins)}
              onDismiss={() => onRequestDismiss(ins)}
            />
          ))
        )}
        {overflow > 0 && (
          <Link href="/admin/guest-pulse" className={styles.viewAllLink}>
            +{overflow} more. View all
          </Link>
        )}
      </div>
    </div>
  );
}

export function GuestPulse({ ownerUpdates, houseActions }: Props) {
  const [activeInsight, setActiveInsight] = useState<EnrichedInsight | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [confirmTarget, setConfirmTarget] = useState<EnrichedInsight | null>(null);
  const [isRefreshing, startRefresh] = useTransition();
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const emergencies = houseActions.filter((i) => i.payload.isCritical);
  const houseFixes = houseActions.filter((i) => !i.payload.isCritical);

  const handleDismiss = (ins: EnrichedInsight) => {
    const isSensitive = ins.payload.isCritical || ins.severity === 'warning';
    if (isSensitive) {
      setConfirmTarget(ins);
    } else {
      executeDismiss(ins.id);
    }
  };

  const executeDismiss = (id: string) => {
    setDismissed((prev) => new Set([...prev, id]));
    if (activeInsight?.id === id) setActiveInsight(null);
    dismissInsight(id).catch(console.error);
  };

  const handleRefresh = () => {
    setRefreshError(null);
    startRefresh(async () => {
      try {
        await triggerGuestIntelligenceSync();
        window.location.reload();
      } catch (err) {
        setRefreshError(err instanceof Error ? err.message : 'Sync failed.');
      }
    });
  };

  return (
    <>
      <div className={styles.header}>
        {refreshError && <span className={styles.errorMsg}>{refreshError}</span>}
        <button
          type="button"
          className={styles.refreshBtn}
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <ArrowsClockwise size={13} weight={isRefreshing ? 'bold' : 'regular'} />
          {isRefreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className={styles.cols}>
        <Column
          label="Emergencies"
          labelMod={styles.colLabelEmergency}
          insights={emergencies}
          dismissed={dismissed}
          onOpen={setActiveInsight}
          onRequestDismiss={handleDismiss}
        />
        <Column
          label="House Fixes"
          insights={houseFixes}
          dismissed={dismissed}
          onOpen={setActiveInsight}
          onRequestDismiss={handleDismiss}
        />
        <Column
          label="Owner Updates"
          insights={ownerUpdates}
          dismissed={dismissed}
          onOpen={setActiveInsight}
          onRequestDismiss={handleDismiss}
        />
      </div>

      <AnimatePresence>
        {activeInsight && (
          <InsightDetailPanel
            key={activeInsight.id}
            insight={activeInsight}
            payload={activeInsight.payload}
            propertyId={activeInsight.propertyId}
            propertyName={activeInsight.propertyName}
            onClose={() => setActiveInsight(null)}
            onDismiss={() => executeDismiss(activeInsight.id)}
            onComplete={() => {
              setDismissed((prev) => new Set([...prev, activeInsight.id]));
              setActiveInsight(null);
            }}
          />
        )}
      </AnimatePresence>

      <ConfirmModal
        open={confirmTarget !== null}
        title="Dismiss this insight?"
        description="This insight is flagged as critical or a warning. Dismissing it removes it from your feed permanently."
        confirmLabel="Yes, dismiss"
        cancelLabel="Keep it"
        variant="danger"
        onConfirm={() => {
          if (confirmTarget) executeDismiss(confirmTarget.id);
          setConfirmTarget(null);
        }}
        onCancel={() => setConfirmTarget(null)}
      />
    </>
  );
}
