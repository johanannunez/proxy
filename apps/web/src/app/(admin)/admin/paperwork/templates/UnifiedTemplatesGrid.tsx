"use client";

/**
 * Unified Templates tab — one library grid holding both template kinds:
 * signature documents (DocuSeal) and forms (built schemas), with kind badges,
 * filter chips, real thumbnails, and Send + Edit actions. Absorbs the old
 * standalone Templates page and the Forms list page (paperwork unification,
 * 2026-06-12 design doc).
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  PenNib,
  Rows,
  PencilSimple,
  PaperPlaneTilt,
  LinkSimple,
  Check,
  Trash,
  SpinnerGap,
  Warning,
  FileDashed,
} from "@phosphor-icons/react";
import ConfirmModal from "@/components/admin/ConfirmModal";
import { deleteFormAction } from "./form-actions";
import type { UnifiedTemplate, UnifiedTemplateKind } from "./unified-types";
import styles from "./UnifiedTemplatesGrid.module.css";

type KindFilter = "all" | UnifiedTemplateKind;

const LAYOUT_FIELD_TYPES = new Set(["section_header", "description", "divider"]);

function publicFormUrl(slug: string): string {
  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://www.myproxyhost.com";
  return `${base}/f/${slug}`;
}

/* ─── Thumbnails ─── */

function SignatureThumbnail({ template }: { template: UnifiedTemplate }) {
  if (template.previewImageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={template.previewImageUrl}
        alt={`First page of ${template.name}`}
        className={styles.thumbImage}
        loading="lazy"
      />
    );
  }
  return (
    <div className={styles.miniPage} aria-hidden>
      <span className={styles.miniPageTitle}>{template.name}</span>
      <span className={styles.miniLine} style={{ width: "92%" }} />
      <span className={styles.miniLine} style={{ width: "84%" }} />
      <span className={styles.miniLine} style={{ width: "88%" }} />
      <span className={styles.miniLine} style={{ width: "64%" }} />
      <span className={styles.miniSigField}>
        <PenNib size={8} weight="bold" />
        Signature
      </span>
    </div>
  );
}

function FormThumbnail({ template }: { template: UnifiedTemplate }) {
  const fields = template.previewFields
    .filter((f) => !LAYOUT_FIELD_TYPES.has(f.type))
    .slice(0, 3);
  return (
    <div className={styles.miniForm} aria-hidden>
      {fields.length === 0 ? (
        <span className={styles.miniFieldEmpty}>No fields yet</span>
      ) : (
        fields.map((f, i) => (
          <div key={`${f.label}-${i}`}>
            <div className={styles.miniFieldLabel}>{f.label}</div>
            <div className={styles.miniFieldInput} />
          </div>
        ))
      )}
    </div>
  );
}

/* ─── Card ─── */

