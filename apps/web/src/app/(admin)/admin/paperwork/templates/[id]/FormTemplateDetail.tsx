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
import { ArrowLeft, Globe, Lock } from "@phosphor-icons/react";
import type { Form } from "@/lib/admin/forms-types";
import type { FormResponseWithProfile } from "@/lib/admin/forms";
import { FormBuilderCanvas } from "./builder/FormBuilderCanvas";
import { ResponsesHub } from "./responses/ResponsesHub";
import {
  resolveFormAppearance,
  FormGlyph,
} from "../../forms/form-icon";
import { FormSettingsControlCenter } from "./FormSettingsControlCenter";
import styles from "./TemplateDetail.module.css";

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

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

  const appearance = resolveFormAppearance({
    id: form.id,
    icon: form.icon,
    icon_color: form.icon_color,
  });

  const fieldCount = form.schema.fields.length;
  const responseCount = responses.length;

  return (
    <div className={styles.root}>
      {/* Identity header, visible above all tabs */}
      <div className={styles.identityHeader}>
        <span
          className={styles.identityIconTile}
          style={{ background: appearance.bg, color: appearance.fg }}
        >
          <FormGlyph appearance={appearance} size={22} />
        </span>
        <div className={styles.identityBody}>
          <h1 className={styles.identityName}>{form.name}</h1>
          <p className={styles.identityMeta}>
            {fieldCount} {fieldCount === 1 ? "question" : "questions"}
            {" · "}
            {responseCount} {responseCount === 1 ? "response" : "responses"}
            {" · "}
            Updated {fmtDate(form.updated_at)}
          </p>
        </div>
        <div className={styles.identityChips}>
          <span
            className={`${styles.identityChip} ${form.is_active ? styles.identityChipLive : styles.identityChipDraft}`}
          >
            {form.is_active ? "Published" : "Draft"}
          </span>
          {form.slug && (
            <span className={styles.identityChipAccess}>
              {form.is_public ? (
                <>
                  <Globe size={11} weight="bold" />
                  Public
                </>
              ) : (
                <>
                  <Lock size={11} weight="bold" />
                  Private
                </>
              )}
            </span>
          )}
        </div>
      </div>

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
