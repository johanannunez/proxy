"use client";

/**
 * PaperworkShell — the shared chrome for the unified Paperwork section.
 * One page, two tabs (Documents | Templates), one global "+ New document"
 * button that opens the three-path create chooser. Per the 2026-06-12
 * paperwork unification design, Forms and Responses stop being nav concepts:
 * everything created here is saved as a template automatically.
 */

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import styles from "./PaperworkShell.module.css";

type PaperworkTab = "documents" | "templates";

const TABS: Array<{ key: PaperworkTab; label: string; href: string }> = [
  { key: "documents", label: "Documents", href: "/admin/paperwork" },
  { key: "templates", label: "Templates", href: "/admin/paperwork/templates" },
];

function NewDocumentChooser({
  orgId,
  onClose,
}: {
  orgId: string;
  onClose: () => void;
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
              router.push("/admin/paperwork/templates?create=pdf");
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
  children,
}: {
  active: PaperworkTab;
  orgId: string;
  children: ReactNode;
}) {
  const [chooserOpen, setChooserOpen] = useState(false);

  return (
    <div className={styles.shell}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Paperwork</h1>
          <nav className={styles.tabs} aria-label="Paperwork sections">
            {TABS.map((tab) => {
              const isActive = tab.key === active;
              return (
                <Link
                  key={tab.key}
                  href={tab.href}
                  className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {tab.label}
                  {isActive && (
                    <motion.span
                      layoutId="paperwork-tab-indicator"
                      className={styles.tabIndicator}
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
            onClick={() => setChooserOpen(true)}
          >
            <Plus size={14} weight="bold" />
            New document
          </button>
        </div>
      </div>
      <div className={styles.tabRule} aria-hidden />

      <div className={styles.content}>{children}</div>

      <AnimatePresence>
        {chooserOpen && (
          <NewDocumentChooser orgId={orgId} onClose={() => setChooserOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
