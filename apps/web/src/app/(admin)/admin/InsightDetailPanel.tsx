// apps/web/src/app/(admin)/admin/InsightDetailPanel.tsx
'use client';

import { useState, useTransition } from 'react';
import { motion } from 'motion/react';
import { X } from '@phosphor-icons/react';
import ConfirmModal from '@/components/admin/ConfirmModal';
import type { InsightPayload } from '@/lib/admin/insight-types';
import type { Insight } from '@/lib/admin/ai-insights';
import { dismissInsight, completeInsight, createTaskFromInsight } from '@/lib/admin/insight-actions';
import styles from './InsightDetailPanel.module.css';

type Props = {
  insight: Insight;
  payload: InsightPayload;
  propertyId: string;
  propertyName: string;
  onClose: () => void;
  onDismiss?: () => void;
  onComplete?: () => void;
};

function badgeCls(severity: Insight['severity'], isCritical: boolean): string {
  if (isCritical) return styles.badgeCritical;
  if (severity === 'warning') return styles.badgeWarning;
  if (severity === 'recommendation') return styles.badgeRecommendation;
  return styles.badgeInfo;
}

function badgeLabel(severity: Insight['severity'], isCritical: boolean): string {
  if (isCritical) return 'Critical';
  if (severity === 'warning') return 'Warning';
  if (severity === 'recommendation') return 'Recommendation';
  return 'Info';
}

const overlayVariants = {
  hidden: { opacity: 0, transition: { duration: 0.16, ease: 'easeIn' as const } },
  visible: { opacity: 1, transition: { duration: 0.18, ease: 'easeOut' as const } },
};

const panelVariants = {
  hidden: { x: '100%', transition: { type: 'tween' as const, duration: 0.2, ease: [0.4, 0, 0.2, 1] as const } },
  visible: { x: 0, transition: { type: 'spring' as const, stiffness: 280, damping: 24 } },
};

export function InsightDetailPanel({
  insight,
  payload,
  propertyId,
  propertyName,
  onClose,
  onDismiss,
  onComplete,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [confirmDismiss, setConfirmDismiss] = useState(false);
  const isCritical = Boolean(payload.isCritical);
  const needsConfirm = isCritical || insight.severity === 'warning';

  const handleComplete = () => {
    startTransition(async () => {
      await completeInsight(insight.id);
      onComplete?.();
      onClose();
    });
  };

  const handleCreateTask = () => {
    startTransition(async () => {
      await createTaskFromInsight({
        insightId: insight.id,
        propertyId,
        title: insight.title,
        body: insight.body,
        suggestedFixes: payload.suggestedFixes,
      });
      onClose();
    });
  };

  const executeDismiss = () => {
    startTransition(async () => {
      await dismissInsight(insight.id);
      onDismiss?.();
      onClose();
    });
  };

  const handleDismissClick = () => {
    if (needsConfirm) {
      setConfirmDismiss(true);
    } else {
      executeDismiss();
    }
  };

  return (
    <>
      <motion.div
        className={styles.overlay}
        variants={overlayVariants}
        initial="hidden"
        animate="visible"
        exit="hidden"
        onClick={onClose}
      >
        <motion.div
          className={styles.panel}
          variants={panelVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <div className={styles.severityRow}>
                <span className={`${styles.badge} ${badgeCls(insight.severity, isCritical)}`}>
                  {badgeLabel(insight.severity, isCritical)}
                </span>
                <span className={styles.sourceCount}>
                  {payload.sourceCount} {payload.sourceCount === 1 ? 'mention' : 'mentions'}
                </span>
              </div>
              <h2 className={styles.panelTitle}>{insight.title}</h2>
              {propertyName && <p className={styles.panelPropName}>{propertyName}</p>}
            </div>
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
              <X size={16} />
            </button>
          </div>

          <div className={styles.body}>
            <div>
              <div className={styles.sectionLabel}>The issue</div>
              <p className={styles.issueText}>{insight.body}</p>
            </div>
            <div>
              <div className={styles.sectionLabel}>Why this severity</div>
              <p className={styles.reasonText}>{payload.severityReason}</p>
            </div>
            {payload.sourceExcerpts.length > 0 && (
              <div>
                <div className={styles.sectionLabel}>Sources</div>
                <div className={styles.sourceList}>
                  {payload.sourceExcerpts.map((src, i) => (
                    <div key={i} className={styles.sourceItem}>
                      <div className={styles.sourceMeta}>
                        <span className={styles.sourceTypeBadge}>{src.type}</span>
                        <span className={styles.sourceName}>{src.guestFirstName}</span>
                        <span className={styles.sourceDate}>{src.approximateDate}</span>
                      </div>
                      <p className={styles.sourceQuote}>"{src.quote}"</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {payload.suggestedFixes.length > 0 && (
              <div>
                <div className={styles.sectionLabel}>Suggested fixes</div>
                <div className={styles.fixList}>
                  {payload.suggestedFixes.map((fix, i) => (
                    <div key={i} className={styles.fixItem}>
                      <span className={styles.fixNumber}>{i + 1}</span>
                      <span className={styles.fixText}>{fix}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className={styles.footer}>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={handleComplete}
              disabled={isPending}
            >
              {isPending ? 'Saving…' : 'Mark complete'}
            </button>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={handleCreateTask}
              disabled={isPending}
            >
              {payload.suggestedFixes.length > 1 ? 'Create task + subtasks' : 'Create task'}
            </button>
            <button
              type="button"
              className={styles.btnTertiary}
              onClick={handleDismissClick}
              disabled={isPending}
            >
              Dismiss
            </button>
          </div>
        </motion.div>
      </motion.div>

      <ConfirmModal
        open={confirmDismiss}
        title="Dismiss this insight?"
        description="This is a critical or warning insight. Dismissing it removes it from your feed permanently."
        confirmLabel="Yes, dismiss"
        cancelLabel="Keep it"
        variant="danger"
        onConfirm={() => { setConfirmDismiss(false); executeDismiss(); }}
        onCancel={() => setConfirmDismiss(false)}
      />
    </>
  );
}
