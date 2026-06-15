"use client";

/**
 * PaperworkShell — the shared chrome for the unified Paperwork section.
 * Three tabs (Status Board | Signatures | Forms), the inline Action Center
 * trigger, and one "+ New" button that opens the Template Gallery create modal.
 * Per the 2026-06-14 redesign: Status Board is the default landing, Signatures
 * holds tracked e-sign instances plus a signature Library, Forms holds form
 * submissions plus a form Library. The /admin/paperwork/templates/[id]
 * master-detail route stays as shared infra.
 */

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { Plus, SpinnerGap, Lightning } from "@phosphor-icons/react";
import { createFormAction } from "./templates/form-actions";
import { CreateTemplateModal } from "./templates/CreateTemplateModal";
import {
  TemplateGallery,
  type GalleryKind,
  type CreateChoice,
} from "@/components/admin/paperwork/TemplateGallery";
import type { DocumentTemplate } from "@/lib/admin/document-templates-types";
import styles from "./PaperworkShell.module.css";

type PaperworkTab = "status" | "signatures" | "forms";

const TABS: Array<{ key: PaperworkTab; label: string; href: string }> = [
  { key: "status", label: "Status Board", href: "/admin/paperwork" },
  { key: "signatures", label: "Signatures", href: "/admin/paperwork/signatures" },
  { key: "forms", label: "Forms", href: "/admin/paperwork/forms" },
];

/** Primary action copy switches with the active tab so the button always
 * names the thing you would actually create from where you are. */
const PRIMARY_BY_TAB: Record<PaperworkTab, string> = {
  status: "New Paperwork",
  signatures: "New Signature",
  forms: "New Form",
};

/** Which type the gallery opens scoped to, per tab (status = no preselection). */
const GALLERY_KIND_BY_TAB: Record<PaperworkTab, GalleryKind | null> = {
  status: null,
  signatures: "signature",
  forms: "form",
};

export function PaperworkShell({
  active,
  orgId,
  counts,
  actionCount,
  children,
}: {
  active: PaperworkTab;
  orgId: string;
  counts?: Partial<Record<PaperworkTab, number>>;
  /** Items needing attention. When provided, the Action Center trigger renders
   * inline beside the create button and shows this count. */
  actionCount?: number;
  children: ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryKind, setGalleryKind] = useState<GalleryKind | null>(null);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [routingForm, setRoutingForm] = useState(false);

  // Deep link: /admin/paperwork/templates?create=pdf opens the signature create
  // modal (PDF path) and cleans the query so a refresh does not reopen it.
  useEffect(() => {
    if (searchParams.get("create") === "pdf") {
      setTemplateModalOpen(true);
      router.replace("/admin/paperwork/signatures");
    }
  }, [searchParams, router]);

  function handleTemplateCreated(template: DocumentTemplate) {
    setTemplateModalOpen(false);
    router.push(`/admin/paperwork/templates/${template.id}`);
  }

  function openGallery() {
    setGalleryKind(GALLERY_KIND_BY_TAB[active]);
    setGalleryOpen(true);
  }

  async function handleGalleryCreate(choice: CreateChoice) {
    // Pick an existing template → open its detail to send or customize.
    if (choice.selection === "template") {
      router.push(`/admin/paperwork/templates/${choice.templateId}`);
      setGalleryOpen(false);
      return;
    }

    // Blank signature → the dedicated signature create modal (PDF or written).
    if (choice.kind === "signature" && choice.selection === "blank") {
      setGalleryOpen(false);
      setTemplateModalOpen(true);
      return;
    }

    // Blank or AI form → create the master, then drop into its builder. Throw on
    // failure so the gallery's catch surfaces the error instead of silently
    // re-enabling Create with no feedback.
    setRoutingForm(true);
    try {
      const result = await createFormAction(orgId, "Untitled Form");
      if (!result.ok || !result.data?.id) {
        throw new Error(result.ok ? "Could not create the form." : result.error);
      }
      const suffix = choice.selection === "ai" ? "?ai=1" : "";
      router.push(`/admin/paperwork/templates/${result.data.id}${suffix}`);
      setGalleryOpen(false);
    } finally {
      setRoutingForm(false);
    }
  }

  return (
    <div className={styles.shell}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <nav className={styles.tabs} aria-label="Paperwork sections">
            {TABS.map((tab) => {
              const isActive = tab.key === active;
              const count = counts?.[tab.key];
              return (
                <Link
                  key={tab.key}
                  href={tab.href}
                  className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span className={styles.tabLabel}>{tab.label}</span>
                  {typeof count === "number" && (
                    <span className={styles.tabCount}>{count}</span>
                  )}
                  {isActive && (
                    <motion.span
                      layoutId="paperwork-tab-indicator"
                      className={styles.tabIndicator}
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      aria-hidden
                    />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className={styles.headerActions}>
          {typeof actionCount === "number" && (
            <button
              type="button"
              className={`${styles.actionCenterBtn} ${actionCount > 0 ? styles.actionCenterBtnActive : ""}`}
              onPointerEnter={() =>
                window.dispatchEvent(new CustomEvent("admin:action-center-prefetch"))
              }
              onFocus={() =>
                window.dispatchEvent(new CustomEvent("admin:action-center-prefetch"))
              }
              onClick={() =>
                window.dispatchEvent(new CustomEvent("admin:action-center-toggle"))
              }
              aria-label={
                actionCount > 0
                  ? `Open Action Center, ${actionCount} ${actionCount === 1 ? "item needs" : "items need"} attention`
                  : "Open Action Center"
              }
            >
              <Lightning size={15} weight="duotone" aria-hidden />
              Action Center
              {actionCount > 0 && (
                <span className={styles.actionCenterCount}>{actionCount}</span>
              )}
            </button>
          )}
          <button
            type="button"
            className={styles.newDocBtn}
            onClick={openGallery}
            disabled={routingForm}
          >
            {routingForm ? (
              <SpinnerGap size={14} weight="bold" className={styles.btnSpinner} />
            ) : (
              <Plus size={14} weight="bold" />
            )}
            {PRIMARY_BY_TAB[active]}
          </button>
        </div>
      </div>
      <div className={styles.tabRule} aria-hidden />

      <motion.div
        key={active}
        className={styles.content}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>

      <TemplateGallery
        open={galleryOpen}
        initialKind={galleryKind}
        onClose={() => setGalleryOpen(false)}
        onCreate={handleGalleryCreate}
      />

      <CreateTemplateModal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        onCreated={handleTemplateCreated}
      />
    </div>
  );
}
