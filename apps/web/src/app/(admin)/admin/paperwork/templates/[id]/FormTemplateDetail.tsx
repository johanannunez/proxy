"use client";

/**
 * FormTemplateDetail — a form template's whole life on one page:
 * Build (the drag-and-drop builder, incl. the conditional logic editor),
 * Responses (everything clients submitted), and Settings (publish state,
 * public link, sharing). Per the paperwork unification design, a form's
 * responses live with the form.
 */

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Check,
  LinkSimple,
  ArrowSquareOut,
  Globe,
  Lock,
} from "@phosphor-icons/react";
import type { Form } from "@/lib/admin/forms-types";
import type { FormResponseWithProfile } from "@/lib/admin/forms";
import { FormBuilderCanvas } from "./builder/FormBuilderCanvas";
import { ResponsesHub } from "./responses/ResponsesHub";
import {
  publishFormAction,
  unpublishFormAction,
  toggleFormPublicAction,
  updateFormMetaAction,
} from "../form-actions";
import { CoverageSettingsCard } from "./CoverageSettingsCard";
import { FormAppearancePicker } from "../../forms/FormAppearancePicker";
import {
  resolveFormAppearance,
  FormGlyph,
} from "../../forms/form-icon";
import styles from "./TemplateDetail.module.css";

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

type TabKey = "build" | "responses" | "settings";

function FormSettings({ form }: { form: Form }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const publicUrl = form.slug
    ? `${typeof window !== "undefined" ? window.location.origin : "https://www.myproxyhost.com"}/f/${form.slug}`
    : null;

  function run(action: () => Promise<{ ok: boolean } | void>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (res && "ok" in res && !res.ok) {
        setError("That change did not save. Try again.");
        return;
      }
      router.refresh();
    });
  }

  function handleCopy() {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className={styles.settingsWrap}>
      <div className={styles.settingsCard}>
        <h3 className={styles.settingsTitle}>Publishing</h3>
        <div className={styles.settingRow}>
          <div className={styles.settingMeta}>
            <span className={styles.settingLabel}>
              Status{" "}
              <span
                className={`${styles.statusPill} ${form.is_active ? styles.statusLive : styles.statusDraft}`}
              >
                {form.is_active ? "Live and collecting responses" : "Draft"}
              </span>
            </span>
            <span className={styles.settingDesc}>
              {form.is_active
                ? "Anyone with the link can open this form."
                : "Publishing creates the share link and starts accepting responses."}
            </span>
          </div>
          <button
            type="button"
            className={`${styles.toggleBtn} ${form.is_active ? "" : styles.toggleBtnPrimary}`}
            onClick={() =>
              run(() => (form.is_active ? unpublishFormAction(form.id) : publishFormAction(form.id)))
            }
            disabled={pending}
          >
            {pending ? "Saving…" : form.is_active ? "Unpublish" : "Publish"}
          </button>
        </div>

        <div className={styles.settingRow}>
          <div className={styles.settingMeta}>
            <span className={styles.settingLabel}>
              {form.is_public ? (
                <>
                  <Globe size={12} weight="bold" style={{ verticalAlign: -1 }} /> Public access
                </>
              ) : (
                <>
                  <Lock size={12} weight="bold" style={{ verticalAlign: -1 }} /> Private
                </>
              )}
            </span>
            <span className={styles.settingDesc}>
              {form.is_public
                ? "The link works without signing in."
                : "Respondents must sign in before filling this out."}
            </span>
          </div>
          <button
            type="button"
            className={styles.toggleBtn}
            onClick={() => run(() => toggleFormPublicAction(form.id, !form.is_public))}
            disabled={pending}
          >
            {form.is_public ? "Make private" : "Make public"}
          </button>
        </div>
      </div>

      <FormAppearancePicker
        formId={form.id}
        icon={form.icon}
        iconColor={form.icon_color}
      />

      <CoverageSettingsCard
        tracked={form.tracked}
        category={form.category}
        onSave={async (updates) => {
          const res = await updateFormMetaAction(form.id, updates);
          return res.ok ? { ok: true } : { ok: false, error: res.error };
        }}
      />

      {form.is_active && publicUrl && (
        <div className={styles.settingsCard}>
          <h3 className={styles.settingsTitle}>Share link</h3>
          <div className={styles.linkRow}>
            <span className={styles.linkText}>{publicUrl}</span>
            <button
              type="button"
              className={`${styles.linkActionBtn} ${copied ? styles.linkActionCopied : ""}`}
              onClick={handleCopy}
            >
              {copied ? <Check size={12} weight="bold" /> : <LinkSimple size={12} weight="bold" />}
              {copied ? "Copied" : "Copy"}
            </button>
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.linkActionBtn}
            >
              <ArrowSquareOut size={12} weight="bold" />
              Open
            </a>
          </div>
        </div>
      )}

      {error && <p className={styles.errorNote}>{error}</p>}
    </div>
  );
}

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
      {/* Identity header — visible above all tabs */}
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
        {tab === "settings" && <FormSettings form={form} />}
      </div>
    </div>
  );
}
