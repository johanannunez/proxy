"use client";

/**
 * FormsTab — Hubflo-style form-master library (2026-06-12 IA amendment).
 * A clean list: icon + name, response count, created, updated, row actions
 * (Send, Share link, Duplicate, Archive). Archived forms collapse behind a
 * count link at the top right. Row click opens the existing Build |
 * Responses | Settings detail page.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import {
  PaperPlaneTilt,
  LinkSimple,
  Check,
  Copy,
  Archive,
  ArrowCounterClockwise,
  Trash,
  SpinnerGap,
  Warning,
  FileDashed,
  CaretRight,
  PencilSimple,
} from "@phosphor-icons/react";
import { resolveFormAppearance } from "./form-icon";
import type { Form } from "@/lib/admin/forms-types";
import { fmtShortDate } from "@/lib/admin/documents-hub-shared";
import ConfirmModal from "@/components/admin/ConfirmModal";
import { SendSheet } from "../templates/SendSheet";
import {
  duplicateFormAction,
  archiveFormAction,
  unarchiveFormAction,
  deleteFormAction,
} from "../templates/form-actions";
import type { SendRecipient, UnifiedTemplate } from "../templates/unified-types";
import styles from "./FormsTab.module.css";

type FormListItem = Form & { response_count: number };

export type LibraryTemplate = {
  id: string;
  name: string;
  description: string | null;
};

function publicFormUrl(slug: string): string {
  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://www.myproxyhost.com";
  return `${base}/f/${slug}`;
}


/** Map a form master into the SendSheet's unified shape (link-based send). */
function toUnifiedTemplate(form: FormListItem): UnifiedTemplate {
  return {
    id: form.id,
    kind: "form",
    name: form.name,
    description: form.description,
    isSystem: false,
    isReady: form.is_active,
    documentKey: null,
    docusealTemplateId: null,
    signerRoles: [],
    previewImageUrl: null,
    sentCount: 0,
    responseCount: form.response_count,
    fieldCount: form.schema.fields.length,
    previewFields: form.schema.fields
      .slice(0, 6)
      .map((field) => ({ label: field.label, type: field.type })),
    slug: form.slug,
    isPublic: form.is_public,
  };
}

