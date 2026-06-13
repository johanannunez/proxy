"use client";

/**
 * Templates tab — a visual library of signature/PDF masters plus the Proxy
 * library. Each template is a card with a document preview hero (DocuSeal
 * first page, or a tasteful placeholder), its name, type, status, and
 * Send/Edit actions on hover. Responsive auto-fill grid. Search lives in the
 * global command palette, not on the page.
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
import { signerRolesLabel } from "./signer-roles";
import styles from "./UnifiedTemplatesList.module.css";

function TemplateCard({
  template,
  onSend,
}: {
  template: UnifiedTemplate;
  onSend: (template: UnifiedTemplate) => void;
}) {
  const router = useRouter();
  const detailHref = `/admin/paperwork/templates/${template.id}`;
  const typeLabel = signerRolesLabel(template.signerRoles) || "Signature";

  return (
    <div
      className={styles.card}
      role="button"
      tabIndex={0}
      onClick={() => router.push(detailHref)}
      onKeyDown={(e) => e.key === "Enter" && router.push(detailHref)}
    >
      <div className={styles.preview}>
        {template.previewImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={template.previewImageUrl}
            alt={`${template.name} preview`}
            className={styles.previewImage}
            loading="lazy"
          />
        ) : (
          <div className={styles.previewPlaceholder} aria-hidden>
            <span className={styles.placeholderSheet}>
              <span className={styles.sheetHeader}>
                <PenNib size={13} weight="duotone" />
                <span className={styles.sheetHeaderLine} />
              </span>
              <span className={styles.sheetLine} />
              <span className={styles.sheetLine} />
              <span className={`${styles.sheetLine} ${styles.sheetLineShort}`} />
              <span className={styles.sheetSign} />
            </span>
          </div>
        )}

        <div className={styles.badges}>
          {template.isSystem && <span className={styles.libraryBadge}>Proxy library</span>}
          <span
            className={`${styles.statusPill} ${
              template.isReady ? styles.statusReady : styles.statusDraft
            }`}
          >
            <span className={styles.statusDot} />
            {template.isReady ? "Ready" : "Draft"}
          </span>
        </div>

        <div className={styles.hoverActions} onClick={(e) => e.stopPropagation()}>
          {template.isReady ? (
            <>
              <Link href={detailHref} className={styles.editBtn}>
                <PencilSimple size={13} weight="bold" />
                Edit
              </Link>
              <button
                type="button"
                className={styles.sendBtn}
                onClick={() => onSend(template)}
              >
                <PaperPlaneTilt size={13} weight="bold" />
                Send
              </button>
            </>
          ) : (
            <Link href={detailHref} className={styles.sendBtn}>
              <PencilSimple size={13} weight="bold" />
              Edit
            </Link>
          )}
        </div>
      </div>

      <div className={styles.cardBody}>
        <span className={styles.name} title={template.name}>
          {template.name}
        </span>
        <span className={styles.meta}>
          {typeLabel}
          {template.sentCount > 0 &&
            ` · Sent ${template.sentCount} ${template.sentCount === 1 ? "time" : "times"}`}
        </span>
      </div>
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
        <div className={styles.grid} role="list">
          {templates.map((t) => (
            <TemplateCard key={t.id} template={t} onSend={onSend} />
          ))}
        </div>
      )}
    </div>
  );
}
