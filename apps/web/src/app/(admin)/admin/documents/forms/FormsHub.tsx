"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  FileText,
  Globe,
  Lock,
  PencilSimple,
  Trash,
  Eye,
  ArrowSquareOut,
  ChartBar,
  SpinnerGap,
  Warning,
} from "@phosphor-icons/react";
import { createFormAction, deleteFormAction } from "./form-actions";
import type { Form } from "@/lib/admin/forms-types";
import styles from "./FormsHub.module.css";

type Props = {
  forms: Form[];
  orgId: string;
};

export function FormsHub({ forms, orgId }: Props) {
  const router = useRouter();
  const [creating, startCreating] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const published = forms.filter((f) => f.is_active);
  const drafts = forms.filter((f) => !f.is_active);

  async function handleNewForm() {
    setError(null);
    startCreating(async () => {
      const result = await createFormAction(orgId, "Untitled Form");
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/admin/documents/forms/${result.data.id}/edit`);
    });
  }

  async function handleDelete(id: string) {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    setDeletingId(id);
    setConfirmDeleteId(null);
    const result = await deleteFormAction(id);
    setDeletingId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className={styles.root}>
      <div className={styles.pageHeader}>
        <div className={styles.headerText}>
          <h1 className={styles.pageTitle}>Forms</h1>
          <p className={styles.pageSubtitle}>
            Build drag-and-drop forms for owners, guests, and internal use. Generate with AI or build from scratch.
          </p>
        </div>
        <button
          type="button"
          className={styles.newBtn}
          onClick={handleNewForm}
          disabled={creating}
        >
          {creating ? (
            <SpinnerGap size={14} weight="bold" className={styles.spin} />
          ) : (
            <Plus size={14} weight="bold" />
          )}
          New Form
        </button>
      </div>

      {error && (
        <div className={styles.errorBanner}>
          <Warning size={16} weight="duotone" />
          {error}
        </div>
      )}

      {forms.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <FileText size={32} weight="duotone" />
          </div>
          <p className={styles.emptyTitle}>No forms yet</p>
          <p className={styles.emptyBody}>
            Create your first form. Describe what you need and let AI build the first draft, or start with a blank canvas.
          </p>
          <button
            type="button"
            className={styles.newBtn}
            onClick={handleNewForm}
            disabled={creating}
          >
            <Plus size={14} weight="bold" />
            New Form
          </button>
        </div>
      )}

      {published.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Published</h2>
            <span className={styles.sectionCount}>{published.length}</span>
          </div>
          <div className={styles.formList}>
            {published.map((form) => (
              <FormCard
                key={form.id}
                form={form}
                onDelete={handleDelete}
                deletingId={deletingId}
                confirmDeleteId={confirmDeleteId}
                onCancelDelete={() => setConfirmDeleteId(null)}
              />
            ))}
          </div>
        </section>
      )}

      {drafts.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Drafts</h2>
            <span className={styles.sectionCount}>{drafts.length}</span>
          </div>
          <div className={styles.formList}>
            {drafts.map((form) => (
              <FormCard
                key={form.id}
                form={form}
                onDelete={handleDelete}
                deletingId={deletingId}
                confirmDeleteId={confirmDeleteId}
                onCancelDelete={() => setConfirmDeleteId(null)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function FormCard({
  form,
  onDelete,
  deletingId,
  confirmDeleteId,
  onCancelDelete,
}: {
  form: Form;
  onDelete: (id: string) => void;
  deletingId: string | null;
  confirmDeleteId: string | null;
  onCancelDelete: () => void;
}) {
  const router = useRouter();
  const isDeleting = deletingId === form.id;
  const isConfirming = confirmDeleteId === form.id;

  const fieldCount = form.schema.fields.length;

  return (
    <div className={`${styles.card} ${isDeleting ? styles.cardDeleting : ""}`}>
      <div className={styles.cardIcon}>
        <FileText size={20} weight="duotone" />
      </div>

      <div className={styles.cardBody}>
        <div className={styles.cardTop}>
          <span className={styles.cardName}>{form.name}</span>
          <div className={styles.cardBadges}>
            {form.is_active ? (
              <span className={`${styles.badge} ${styles.badgePublished}`}>Published</span>
            ) : (
              <span className={`${styles.badge} ${styles.badgeDraft}`}>Draft</span>
            )}
            {form.is_public ? (
              <span className={`${styles.badge} ${styles.badgePublic}`}>
                <Globe size={10} weight="bold" />
                Public
              </span>
            ) : (
              <span className={`${styles.badge} ${styles.badgePrivate}`}>
                <Lock size={10} weight="bold" />
                Private
              </span>
            )}
          </div>
        </div>

        {form.description && (
          <p className={styles.cardDescription}>{form.description}</p>
        )}

        <div className={styles.cardMeta}>
          <span className={styles.metaItem}>
            {fieldCount === 0 ? "No fields" : `${fieldCount} field${fieldCount !== 1 ? "s" : ""}`}
          </span>
          {form.slug && (
            <span className={styles.metaItem}>
              /f/{form.slug}
            </span>
          )}
        </div>
      </div>

      <div className={styles.cardActions}>
        {isConfirming ? (
          <>
            <span className={styles.confirmText}>Delete?</span>
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
              onClick={() => onDelete(form.id)}
            >
              Yes, delete
            </button>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={onCancelDelete}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            {form.is_active && form.slug && (
              <a
                href={`/f/${form.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.actionBtn}
                title="Open public form"
              >
                <ArrowSquareOut size={14} weight="bold" />
              </a>
            )}
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => router.push(`/admin/documents/forms/${form.id}/responses`)}
              title="View responses"
            >
              <ChartBar size={14} weight="bold" />
            </button>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => router.push(`/admin/documents/forms/${form.id}/edit`)}
              title="Edit form"
            >
              <PencilSimple size={14} weight="bold" />
            </button>
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
              onClick={() => onDelete(form.id)}
              disabled={isDeleting}
              title="Delete form"
            >
              {isDeleting ? (
                <SpinnerGap size={14} weight="bold" className={styles.spin} />
              ) : (
                <Trash size={14} weight="bold" />
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
