"use client";

/**
 * Reusable paperwork template card, ported from the validated Round 2 previews.
 * One visual primitive (`TemplatePreview`) feeds two shells:
 *   - `TemplatePickCard`  — selectable card for the create gallery
 *   - `TemplateCard`      — management card for a hub Library (meta + actions)
 *
 * Signatures have no stored glyph, so they render a faux-document preview tinted
 * by a stable accent derived from the template key. Forms render their chosen
 * icon (or emoji) on their chosen tint. Cards lift off the dark canvas via the
 * --surface-card / --border-card tokens added in R2-A.
 */

import type { ReactNode } from "react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import styles from "./TemplateCard.module.css";

/** Eight-stop accent palette for signature previews (mirrors the form tints). */
const SIG_ACCENTS = [
  "#1b77be", "#7c3aed", "#0891b2", "#16a34a",
  "#64748b", "#d04268", "#b27908", "#0d9488",
];

/** Stable accent for a signature template, keyed off its document_key/name. */
export function accentForSeed(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return SIG_ACCENTS[h % SIG_ACCENTS.length];
}

export type TemplatePreviewSpec =
  | { kind: "signature"; accent: string }
  | { kind: "form"; Icon?: PhosphorIcon; emoji?: string; bg: string; fg: string };

/** The shared visual: a faux document for signatures, an icon/emoji tile for forms. */
export function TemplatePreview({ spec }: { spec: TemplatePreviewSpec }) {
  if (spec.kind === "signature") {
    return (
      <span
        className={styles.miniDoc}
        style={{ ["--tone" as string]: spec.accent }}
        aria-hidden
      >
        <span className={styles.miniDocBand} />
        <span className={styles.miniDocLines}>
          <span style={{ width: "84%" }} />
          <span style={{ width: "92%" }} />
          <span style={{ width: "64%" }} />
          <span style={{ width: "88%" }} />
        </span>
        <span className={styles.miniDocSign}>
          <span className={styles.miniDocSignLine} />
          <span className={styles.miniDocSignMark} />
        </span>
      </span>
    );
  }
  const { Icon, emoji, bg, fg } = spec;
  return (
    <span
      className={styles.formTile}
      style={{ ["--tile-bg" as string]: bg, ["--tile-fg" as string]: fg }}
      aria-hidden
    >
      <span className={styles.formTileIcon}>
        {emoji ? (
          <span className={styles.formTileEmoji}>{emoji}</span>
        ) : Icon ? (
          <Icon size={24} weight="duotone" />
        ) : null}
      </span>
      <span className={styles.formTileLines}>
        <span style={{ width: "70%" }} />
        <span style={{ width: "50%" }} />
      </span>
    </span>
  );
}

/* ── Selection card (create gallery) ── */

export function TemplatePickCard({
  spec,
  name,
  selected,
  onSelect,
}: {
  spec: TemplatePreviewSpec;
  name: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.card} ${styles.pickCard} ${selected ? styles.cardSelected : ""}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span className={styles.cardPreview}>
        <TemplatePreview spec={spec} />
      </span>
      <span className={styles.cardName}>{name}</span>
    </button>
  );
}

/* ── Management card (hub Library) ── */

export function TemplateCard({
  spec,
  name,
  meta,
  badge,
  onOpen,
  actions,
}: {
  spec: TemplatePreviewSpec;
  name: string;
  meta?: string;
  /** Small chip in the top-right of the preview (e.g. "Proxy", "Ready"). */
  badge?: ReactNode;
  /** Opening handler for the card body (name + preview). */
  onOpen?: () => void;
  /** Action row rendered along the card footer (Send / Edit / More). */
  actions?: ReactNode;
}) {
  return (
    <div className={styles.card}>
      <button
        type="button"
        className={styles.cardBody}
        onClick={onOpen}
        aria-label={`Open ${name}`}
      >
        <span className={styles.cardPreview}>
          {badge ? <span className={styles.cardBadge}>{badge}</span> : null}
          <TemplatePreview spec={spec} />
        </span>
        <span className={styles.cardMeta}>
          <span className={styles.cardName}>{name}</span>
          {meta ? <span className={styles.cardSub}>{meta}</span> : null}
        </span>
      </button>
      {actions ? <div className={styles.cardActions}>{actions}</div> : null}
    </div>
  );
}
