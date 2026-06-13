"use client";

/**
 * Templates tab list — signature/PDF masters plus the Proxy library in the
 * same premium row system as the Forms tab (2026-06-12 IA amendment + UI
 * polish): aligned column headers, status pills, a stable hover-reveal action
 * slot, and a small leading thumbnail when DocuSeal produced a first-page
 * preview. Search lives in the global command palette, not on the page.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  PenNib,
  PencilSimple,
  PaperPlaneTilt,
  FileDashed,
} from "@phosphor-icons/react";
import type { UnifiedTemplate } from "./unified-types";
import styles from "./UnifiedTemplatesList.module.css";

function TemplateRow({
  template,
  onSend,
}: {
  template: UnifiedTemplate;
  onSend: (template: UnifiedTemplate) => void;
}) {
  const router = useRouter();
  const detailHref = `/admin/paperwork/templates/${template.id}`;
  const typeLabel = template.signerRoles.join(", ") || "Signature";

  return (
    <div
      className={styles.row}
      role="button"
      tabIndex={0}
      onClick={() => router.push(detailHref)}
      onKeyDown={(e) => e.key === "Enter" && router.push(detailHref)}
    >
      <span className={styles.rowThumb} aria-hidden>
        {template.previewImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={template.previewImageUrl}
            alt=""
            className={styles.thumbImage}
            loading="lazy"
          />
        ) : (
          <PenNib size={16} weight="duotone" />
        )}
      </span>

      <span className={styles.nameCell}>
        <span className={styles.nameLine}>
          <span className={styles.name} title={template.name}>
            {template.name}
          </span>
          {template.isSystem && <span className={styles.systemBadge}>Proxy library</span>}
        </span>
        {template.description && (
          <span className={styles.nameSub} title={template.description}>
            {template.description}
          </span>
        )}
      </span>

      <span className={styles.statusCell}>
        {template.isReady ? (
          <span className={`${styles.statusPill} ${styles.statusReady}`}>
            <span className={styles.statusDot} />
            Ready
          </span>
        ) : (
          <span className={`${styles.statusPill} ${styles.statusDraft}`}>
            <span className={styles.statusDot} />
            Draft
          </span>
        )}
      </span>

      <span className={`${styles.metaCell} ${styles.typeCell}`} title={typeLabel}>
        {typeLabel}
      </span>
      <span className={`${styles.metaCell} ${styles.usageCell}`}>
        {template.sentCount === 0
          ? "Never sent"
          : `Sent ${template.sentCount} ${template.sentCount === 1 ? "time" : "times"}`}
      </span>

      <span
        className={styles.actions}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <span className={styles.actionReveal}>
          <Link href={detailHref} className={styles.actionIconBtn} title="Edit">
            <PencilSimple size={14} weight="bold" />
          </Link>
        </span>
        {/* Primary slot always filled: Ready templates send, Drafts edit. */}
        {template.isReady ? (
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => onSend(template)}
          >
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
      </span>
    </div>
  );
}

export function UnifiedTemplatesList({
  templates,
  onSend,
}: {
  templates: UnifiedTemplate[];
  onSend: (template: UnifiedTemplate) => void;
}) {
  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <span className={styles.countLabel}>
          {templates.length} {templates.length === 1 ? "template" : "templates"}
        </span>
      </div>

      {templates.length === 0 ? (
        <div className={styles.emptyState}>
          <FileDashed size={40} weight="duotone" />
          <p className={styles.emptyTitle}>No templates yet</p>
          <p className={styles.emptyBody}>
            Use the New template button to upload a PDF and place its signature
            fields. Everything you create is saved here for reuse.
          </p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <div className={styles.headerRow} aria-hidden>
            <span />
            <span className={styles.headerCell}>Name</span>
            <span className={`${styles.headerCell} ${styles.statusCell}`}>Status</span>
            <span className={`${styles.headerCell} ${styles.typeCell}`}>Type</span>
            <span className={`${styles.headerCell} ${styles.usageCell}`}>Usage</span>
            <span />
          </div>
          <div className={styles.list} role="list">
            {templates.map((t) => (
              <TemplateRow key={t.id} template={t} onSend={onSend} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