function FormRow({
  form,
  archived,
  busy,
  onSend,
  onDuplicate,
  onArchive,
  onRestore,
  onDeleteRequest,
}: {
  form: FormListItem;
  archived: boolean;
  busy: boolean;
  onSend: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDeleteRequest: () => void;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const detailHref = `/admin/paperwork/templates/${form.id}`;
  const appearance = resolveFormAppearance(form);

  function handleCopyLink(e: React.MouseEvent) {
    e.stopPropagation();
    if (!form.slug) return;
    navigator.clipboard.writeText(publicFormUrl(form.slug)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div
      className={`${styles.row} ${archived ? styles.rowArchived : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => router.push(detailHref)}
      onKeyDown={(e) => e.key === "Enter" && router.push(detailHref)}
    >
      <span
        className={styles.rowIcon}
        style={{ background: appearance.bg, color: appearance.fg }}
      >
        <appearance.Icon size={17} weight="duotone" />
      </span>

      <span className={styles.nameCell}>
        <span className={styles.name} title={form.name}>
          {form.name}
        </span>
        {form.description && (
          <span className={styles.nameSub} title={form.description}>
            {form.description}
          </span>
        )}
      </span>

      <span className={styles.statusCell}>
        {archived ? (
          <span className={`${styles.statusPill} ${styles.statusArchived}`}>
            <span className={styles.statusDot} />
            Archived
          </span>
        ) : form.is_active ? (
          <span className={`${styles.statusPill} ${styles.statusLive}`}>
            <span className={styles.statusDot} />
            Live
          </span>
        ) : (
          <span className={`${styles.statusPill} ${styles.statusDraft}`}>
            <span className={styles.statusDot} />
            Draft
          </span>
        )}
      </span>

      <span className={`${styles.metaCell} ${styles.responseCell}`}>
        {form.response_count === 0
          ? "No responses"
          : `${form.response_count} ${form.response_count === 1 ? "response" : "responses"}`}
      </span>
      <span className={`${styles.metaCell} ${styles.dateCell}`}>
        {fmtShortDate(form.created_at)}
      </span>
      <span className={`${styles.metaCell} ${styles.dateCell}`}>
        {fmtShortDate(form.updated_at)}
      </span>

      <span
        className={styles.actions}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {busy ? (
          <span className={styles.actionSpinner} aria-label="Working">
            <SpinnerGap size={14} weight="bold" />
          </span>
        ) : archived ? (
          <>
            <button type="button" className={styles.actionBtn} onClick={onRestore}>
              <ArrowCounterClockwise size={13} weight="bold" />
              Restore
            </button>
            <button
              type="button"
              className={`${styles.actionIconBtn} ${styles.actionDanger}`}
              onClick={onDeleteRequest}
              title="Delete permanently"
            >
              <Trash size={14} weight="bold" />
            </button>
          </>
        ) : (
          <>
            {/* Secondary actions reveal to the LEFT of the pinned primary on
                hover, filling reserved space so the row never reflows. */}
            <span className={styles.actionReveal}>
              {form.is_active && form.slug && (
                <button
                  type="button"
                  className={`${styles.actionIconBtn} ${copied ? styles.actionCopied : ""}`}
                  onClick={handleCopyLink}
                  title="Copy share link"
                >
                  {copied ? <Check size={14} weight="bold" /> : <LinkSimple size={14} weight="bold" />}
                </button>
              )}
              <button
                type="button"
                className={styles.actionIconBtn}
                onClick={onDuplicate}
                title="Duplicate"
              >
                <Copy size={14} weight="bold" />
              </button>
              <button
                type="button"
                className={styles.actionIconBtn}
                onClick={onArchive}
                title="Archive"
              >
                <Archive size={14} weight="bold" />
              </button>
            </span>
            {/* Primary slot is always filled so rows never shift: Live forms
                send, Drafts edit. */}
            {form.is_active ? (
              <button type="button" className={styles.actionBtn} onClick={onSend}>
                <PaperPlaneTilt size={13} weight="bold" />
                Send
              </button>
            ) : (
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => router.push(detailHref)}
              >
                <PencilSimple size={13} weight="bold" />
                Edit
              </button>
            )}
          </>
        )}
      </span>
    </div>
  );
}

export function FormsTab({
  forms,
  recipients,
  library,
}: {
  forms: FormListItem[];
  recipients: SendRecipient[];
  library: LibraryTemplate[];
}) {
  const router = useRouter();
  const [showArchived, setShowArchived] = useState(false);
  const [sendTarget, setSendTarget] = useState<UnifiedTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FormListItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const active = useMemo(() => forms.filter((f) => f.archived_at === null), [forms]);
  const archived = useMemo(() => forms.filter((f) => f.archived_at !== null), [forms]);

  function runRowAction(
    id: string,
    action: () => Promise<{ ok: boolean } | { ok: false; error: string }>,
    failureText: string,
  ) {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      try {
        const res = await action();
        if (!res.ok) {
          setError("error" in res && res.error ? res.error : failureText);
          return;
        }
        router.refresh();
      } finally {
        setBusyId(null);
      }
    });
  }

  function handleDuplicate(form: FormListItem) {
    setError(null);
    setBusyId(form.id);
    startTransition(async () => {
      try {
        const res = await duplicateFormAction(form.id);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        router.push(`/admin/paperwork/templates/${res.data.id}`);
      } finally {
        setBusyId(null);
      }
    });
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    runRowAction(target.id, () => deleteFormAction(target.id), "Delete failed.");
  }

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <span className={styles.countLabel}>
          {active.length} {active.length === 1 ? "form" : "forms"}
        </span>
        {archived.length > 0 && (
          <button
            type="button"
            className={styles.archivedLink}
            onClick={() => setShowArchived((v) => !v)}
            aria-expanded={showArchived}
          >
            <Archive size={13} weight="bold" />
            {archived.length} archived
            <CaretRight
              size={11}
              weight="bold"
              className={`${styles.archivedCaret} ${showArchived ? styles.archivedCaretOpen : ""}`}
            />
          </button>
        )}
      </div>

      {error && (
        <div className={styles.errorBanner} role="alert">
          <Warning size={15} weight="duotone" />
          {error}
        </div>
      )}

      {active.length === 0 ? (
        <div className={styles.emptyState}>
          <FileDashed size={40} weight="duotone" />
          <p className={styles.emptyTitle}>No forms yet</p>
          <p className={styles.emptyBody}>
            Use the New document button to build your first form. Drag and drop
            questions, then share a link or send it out.
          </p>
          {library.length > 0 ? (
            <div className={styles.libraryBlock}>
              <p className={styles.libraryLabel}>Start with one of these</p>
              <div className={styles.libraryGrid}>
                {library.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={styles.libraryCard}
                    onClick={() => router.push(`/admin/paperwork/templates/${t.id}`)}
                  >
                    <span className={styles.libraryName}>{t.name}</span>
                    {t.description && (
                      <span className={styles.libraryDesc}>{t.description}</span>
                    )}
                    <span className={styles.libraryBadge}>Proxy library</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className={styles.emptyBody}>
              The Proxy pre-made library has nothing to suggest yet.
            </p>
          )}
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <div className={styles.headerRow} aria-hidden>
            <span />
            <span className={styles.headerCell}>Name</span>
            <span className={`${styles.headerCell} ${styles.statusCell}`}>Status</span>
            <span className={`${styles.headerCell} ${styles.responseCell}`}>Responses</span>
            <span className={`${styles.headerCell} ${styles.dateCell}`}>Created</span>
            <span className={`${styles.headerCell} ${styles.dateCell}`}>Updated</span>
            <span />
          </div>
          <div className={styles.list} role="list">
            {active.map((form) => (
              <FormRow
                key={form.id}
                form={form}
                archived={false}
                busy={busyId === form.id}
                onSend={() => setSendTarget(toUnifiedTemplate(form))}
                onDuplicate={() => handleDuplicate(form)}
                onArchive={() =>
                  runRowAction(form.id, () => archiveFormAction(form.id), "Archive failed.")
                }
                onRestore={() => undefined}
                onDeleteRequest={() => setDeleteTarget(form)}
              />
            ))}
          </div>
        </div>
      )}

      {showArchived && archived.length > 0 && (
        <div className={styles.archivedSection}>
          <p className={styles.archivedTitle}>Archived</p>
          <div className={styles.list} role="list">
            {archived.map((form) => (
              <FormRow
                key={form.id}
                form={form}
                archived
                busy={busyId === form.id}
                onSend={() => undefined}
                onDuplicate={() => handleDuplicate(form)}
                onArchive={() => undefined}
                onRestore={() =>
                  runRowAction(form.id, () => unarchiveFormAction(form.id), "Restore failed.")
                }
                onDeleteRequest={() => setDeleteTarget(form)}
              />
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {sendTarget && (
          <SendSheet
            template={sendTarget}
            recipients={recipients}
            onClose={() => setSendTarget(null)}
          />
        )}
      </AnimatePresence>

      <ConfirmModal
        open={deleteTarget !== null}
        title="Delete this form?"
        description={
          deleteTarget
            ? `"${deleteTarget.name}" and all of its collected responses will be permanently deleted. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
