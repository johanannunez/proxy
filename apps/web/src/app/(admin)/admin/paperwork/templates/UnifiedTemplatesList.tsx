"use client";

/**
 * Templates tab list — signature/PDF masters plus the Proxy library in the
 * same list treatment as the Forms tab (2026-06-12 IA amendment: list, not
 * thumbnail grid). A small leading thumbnail renders only when DocuSeal
 * already produced a first-page preview; otherwise a pen icon.
 */

import { useState } from "react";
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
          <span
            className={`${styles.statusDot} ${
              template.isReady ? styles.statusReady : styles.statusDraft
            }`}
            title={template.isReady ? "Ready to send" : "Draft"}
          />
        </span>
        <span className={styles.nameSub}>
          {template.description ?? template.signerRoles.join(", ") ?? "Signature template"}
        </span>
      </span>

      <span className={styles.metaCell}>
        {template.signerRoles.join(", ") || "Signer"}
      </span>
      <span className={styles.metaCell}>
        {template.sentCount === 0
          ? "Never sent"
          : `Sent ${template.sentCount} ${template.sentCount === 1 ? "time" : "times"}`}
      </span>

      <span
        className={styles.actions}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {template.isReady && (
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => onSend(template)}
          >
            <PaperPlaneTilt size={13} weight="bold" />
            Send
          </button>
        )}
        <Link href={detailHref} className={styles.actionIconBtn} title="Edit">
          <PencilSimple size={14} weight="bold" />
        </Link>
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
  const [search, setSearch] = useState("");

  const visible = templates.filter((t) =>
    search ? t.name.toLowerCase().includes(search.toLowerCase()) : true,
  );

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <span className={styles.countLabel}>
          {templates.length} {templates.length === 1 ? "template" : "templates"}
        </span>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search templates…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search templates"
        />
      </div>

      {visible.length === 0 ? (
        <div className={styles.emptyState}>
          <FileDashed size={40} weight="duotone" />
          <p className={styles.emptyTitle}>
            {search ? "No templates match your search" : "No templates yet"}
          </p>
          <p className={styles.emptyBody}>
            {search
              ? "Try a different name, or clear the search to see the full library."
              : "Use the New document button to upload a PDF and place its signature fields. Everything you create is saved here for reuse."}
          </p>
        </div>
      ) : (
        <div className={styles.list} role="list">
          {visible.map((t) => (
            <TemplateRow key={t.id} template={t} onSend={onSend} />
          ))}
        </div>
      )}
    </div>
  );
}
