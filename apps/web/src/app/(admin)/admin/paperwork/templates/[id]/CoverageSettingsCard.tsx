"use client";

/**
 * CoverageSettingsCard — the "Status Board tracking" toggle plus category
 * select shared by both template detail Settings tabs (2026-06-14 redesign).
 * Tracked masters become columns on the Paperwork Status Board; the category
 * groups those columns (Proxy's SecureDocs/Setup layout is just this
 * configuration, not a hardcode).
 *
 * R2-A scope: the per-template scope radio (Owner/Property/Workspace — the unit
 * of completion) is deferred to the data-model wave (E-G); only the working
 * tracked/category controls render here.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CustomSelect } from "@/components/admin/CustomSelect";
import styles from "./TemplateDetail.module.css";

const CATEGORY_OPTIONS = [
  { value: "", label: "No category" },
  { value: "securedocs", label: "SecureDocs" },
  { value: "setup", label: "Setup" },
  { value: "onboarding", label: "Onboarding" },
  { value: "compliance", label: "Compliance" },
  { value: "financial", label: "Financial" },
];

export function CoverageSettingsCard({
  tracked,
  category,
  displayName = "This item",
  onSave,
}: {
  tracked: boolean;
  category: string | null;
  displayName?: string;
  onSave: (updates: {
    tracked?: boolean;
    category?: string | null;
  }) => Promise<{ ok: boolean; error?: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(updates: { tracked?: boolean; category?: string | null }) {
    setError(null);
    startTransition(async () => {
      const res = await onSave(updates);
      if (!res.ok) {
        setError(res.error ?? "That change did not save. Try again.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className={styles.settingsCard}>
      <div className={styles.statusBoardHead}>
        <h3 className={styles.settingsTitle}>Status board</h3>
        <span
          className={`${styles.statusBoardState} ${
            tracked ? styles.statusBoardStateShown : styles.statusBoardStateHidden
          }`}
        >
          {tracked ? "Shown" : "Hidden"}
        </span>
      </div>

      <div className={styles.statusBoardPreview} data-hidden={!tracked}>
        <div className={styles.statusBoardPreviewTop}>
          <span>Status board</span>
          <span>{tracked ? "Workspace view" : "Preview"}</span>
        </div>
        <div className={styles.statusBoardMiniGrid} aria-hidden="true">
          <span className={styles.statusBoardHeaderCell}>Property</span>
          <span className={styles.statusBoardHeaderCell}>{displayName}</span>
          <span className={styles.statusBoardHeaderCell}>Signature</span>
          <span>Unit 201</span>
          <span className={styles.statusBoardChip}>Ready</span>
          <span className={styles.statusBoardMutedChip}>Waiting</span>
          <span>Unit 304</span>
          <span className={styles.statusBoardMutedChip}>Needed</span>
          <span className={styles.statusBoardChip}>Signed</span>
        </div>
      </div>

      <div className={styles.settingRow}>
        <div className={styles.settingMeta}>
          <span className={styles.settingLabel}>
            {tracked ? "Shown on status board" : "Hidden from status board"}
          </span>
          <span className={styles.settingDesc}>
            Forms appear on the board by default. Turn this off when the column
            should stay out of the workspace status view.
          </span>
        </div>
        <button
          type="button"
          className={`${styles.toggleBtn} ${tracked ? "" : styles.toggleBtnPrimary}`}
          onClick={() => run({ tracked: !tracked })}
          disabled={pending}
        >
          {pending ? "Saving..." : tracked ? "Hide" : "Show"}
        </button>
      </div>

      {tracked && (
        <div className={styles.settingRow}>
          <div className={styles.settingMeta}>
            <span className={styles.settingLabel}>Category</span>
            <span className={styles.settingDesc}>
              Status board columns group by category. Uncategorized templates
              land in a single tracked group.
            </span>
          </div>
          <div style={{ minWidth: 170 }}>
            <CustomSelect
              value={category ?? ""}
              options={CATEGORY_OPTIONS}
              onChange={(value) => run({ category: value === "" ? null : value })}
              disabled={pending}
              aria-describedby={undefined}
            />
          </div>
        </div>
      )}

      {error && <p className={styles.errorNote}>{error}</p>}
    </div>
  );
}
