"use client";

/**
 * CoverageSettingsCard — the "Track in coverage" toggle plus category select
 * shared by both template detail Settings tabs (2026-06-12 IA amendment).
 * Tracked masters become Coverage matrix columns under Documents; the
 * category groups columns (Proxy's SecureDocs/Setup layout is just this
 * configuration, not a hardcode).
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
  onSave,
}: {
  tracked: boolean;
  category: string | null;
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
      <h3 className={styles.settingsTitle}>Coverage</h3>
      <div className={styles.settingRow}>
        <div className={styles.settingMeta}>
          <span className={styles.settingLabel}>Track in coverage</span>
          <span className={styles.settingDesc}>
            Tracked templates become columns in the Documents tab&apos;s
            Coverage view, so you can sweep every owner at a glance.
          </span>
        </div>
        <button
          type="button"
          className={`${styles.toggleBtn} ${tracked ? "" : styles.toggleBtnPrimary}`}
          onClick={() => run({ tracked: !tracked })}
          disabled={pending}
        >
          {pending ? "Saving…" : tracked ? "Stop tracking" : "Track"}
        </button>
      </div>

      {tracked && (
        <div className={styles.settingRow}>
          <div className={styles.settingMeta}>
            <span className={styles.settingLabel}>Category</span>
            <span className={styles.settingDesc}>
              Coverage columns group by category. Uncategorized templates land
              in a single Tracked group.
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
