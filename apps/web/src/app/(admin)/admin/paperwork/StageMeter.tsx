"use client";

/**
 * StageMeter — package-tracking progress for a document:
 * Created ── Sent ── Viewed ── Signed ── On file. The current stage glows in
 * the brand gradient; completed stages fill solid. Ambient on document rows
 * and in the drawer (premium upgrade 1, 2026-06-12 design doc).
 */

import {
  DOCUMENT_STAGES,
  stageIndex,
  type DocumentStage,
} from "@/lib/admin/documents-hub-shared";
import styles from "./StageMeter.module.css";

export function StageMeter({
  stage,
  compact = false,
}: {
  stage: DocumentStage;
  compact?: boolean;
}) {
  const current = stageIndex(stage);
  const currentLabel = DOCUMENT_STAGES[current]?.label ?? "Created";

  return (
    <div
      className={`${styles.meter} ${compact ? styles.compact : ""}`}
      role="img"
      aria-label={`Document stage: ${currentLabel}`}
    >
      {DOCUMENT_STAGES.map((s, i) => {
        const done = i < current;
        const isCurrent = i === current;
        return (
          <div key={s.key} className={styles.stage}>
            {i > 0 && (
              <span
                className={`${styles.connector} ${i <= current ? styles.connectorDone : ""}`}
                aria-hidden
              />
            )}
            <span className={styles.node}>
              <span
                className={`${styles.dot} ${done ? styles.dotDone : ""} ${
                  isCurrent ? styles.dotCurrent : ""
                }`}
                aria-hidden
              />
              <span
                className={`${styles.label} ${done ? styles.labelDone : ""} ${
                  isCurrent ? styles.labelCurrent : ""
                }`}
              >
                {s.label}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
