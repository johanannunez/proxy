// apps/web/src/app/(admin)/admin/guest-pulse/PulseBoard.tsx
'use client';

import { useState, useMemo } from 'react';
import { AnimatePresence } from 'motion/react';
import { X } from '@phosphor-icons/react';
import ConfirmModal from '@/components/admin/ConfirmModal';
import type { EnrichedInsight, PulseOwnerOption } from '@/lib/admin/dashboard-data';
import { dismissInsight } from '@/lib/admin/insight-actions';
import { InsightDetailPanel } from '../InsightDetailPanel';
import styles from './PulseBoard.module.css';

type Props = {
  ownerUpdates: EnrichedInsight[];
  houseActions: EnrichedInsight[];
  propertyOptions: Array<{ id: string; name: string }>;
  ownerOptions: PulseOwnerOption[];
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

export function PulseBoard({ ownerUpdates, houseActions, propertyOptions, ownerOptions }: Props) {
  const [activeInsight, setActiveInsight] = useState<EnrichedInsight | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [confirmTarget, setConfirmTarget] = useState<EnrichedInsight | null>(null);
  const [filterProperty, setFilterProperty] = useState('');
  const [filterOwner, setFilterOwner] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');

  const ownerPropertyIds = useMemo<Set<string> | null>(() => {
    if (!filterOwner) return null;
    const owner = ownerOptions.find((o) => o.id === filterOwner);
    return owner ? new Set(owner.propertyIds) : new Set();
  }, [filterOwner, ownerOptions]);

  const passes = (ins: EnrichedInsight): boolean => {
    if (dismissed.has(ins.id)) return false;
    if (filterProperty && ins.propertyId !== filterProperty) return false;
    if (ownerPropertyIds !== null && !ownerPropertyIds.has(ins.propertyId)) return false;
    if (filterSeverity) {
      if (filterSeverity === 'critical' && !ins.payload.isCritical) return false;
      if (filterSeverity !== 'critical' && ins.severity !== filterSeverity) return false;
    }
    return true;
  };

  const emergencies = houseActions.filter((i) => i.payload.isCritical && passes(i));
  const houseFixes = houseActions.filter((i) => !i.payload.isCritical && passes(i));
  const filteredOwner = ownerUpdates.filter(passes);

  const handleDismiss = (ins: EnrichedInsight) => {
    if (ins.payload.isCritical || ins.severity === 'warning') {
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

  const columns = [
    { key: 'emergencies', label: 'Emergencies', labelMod: styles.colLabelEmergency, items: emergencies },
    { key: 'house', label: 'House Fixes', items: houseFixes },
    { key: 'owner', label: 'Owner Updates', items: filteredOwner },
  ] as const;

  return (
    <>
      {(propertyOptions.length > 1 || ownerOptions.length > 0) && (
        <div className={styles.filterBar}>
          {propertyOptions.length > 1 && (
            <select
              className={styles.filterSelect}
              value={filterProperty}
              onChange={(e) => { setFilterProperty(e.target.value); setFilterOwner(''); }}
            >
              <option value="">All properties</option>
              {propertyOptions.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          {ownerOptions.length > 0 && (
            <select
              className={styles.filterSelect}
              value={filterOwner}
              onChange={(e) => { setFilterOwner(e.target.value); setFilterProperty(''); }}
            >
              <option value="">All owners</option>
              {ownerOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          )}
          <select
            className={styles.filterSelect}
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
          >
            <option value="">All severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="recommendation">Recommendation</option>
            <option value="info">Info</option>
          </select>
        </div>
      )}

      <div className={styles.cols}>
        {columns.map(({ key, label, items, ...rest }) => {
          const labelMod = 'labelMod' in rest ? rest.labelMod : undefined;
          return (
            <div key={key} className={styles.col}>
              <div className={`${styles.colLabel}${labelMod ? ` ${labelMod}` : ''}`}>
                {label}
                {items.length > 0 && <span className={styles.colCount}>({items.length})</span>}
              </div>
              <div className={styles.cardList}>
                {items.length === 0 ? (
                  <div className={styles.empty}>None right now.</div>
                ) : (
                  items.map((ins) => (
                    <InsightCard
                      key={ins.id}
                      insight={ins}
                      onOpen={() => setActiveInsight(ins)}
                      onDismiss={() => handleDismiss(ins)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
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
        description="This insight is flagged as critical or a warning. Dismissing it removes it permanently."
        confirmLabel="Yes, dismiss"
        cancelLabel="Keep it"
        variant="danger"
        onConfirm={() => { if (confirmTarget) executeDismiss(confirmTarget.id); setConfirmTarget(null); }}
        onCancel={() => setConfirmTarget(null)}
      />
    </>
  );
}
