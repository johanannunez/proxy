"use client";

/**
 * SignatureTemplateDetail — Fields (DocuSeal field placement) | Settings.
 * Same shape as the form template detail minus responses: signature templates
 * collect signatures, not form data.
 */

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowLeft, FilePdf } from "@phosphor-icons/react";
import ConfirmModal from "@/components/admin/ConfirmModal";
import type { DocumentTemplate } from "@/lib/admin/document-templates-types";
import { DocuSealBuilderView } from "../DocuSealBuilderView";
import {
  activateTemplate,
  deactivateTemplate,
  updateTemplateTracking,
} from "../template-actions";
import { CoverageSettingsCard } from "./CoverageSettingsCard";
import { signerRolesLabel } from "../signer-roles";
import styles from "./TemplateDetail.module.css";

type TabKey = "fields" | "settings";

function SignatureSettings({ template }: { template: DocumentTemplate }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  function handleDeactivate() {
    setConfirmRemove(false);
    setError(null);
    startTransition(async () => {
      const res = await deactivateTemplate(template.id);
      if (!res.ok) {
        setError(res.error ?? "Could not remove the template.");
        return;
      }
      router.push("/admin/paperwork/templates");
      router.refresh();
    });
  }

  return (
    <div className={styles.settingsWrap}>
      <div className={styles.settingsCard}>
        <h3 className={styles.settingsTitle}>About this template</h3>
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>Name</span>
          <span className={styles.fieldValue}>{template.display_name}</span>
        </div>
        {template.description && (
          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>Description</span>
            <span className={styles.fieldValue}>{template.description}</span>
          </div>
        )}
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>Document key</span>
          <span className={`${styles.fieldValue} ${styles.fieldValueMono}`}>
            {template.document_key}
          </span>
        </div>
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>Signer roles</span>
          <span className={styles.fieldValue}>{signerRolesLabel(template.signer_roles)}</span>
        </div>
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>Countersignature</span>
          <span className={styles.fieldValue}>
            {template.requires_countersignature
              ? "You countersign after the client"
              : "Not required"}
          </span>
        </div>
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>Status</span>
          <span className={styles.fieldValue}>
            <span
              className={`${styles.statusPill} ${
                template.is_active && template.docuseal_template_id
                  ? styles.statusLive
                  : styles.statusDraft
              }`}
            >
              {template.is_active && template.docuseal_template_id
                ? "Ready to send"
                : "Draft: finish the field layout"}
            </span>
          </span>
        </div>
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>Source</span>
          <span className={styles.fieldValue}>
            {template.is_system ? "Proxy library template" : "Your custom template"}
          </span>
        </div>
      </div>

      <CoverageSettingsCard
        tracked={template.tracked}
        category={template.category}
        onSave={(updates) => updateTemplateTracking(template.id, updates)}
      />

      {!template.is_system && (
        <div className={styles.settingsCard}>
          <h3 className={styles.settingsTitle}>Danger zone</h3>
          <div className={styles.settingRow}>
            <div className={styles.settingMeta}>
              <span className={styles.settingLabel}>Remove this template</span>
              <span className={styles.settingDesc}>
                Deactivates the template so it can no longer be sent. Documents
                already out for signature are unaffected.
              </span>
            </div>
            <button
              type="button"
              className={`${styles.toggleBtn} ${styles.toggleBtnDanger}`}
              onClick={() => setConfirmRemove(true)}
              disabled={pending}
            >
              {pending ? "Removing…" : "Remove"}
            </button>
          </div>
        </div>
      )}

      {error && <p className={styles.errorNote}>{error}</p>}

      <ConfirmModal
        open={confirmRemove}
        title="Remove this template?"
        description={`"${template.display_name}" will no longer be sendable. Documents already out for signature keep working.`}
        confirmLabel="Remove"
        variant="danger"
        onConfirm={handleDeactivate}
        onCancel={() => setConfirmRemove(false)}
      />
    </div>
  );
}

export function SignatureTemplateDetail({
  template,
  initialTab,
}: {
  template: DocumentTemplate;
  initialTab: TabKey;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>(initialTab);

  async function handleBuilderSave(): Promise<{ ok: boolean; error?: string }> {
    const result = await activateTemplate(template.id);
    // Activation can be refused by the readiness gate (a signer has no field).
    // Return the result so the builder shows the message inline; only navigate
    // on success. Do NOT call router.refresh() here: refreshing the current
    // route races the push and cancels the navigation, leaving the builder
    // stuck on "Finishing…". The library is force-dynamic and refetches itself.
    if (result.ok) {
      router.push("/admin/paperwork/templates");
    }
    return result;
  }

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: "fields", label: "Fields" },
    { key: "settings", label: "Settings" },
  ];

  return (
    <div className={styles.root}>
      <div
        className={styles.tabBar}
        role="tablist"
        aria-label={`${template.display_name} sections`}
      >
        <Link href="/admin/paperwork/templates" className={styles.crumb}>
          <ArrowLeft size={13} weight="bold" />
          Templates
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
        {tab === "fields" &&
          (template.docuseal_template_id ? (
            <DocuSealBuilderView
              templateId={template.docuseal_template_id}
              templateName={template.display_name}
              onSave={handleBuilderSave}
              onBack={() => router.push("/admin/paperwork/templates")}
            />
          ) : (
            <div className={styles.builderEmpty}>
              <FilePdf size={40} weight="duotone" />
              <p className={styles.builderEmptyTitle}>No PDF uploaded yet</p>
              <p className={styles.builderEmptyBody}>
                This template has no document behind it. Use the New document
                button and choose Upload a PDF to create a fresh template with
                a field layout.
              </p>
            </div>
          ))}
        {tab === "settings" && <SignatureSettings template={template} />}
      </div>
    </div>
  );
}