function TemplateCard({
  template,
  onSend,
  onDeleteRequest,
  deleting,
}: {
  template: UnifiedTemplate;
  onSend: (template: UnifiedTemplate) => void;
  onDeleteRequest: (template: UnifiedTemplate) => void;
  deleting: boolean;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const detailHref = `/admin/paperwork/templates/${template.id}`;
  const isForm = template.kind === "form";

  function handleCopyLink() {
    if (!template.slug) return;
    navigator.clipboard.writeText(publicFormUrl(template.slug)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const meta: string[] = [];
  if (isForm) {
    meta.push(
      template.fieldCount === 0
        ? "No fields"
        : `${template.fieldCount} ${template.fieldCount === 1 ? "field" : "fields"}`,
    );
    meta.push(
      template.responseCount === 0
        ? "No responses yet"
        : `${template.responseCount} ${template.responseCount === 1 ? "response" : "responses"}`,
    );
  } else {
    meta.push(template.signerRoles.join(", ") || "Signer");
    meta.push(
      template.sentCount === 0
        ? "Never sent"
        : `Sent ${template.sentCount} ${template.sentCount === 1 ? "time" : "times"}`,
    );
  }

  return (
    <div className={styles.card}>
      <button
        type="button"
        className={styles.thumb}
        onClick={() => router.push(detailHref)}
        aria-label={`Open ${template.name}`}
      >
        {isForm ? (
          <FormThumbnail template={template} />
        ) : (
          <SignatureThumbnail template={template} />
        )}
        <span
          className={`${styles.kindBadge} ${isForm ? styles.kindForm : styles.kindSignature}`}
        >
          {isForm ? <Rows size={10} weight="bold" /> : <PenNib size={10} weight="bold" />}
          {isForm ? "Form" : "Signature"}
        </span>
        {template.isSystem && <span className={styles.systemBadge}>Proxy library</span>}
      </button>

      <div className={styles.cardBody}>
        <div className={styles.cardTitleRow}>
          <span className={styles.cardName} title={template.name}>
            {template.name}
          </span>
          <span
            className={`${styles.statusDot} ${
              template.isReady ? styles.statusReady : styles.statusDraft
            }`}
            title={
              template.isReady
                ? isForm
                  ? "Published and collecting responses"
                  : "Ready to send"
                : "Draft"
            }
          />
        </div>

        <div className={styles.cardMeta}>
          {meta.map((m, i) => (
            <span key={m}>
              {i > 0 && (
                <span className={styles.metaSep} aria-hidden>
                  {"· "}
                </span>
              )}
              {m}
            </span>
          ))}
        </div>

        <div className={styles.cardActions}>
          {template.isReady && (
            <button
              type="button"
              className={styles.sendBtn}
              onClick={() => onSend(template)}
            >
              <PaperPlaneTilt size={12} weight="bold" />
              Send
            </button>
          )}
          <Link href={detailHref} className={styles.editBtn}>
            <PencilSimple size={12} weight="bold" />
            Edit
          </Link>
          {isForm && template.isReady && template.slug && (
            <button
              type="button"
              className={`${styles.iconBtn} ${copied ? styles.iconBtnCopied : ""}`}
              onClick={handleCopyLink}
              title="Copy public link"
            >
              {copied ? <Check size={14} weight="bold" /> : <LinkSimple size={14} weight="bold" />}
            </button>
          )}
          {isForm && !template.isSystem && (
            <button
              type="button"
              className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
              onClick={() => onDeleteRequest(template)}
              disabled={deleting}
              title="Delete form template"
              style={!template.isReady || !template.slug ? { marginLeft: "auto" } : undefined}
            >
              {deleting ? (
                <SpinnerGap size={14} weight="bold" />
              ) : (
                <Trash size={14} weight="bold" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Grid ─── */

export function UnifiedTemplatesGrid({
  templates,
  initialKind,
  onSend,
}: {
  templates: UnifiedTemplate[];
  initialKind: KindFilter;
  onSend: (template: UnifiedTemplate) => void;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<KindFilter>(initialKind);
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<UnifiedTemplate | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      all: templates.length,
      signature: templates.filter((t) => t.kind === "signature").length,
      form: templates.filter((t) => t.kind === "form").length,
    }),
    [templates],
  );

  const visible = templates.filter((t) => {
    if (kind !== "all" && t.kind !== kind) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    setDeletingId(target.id);
    setError(null);
    const result = await deleteFormAction(target.id);
    setDeletingId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <div className={styles.filterChips} role="group" aria-label="Filter templates by kind">
          {(
            [
              { key: "all", label: "All" },
              { key: "signature", label: "Signature" },
              { key: "form", label: "Forms" },
            ] as Array<{ key: KindFilter; label: string }>
          ).map((chip) => (
            <button
              key={chip.key}
              type="button"
              className={`${styles.chip} ${kind === chip.key ? styles.chipActive : ""}`}
              onClick={() => setKind(chip.key)}
            >
              {chip.label}
              <span className={styles.chipCount}>
                {chip.key === "all"
                  ? counts.all
                  : chip.key === "signature"
                  ? counts.signature
                  : counts.form}
              </span>
            </button>
          ))}
        </div>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search templates…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search templates"
        />
      </div>

      {error && (
        <div className={styles.errorBanner} role="alert">
          <Warning size={15} weight="duotone" />
          {error}
        </div>
      )}

      {visible.length === 0 ? (
        <div className={styles.emptyState}>
          <FileDashed size={40} weight="duotone" />
          <p className={styles.emptyTitle}>
            {search ? "No templates match your search" : "No templates yet"}
          </p>
          <p className={styles.emptyBody}>
            {search
              ? "Try a different name, or clear the search to see the full library."
              : "Use the New document button to upload a PDF or build a form. Everything you create is saved here for reuse."}
          </p>
        </div>
      ) : (
        <div className={styles.grid}>
          {visible.map((t) => (
            <TemplateCard
              key={`${t.kind}-${t.id}`}
              template={t}
              onSend={onSend}
              onDeleteRequest={setDeleteTarget}
              deleting={deletingId === t.id}
            />
          ))}
        </div>
      )}

      <ConfirmModal
        open={deleteTarget !== null}
        title="Delete this form template?"
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
