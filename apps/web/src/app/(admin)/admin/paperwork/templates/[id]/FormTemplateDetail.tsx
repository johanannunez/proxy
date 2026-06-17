"use client";

/**
 * FormTemplateDetail: a form template's whole life on one page:
 * Build (the drag-and-drop builder, incl. the conditional logic editor),
 * Responses (everything clients submitted), and Settings (publish state,
 * public link, sharing). Per the paperwork unification design, a form's
 * responses live with the form.
 */

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowLeft } from "@phosphor-icons/react";
import type { Form } from "@/lib/admin/forms-types";
import type { FormResponseWithProfile } from "@/lib/admin/forms";
import { FormBuilderCanvas } from "./builder/FormBuilderCanvas";
import { ResponsesHub } from "./responses/ResponsesHub";
import { FormSettingsControlCenter } from "./FormSettingsControlCenter";
import styles from "./TemplateDetail.module.css";

type TabKey = "build" | "responses" | "settings";

export function FormTemplateDetail({
  form,
  responses,
  viewCount,
  initialTab,
}: {
  form: Form;
  responses: FormResponseWithProfile[];
  viewCount: number;
  initialTab: TabKey;
}) {
  const [tab, setTab] = useState<TabKey>(initialTab);

  const tabs: Array<{ key: TabKey; label: string; count?: number }> = [
    { key: "build", label: "Build" },
    { key: "responses", label: "Responses", count: responses.length },
    { key: "settings", label: "Settings" },
  ];

  return (
    <div className={styles.root}>
      <div className={styles.tabBar} role="tablist" aria-label={`${form.name} sections`}>
        <Link href="/admin/paperwork/forms" className={styles.crumb}>
          <ArrowLeft size={13} weight="bold" />
          Forms
        </Link>
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`${styles.tab} ${tab === t.key ? styles.tabActive : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {typeof t.count === "number" && (
              <span className={styles.tabCount}>{t.count}</span>
            )}
            {tab === t.key && (
              <motion.span
                layoutId="template-detail-tab"
                className={styles.tabIndicator}
                aria-hidden
              />
            )}
          </button>
        ))}
      </div>

      <div className={styles.content}>
        {tab === "build" && <FormBuilderCanvas form={form} />}
        {tab === "responses" && (
          <ResponsesHub form={form} responses={responses} viewCount={viewCount} />
        )}
        {tab === "settings" && (
          <FormSettingsControlCenter form={form} responses={responses} />
        )}
      </div>
    </div>
  );
}
