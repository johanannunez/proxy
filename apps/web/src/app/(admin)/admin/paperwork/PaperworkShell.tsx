"use client";

/**
 * PaperworkShell — the shared chrome for the unified Paperwork section.
 * Three tabs (Documents | Forms | Templates) and one global "+ New document"
 * button that opens the three-path create chooser. Per the 2026-06-12 IA
 * amendment: Documents holds tracked instances, Forms holds form masters
 * (Hubflo-style library), Templates holds signature/PDF masters plus the
 * Proxy library. Everything created here is saved as a master automatically.
 */

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  Plus,
  X,
  CaretRight,
  FileDashed,
  FilePdf,
  Rows,
  SpinnerGap,
} from "@phosphor-icons/react";
import { createFormAction } from "./templates/form-actions";
import { CreateTemplateModal } from "./templates/CreateTemplateModal";
import type { DocumentTemplate } from "@/lib/admin/document-templates-types";
import styles from "./PaperworkShell.module.css";

type PaperworkTab = "documents" | "forms" | "templates";

const TABS: Array<{ key: PaperworkTab; label: string; href: string }> = [
  { key: "documents", label: "Documents", href: "/admin/paperwork" },
  { key: "forms", label: "Forms", href: "/admin/paperwork/forms" },
  { key: "templates", label: "Templates", href: "/admin/paperwork/templates" },
];

/** Primary action copy switches with the active tab so the button always
 * names the thing you would actually create from where you are. */
const PRIMARY_BY_TAB: Record<PaperworkTab, string> = {
  documents: "New document",
  forms: "New form",
  templates: "New template",
};

function NewDocumentChooser({
  orgId,
  onClose,
  onUploadPdf,
}: {
  orgId: string;
  onClose: () => void;
  onUploadPdf: () => void;
}) {
  const router = useRouter();
  const [creatingForm, setCreatingForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleBuildForm() {
    setError(null);
    setCreatingForm(true);
    try {
      const result = await createFormAction(orgId, "Untitled Form");
      if (!result.ok || !result.data?.id) {
        setError(result.ok ? "Could not create the form. Try again." : result.error);
        return;
      }
      router.push(`/admin/paperwork/templates/${result.data.id}`);
      onClose();
    } finally {
      setCreatingForm(false);
    }
  }

  return (
    <>
      <motion.div
        className={styles.backdrop}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16 }}
        onClick={onClose}
      />
      <motion.div
        className={styles.chooser}
        role="dialog"
        aria-modal="true"
        aria-label="Create a new document"
        initial={{ opacity: 0, scale: 0.96, x: "-50%", y: "-48%" }}
        animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
        exit={{ opacity: 0, scale: 0.96, x: "-50%", y: "-48%" }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
      >
        <button
          type="button"
          className={styles.chooserClose}
          onClick={onClose}
          aria-label="Close"
        >
          <X size={14} weight="bold" />
        </button>
        <h2 className={styles.chooserTitle}>New document</h2>
        <p className={styles.chooserSub}>
          Whatever you create is saved as a template, so you can send it again
          without rebuilding it.
        </p>

        <div className={styles.pathList}>
          <button
            type="button"
            className={styles.pathCard}
            onClick={() => {
              router.push("/admin/paperwork/templates");
              onClose();
            }}
          >
            <span className={styles.pathIcon}>
              <FileDashed size={20} weight="duotone" />
            </span>
            <span className={styles.pathBody}>
              <span className={styles.pathName}>From a template</span>
              <span className={styles.pathDesc}>
                Pick from your library or the Proxy pre-made templates.
              </span>
            </span>
            <CaretRight size={14} weight="bold" className={styles.pathArrow} />
          </button>

          <button
            type="button"
            className={styles.pathCard}
            onClick={() => {
              onUploadPdf();
              onClose();
            }}
          >
            <span className={styles.pathIcon}>
              <FilePdf size={20} weight="duotone" />
            </span>
            <span className={styles.pathBody}>
              <span className={styles.pathName}>Upload a PDF</span>
              <span className={styles.pathDesc}>
                Drop in a PDF and place the signature fields.
              </span>
            </span>
            <CaretRight size={14} weight="bold" className={styles.pathArrow} />
          </button>

          <button
            type="button"
            className={styles.pathCard}
            onClick={handleBuildForm}
            disabled={creatingForm}
          >
            <span className={styles.pathIcon}>
              {creatingForm ? (
                <SpinnerGap size={20} weight="bold" />
              ) : (
                <Rows size={20} weight="duotone" />
              )}
            </span>
            <span className={styles.pathBody}>
              <span className={styles.pathName}>
                {creatingForm ? "Creating your form…" : "Build a form"}
              </span>
              <span className={styles.pathDesc}>
                Drag and drop questions, then share a link or send it out.
              </span>
            </span>
            <CaretRight size={14} weight="bold" className={styles.pathArrow} />
          </button>
        </div>

        {error && <div className={styles.chooserError}>{error}</div>}
      </motion.div>
    </>
  );
}

export function PaperworkShell({
  active,
  orgId,
  counts,
  children,
}: {
  active: PaperworkTab;
  orgId: string;
  counts?: Partial<Record<PaperworkTab, number>>;
  children: ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [chooserOpen, setChooserOpen] = useState(false);
  const [creatingForm, setCreatingForm] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);

  // Deep link: /admin/paperwork/templates?create=pdf opens the modal and then
  // cleans the query so a refresh does not reopen it.
  useEffect(() => {
    if (searchParams.get("create") === "pdf") {
      setTemplateModalOpen(true);
      router.replace("/admin/paperwork/templates");
    }
  }, [searchParams, router]);

  function handleTemplateCreated(template: DocumentTemplate) {
    setTemplateModalOpen(false);
    // HTML templates open straight into the Write tab to author content; PDF
    // templates hand off to full-screen field placement (Step 3).
    const suffix = template.source_html !== null ? "?tab=write" : "";
    router.push(`/admin/paperwork/templates/${template.id}${suffix}`);
  }

  async function handlePrimary() {
    if (active === "documents") {
      setChooserOpen(true);
      return;
    }
    if (active === "templates") {
      // Opens instantly from client state, no route navigation.
      setTemplateModalOpen(true);
      return;
    }
    // Forms: create the master immediately and drop into its builder, the same
    // path the chooser's "Build a form" uses.
    setCreatingForm(true);
    try {
      const result = await createFormAction(orgId, "Untitled Form");
      if (result.ok && result.data?.id) {
        router.push(`/admin/paperwork/templates/${result.data.id}`);
      }
    } finally {
      setCreatingForm(false);
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
          <button
            type="button"
            className={styles.newDocBtn}
            onClick={handlePrimary}
            disabled={creatingForm}
          >
            {creatingForm ? (
              <SpinnerGap size={14} weight="bold" className={styles.btnSpinner} />
            ) : (
              <Plus size={14} weight="bold" />
            )}
            {creatingForm ? "Creating…" : PRIMARY_BY_TAB[active]}
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

      <AnimatePresence>
        {chooserOpen && (
          <NewDocumentChooser
            orgId={orgId}
            onClose={() => setChooserOpen(false)}
            onUploadPdf={() => setTemplateModalOpen(true)}
          />
        )}
      </AnimatePresence>

      <CreateTemplateModal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        onCreated={handleTemplateCreated}
      />
    </div>
  );
}
