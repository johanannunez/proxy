"use client";

/**
 * FormsTab: Library | Activity sub-tabs (Round 2 IA).
 *
 * Library: card or list view of form masters. Preserves Send/Share/Duplicate/
 * Archive row wiring, the SendSheet block, and the archive view.
 *
 * Activity: cross-form response feed via ActivityTable (shared component).
 * Search + form filter narrow the visible rows client-side.
 */

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  PaperPlaneTilt,
  LinkSimple,
  Copy,
  Check,
  Archive,
  ArrowCounterClockwise,
  Trash,
  SpinnerGap,
  Warning,
  FileDashed,
  CaretDown,
  PencilSimple,
  GearSix,
  ArrowSquareOut,
  Sparkle,
  X,
} from "@phosphor-icons/react";
import { resolveFormAppearance, FormGlyph } from "./form-icon";
import type { Form } from "@/lib/admin/forms-types";
import {
  fmtShortDate,
  avatarColor,
} from "@/lib/admin/documents-hub-shared";
import type { UnifiedFormResponse } from "@/lib/admin/responses-csv";
import ConfirmModal from "@/components/admin/ConfirmModal";
import { SendSheet } from "../templates/SendSheet";
import {
  duplicateFormAction,
  archiveFormAction,
  unarchiveFormAction,
  deleteFormAction,
} from "../templates/form-actions";
import type { SendRecipient, UnifiedTemplate } from "../templates/unified-types";
import {
  HubSubTabs,
  ViewToggle,
  type HubTab,
} from "@/components/admin/paperwork/HubChrome";
import {
  CardActionMenu,
  type CardMenuItem,
} from "@/components/admin/paperwork/CardActionMenu";
import {
  ActivityTable,
  type ActivityRow,
} from "@/components/admin/paperwork/ActivityTable";
import { ActivityFilters } from "@/components/admin/paperwork/ActivityFilters";
import { useStickyView } from "@/lib/admin/use-sticky-view";
import styles from "./FormsTab.module.css";

// ── Types ─────────────────────────────────────────────────────────────────────

type FormListItem = Form & { response_count: number };
type FormCollectionMode = "active" | "archive";
type FormStatusFilter = "all" | "live" | "draft";
type LastUpdatedFilter = "all" | "7d" | "30d" | "older";
type FilterOption<T extends string> = { value: T; label: string };

type LibraryTemplate = {
  id: string;
  name: string;
  description: string | null;
};

type FormActivityRow = UnifiedFormResponse;

// ── Helpers ───────────────────────────────────────────────────────────────────

const RESPONSE_STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "submitted", label: "Submitted" },
  { value: "started", label: "Started" },
];

const FORM_STATUS_OPTIONS: FilterOption<FormStatusFilter>[] = [
  { value: "all", label: "All statuses" },
  { value: "live", label: "Live" },
  { value: "draft", label: "Draft" },
];

const LAST_UPDATED_OPTIONS: FilterOption<LastUpdatedFilter>[] = [
  { value: "all", label: "Any time" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "older", label: "Older than 30 days" },
];

const SUMMARY_SKIP_FIELD_TYPES = new Set<string>([
  "section_header",
  "description",
  "divider",
  "page_break",
]);
const FORM_CARD_TITLE_MAX = 46;
const FORM_CARD_SUMMARY_MAX = 76;

function publicFormUrl(slug: string): string {
  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://www.myproxyhost.com";
  return `${base}/f/${slug}`;
}

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
    fieldCount: form.schema?.fields?.length ?? 0,
    previewFields: (form.schema?.fields ?? [])
      .slice(0, 6)
      .map((field) => ({ label: field.label, type: field.type })),
    slug: form.slug,
    isPublic: form.is_public,
  };
}

function responseLabel(count: number): string {
  if (count === 0) return "No responses";
  return `${count} ${count === 1 ? "response" : "responses"}`;
}

function questionLabel(count: number): string {
  return `${count} ${count === 1 ? "question" : "questions"}`;
}

function limitCardText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  const clipped = normalized.slice(0, maxLength + 1);
  const lastSpace = clipped.lastIndexOf(" ");
  const safeClip = lastSpace > maxLength * 0.65 ? clipped.slice(0, lastSpace) : clipped.slice(0, maxLength);
  return `${safeClip.trim()}...`;
}

function sentenceList(labels: string[]): string {
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

function formCardSummary(form: FormListItem): string {
  const manual = form.description?.trim();
  if (manual) return limitCardText(manual, FORM_CARD_SUMMARY_MAX);

  const fields = (form.schema?.fields ?? []).filter(
    (field) => field.label.trim() && !SUMMARY_SKIP_FIELD_TYPES.has(field.type),
  );
  if (fields.length === 0) {
    return "Add questions before sharing this form.";
  }

  const labels = fields.slice(0, 2).map((field) => field.label.trim());
  const extraCount = fields.length - labels.length;
  const extraText =
    extraCount > 0
      ? `, plus ${extraCount} more ${extraCount === 1 ? "question" : "questions"}`
      : "";
  return limitCardText(`Collects ${sentenceList(labels)}${extraText}.`, FORM_CARD_SUMMARY_MAX);
}

function canDeleteForm(form: FormListItem): boolean {
  return form.response_count === 0;
}

function searchValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(searchValue).join(" ");
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).map(searchValue).join(" ");
  }
  return "";
}

function responseSearchText(response: FormActivityRow): string {
  return [
    response.form_name,
    response.respondent_name ?? "",
    response.respondent_email ?? "",
    response.property_name ?? "",
    searchValue(response.data),
  ].join(" ");
}

const FULL_DATE_FORMATTER = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const PREVIEW_DATE_FORMATTER = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatFullDate(value: string | null): string {
  if (!value) return "Not submitted";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return FULL_DATE_FORMATTER.format(date);
}

function formatPreviewDate(value: string | null): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return PREVIEW_DATE_FORMATTER.format(date);
}

function fieldLabel(key: string): string {
  const normalized = key.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return "Answer";
  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function responseDisplayValue(value: unknown): string {
  if (value == null || value === "") return "Empty";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number" || typeof value === "string") return String(value);
  if (Array.isArray(value)) return value.map(responseDisplayValue).join(", ");
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

type ResponseEntry = [string, unknown];
type ResponseSummary = {
  title: string;
  body: string;
};

function normalizedResponseLabel(key: string, labelByFieldId: Map<string, string>): string {
  return (labelByFieldId.get(key) ?? fieldLabel(key)).toLowerCase();
}

function findResponseValue(
  entries: ResponseEntry[],
  labelByFieldId: Map<string, string>,
  matcher: (label: string, key: string) => boolean,
): string | null {
  for (const [key, rawValue] of entries) {
    const label = normalizedResponseLabel(key, labelByFieldId);
    if (!matcher(label, key)) continue;
    const value = responseDisplayValue(rawValue).trim();
    if (value && value !== "Empty") return value;
  }
  return null;
}

function lowerFirst(value: string): string {
  if (!value) return value;
  return `${value.charAt(0).toLowerCase()}${value.slice(1)}`;
}

function buildResponseSummary(
  response: FormActivityRow,
  entries: ResponseEntry[],
  labelByFieldId: Map<string, string>,
): ResponseSummary {
  const issue = findResponseValue(
    entries,
    labelByFieldId,
    (label) => label.includes("issue") || label.includes("description") || label.includes("request"),
  );
  const urgency = findResponseValue(entries, labelByFieldId, (label) => label.includes("urgency"));
  const preferredTime = findResponseValue(
    entries,
    labelByFieldId,
    (label) => label.includes("preferred time") || label.includes("time") || label.includes("window"),
  );
  const firstAnswer =
    entries
      .map(([, rawValue]) => responseDisplayValue(rawValue).trim())
      .find((value) => value && value !== "Empty") ?? null;
  const title =
    issue ?? firstAnswer ?? `${entries.length} captured ${entries.length === 1 ? "answer" : "answers"}`;
  const respondent = response.respondent_name ?? "The respondent";
  const formName = response.form_name.toLowerCase();

  if (urgency && preferredTime) {
    return {
      title,
      body: `${respondent} submitted a ${urgency.toLowerCase()} urgency ${formName} and prefers ${preferredTime.toLowerCase()}.`,
    };
  }

  if (urgency) {
    return {
      title,
      body: `${respondent} submitted a ${urgency.toLowerCase()} urgency ${formName}.`,
    };
  }

  if (preferredTime) {
    return {
      title,
      body: `${respondent} submitted this ${formName} and prefers ${lowerFirst(preferredTime)}.`,
    };
  }

  return {
    title,
    body: `${respondent} submitted ${entries.length} ${entries.length === 1 ? "answer" : "answers"} for review.`,
  };
}

async function copyTextToClipboard(value: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Fall through to the selection-based copy path.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  return copied;
}

function ResponsePreviewDrawer({
  response,
  form,
  onClose,
  onOpenForm,
}: {
  response: FormActivityRow;
  form: FormListItem | undefined;
  onClose: () => void;
  onOpenForm: () => void;
}) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const appearance = resolveFormAppearance({
    id: response.form_id,
    icon: form?.icon ?? null,
    icon_color: form?.icon_color ?? null,
  });
  const labelByFieldId = useMemo(() => {
    return new Map(
      (form?.schema?.fields ?? [])
        .filter((field) => field.label.trim())
        .map((field) => [field.id, field.label.trim()] as const),
    );
  }, [form]);
  const responseEntries = useMemo<ResponseEntry[]>(() => Object.entries(response.data), [response.data]);
  const responseSummary = useMemo(
    () => buildResponseSummary(response, responseEntries, labelByFieldId),
    [labelByFieldId, response, responseEntries],
  );
  const isComplete = response.completed_at !== null;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!copiedKey) return;
    const timeout = window.setTimeout(() => setCopiedKey(null), 1400);
    return () => window.clearTimeout(timeout);
  }, [copiedKey]);

  async function copyAnswer(key: string, value: string) {
    setCopiedKey(key);
    await copyTextToClipboard(value);
  }

  return (
    <>
      <motion.div
        className={styles.previewBackdrop}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.aside
        className={styles.responsePreview}
        role="dialog"
        aria-modal="true"
        aria-label={`Response preview for ${response.form_name}`}
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 420, damping: 38 }}
      >
        <div className={styles.previewHeader}>
          <div className={styles.previewTitleRow}>
            <span
              className={styles.previewIcon}
              style={{ background: appearance.bg, color: appearance.fg }}
              aria-hidden
            >
              <FormGlyph appearance={appearance} size={20} />
            </span>
            <div className={styles.previewTitleText}>
              <span className={styles.previewEyebrow}>Response preview</span>
              <h2 className={styles.previewTitle}>{response.form_name}</h2>
            </div>
          </div>
          <button
            type="button"
            className={styles.previewClose}
            onClick={onClose}
            aria-label="Close response preview"
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        <div className={styles.previewBody}>
          <section className={styles.previewSummaryCard} aria-label="AI response summary">
            <span className={styles.previewSummaryBadge}>
              <Sparkle size={13} weight="fill" />
              AI Summary
            </span>
            <h3 className={styles.previewSummaryTitle}>{responseSummary.title}</h3>
            <p className={styles.previewSummaryBody}>{responseSummary.body}</p>
          </section>

          <section className={styles.previewSummaryList} aria-label="Response details">
            <span className={styles.previewSummaryItem}>
              <span className={styles.previewMetaLabel}>Status</span>
              <span
                className={`${styles.previewStatusPill} ${
                  isComplete ? styles.previewStatusSubmitted : styles.previewStatusStarted
                }`}
              >
                {isComplete ? "Submitted" : "Started"}
              </span>
            </span>
            <span className={styles.previewSummaryItem}>
              <span className={styles.previewMetaLabel}>Respondent</span>
              <span className={styles.previewMetaValue}>
                {response.respondent_name ?? "Anonymous"}
              </span>
            </span>
            <span className={styles.previewSummaryItem}>
              <span className={styles.previewMetaLabel}>Property</span>
              <span className={styles.previewMetaValue}>
                {response.property_name ?? "Not attached"}
              </span>
            </span>
            <span className={styles.previewSummaryItem}>
              <span className={styles.previewMetaLabel}>Received</span>
              <span className={styles.previewMetaValue}>
                {formatPreviewDate(response.submitted_at)}
              </span>
            </span>
          </section>

          <div className={styles.responseFields}>
            <div className={styles.responseFieldsHeader}>
              <h3>Responses</h3>
              <span>{responseEntries.length}</span>
            </div>
            {responseEntries.length > 0 ? (
              responseEntries.map(([key, rawValue]) => {
                const value = responseDisplayValue(rawValue);
                const label = labelByFieldId.get(key) ?? fieldLabel(key);
                const copied = copiedKey === key;
                return (
                  <div
                    key={key}
                    className={`${styles.responseFieldRow} ${
                      copied ? styles.responseFieldRowCopied : ""
                    }`}
                  >
                    <span className={styles.responseFieldText}>
                      <span className={styles.responseFieldLabel}>{label}</span>
                      <span
                        className={`${styles.responseFieldValue} ${
                          copied ? styles.responseFieldValueCopied : ""
                        }`}
                      >
                        {value}
                      </span>
                    </span>
                    <button
                      type="button"
                      className={`${styles.copyAction} ${copied ? styles.copyActionCopied : ""}`}
                      onClick={() => copyAnswer(key, value)}
                      aria-label={`Copy ${label}`}
                    >
                      {copied ? <Check size={13} weight="bold" /> : <Copy size={13} weight="bold" />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                );
              })
            ) : (
              <div className={styles.previewEmpty}>No answers were captured for this response.</div>
            )}
          </div>
        </div>

        <div className={styles.previewFooter}>
          <button type="button" className={styles.openFormBtn} onClick={onOpenForm}>
            <ArrowSquareOut size={15} weight="bold" />
            Open form
          </button>
        </div>
      </motion.aside>
    </>
  );
}

function matchesLastUpdated(form: FormListItem, filter: LastUpdatedFilter): boolean {
  if (filter === "all") return true;
  const updatedTime = new Date(form.updated_at).getTime();
  if (Number.isNaN(updatedTime)) return true;
  const ageMs = Date.now() - updatedTime;
  const dayMs = 24 * 60 * 60 * 1000;
  if (filter === "7d") return ageMs <= 7 * dayMs;
  if (filter === "30d") return ageMs <= 30 * dayMs;
  return ageMs > 30 * dayMs;
}

function FilterMenu<T extends string>({
  label,
  value,
  options,
  onChange,
  compact = false,
}: {
  label: string;
  value: T;
  options: FilterOption<T>[];
  onChange: (value: T) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (ref.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const menuClassName = compact ? `${styles.filterMenu} ${styles.filterMenuCompact}` : styles.filterMenu;

  return (
    <span className={menuClassName} ref={ref}>
      <button
        type="button"
        className={styles.filterButton}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((next) => !next)}
      >
        <span className={styles.filterLabel}>{label}</span>
        <span className={styles.filterValue}>{selected.label}</span>
        <CaretDown
          size={12}
          weight="bold"
          className={`${styles.filterCaret} ${open ? styles.filterCaretOpen : ""}`}
        />
      </button>
      {open ? (
        <span className={styles.filterPanel} role="listbox" aria-label={label}>
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                className={`${styles.filterOption} ${active ? styles.filterOptionActive : ""}`}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            );
          })}
        </span>
      ) : null}
    </span>
  );
}

// ── FormRow (list view) ───────────────────────────────────────────────────────

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
  const detailHref = `/admin/paperwork/templates/${form.id}`;
  const appearance = resolveFormAppearance(form);
  const deleteAllowed = canDeleteForm(form);
  const primaryDate = archived ? form.archived_at : form.created_at;

  function copyLink() {
    if (!form.slug) return;
    navigator.clipboard.writeText(publicFormUrl(form.slug));
  }

  const menuItems: CardMenuItem[] = [];
  if (!archived && form.is_active && form.slug) {
    menuItems.push({
      label: "Copy share link",
      confirmLabel: "Link copied",
      icon: <LinkSimple size={15} weight="bold" />,
      onSelect: copyLink,
    });
  }
  menuItems.push({
    label: "Summary settings",
    icon: <GearSix size={15} weight="bold" />,
    onSelect: () => router.push(`${detailHref}?tab=settings`),
  });
  menuItems.push({
    label: "Duplicate",
    icon: <Copy size={15} weight="bold" />,
    onSelect: onDuplicate,
  });
  if (deleteAllowed) {
    menuItems.push({
      label: "Delete completely",
      icon: <Trash size={15} weight="bold" />,
      onSelect: onDeleteRequest,
      danger: true,
    });
  } else {
    menuItems.push({
      label: "Delete unavailable",
      description: "Responses exist",
      icon: <Trash size={15} weight="bold" />,
      onSelect: () => undefined,
      disabled: true,
    });
  }
  if (!archived) {
    menuItems.push({
      label: deleteAllowed ? "Archive" : "Archive instead",
      icon: <Archive size={15} weight="bold" />,
      onSelect: onArchive,
      danger: true,
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
        <FormGlyph appearance={appearance} size={17} />
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
        {responseLabel(form.response_count)}
      </span>
      <span className={`${styles.metaCell} ${styles.dateCell}`}>
        {fmtShortDate(primaryDate)}
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
            <CardActionMenu items={menuItems} label={`More actions for ${form.name}`} />
          </>
        ) : (
          <>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => router.push(detailHref)}
            >
              <PencilSimple size={13} weight="bold" />
              Edit
            </button>
            {form.is_active && (
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                onClick={onSend}
              >
                <PaperPlaneTilt size={13} weight="bold" />
                Send
              </button>
            )}
            <CardActionMenu items={menuItems} label={`More actions for ${form.name}`} />
          </>
        )}
      </span>
    </div>
  );
}

// ── FormCardItem (cards view) ─────────────────────────────────────────────────

function FormCardItem({
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
  const detailHref = `/admin/paperwork/templates/${form.id}`;
  const appearance = resolveFormAppearance({
    id: form.id,
    icon: form.icon,
    icon_color: form.icon_color,
  });
  const deleteAllowed = canDeleteForm(form);
  const qCount = form.schema?.fields?.length ?? 0;
  const displayName = limitCardText(form.name, FORM_CARD_TITLE_MAX);
  const summary = formCardSummary(form);
  const responseText = responseLabel(form.response_count);
  const noResponses = form.response_count === 0;
  const statusLabel = archived ? "Archived" : form.is_active ? "Live" : "Draft";
  const statusClass = archived
    ? styles.formCardStatusArchived
    : form.is_active
      ? styles.formCardStatusLive
      : styles.formCardStatusDraft;
  const timelineLabel = archived
    ? `Archived ${fmtShortDate(form.archived_at)}`
    : `Updated ${fmtShortDate(form.updated_at)}`;

  function copyLink() {
    if (!form.slug) return;
    navigator.clipboard.writeText(publicFormUrl(form.slug));
  }

  const menuItems: CardMenuItem[] = [];
  if (!archived && form.is_active && form.slug) {
    menuItems.push({
      label: "Copy share link",
      confirmLabel: "Link copied",
      icon: <LinkSimple size={15} weight="bold" />,
      onSelect: copyLink,
    });
  }
  menuItems.push({
    label: "Summary settings",
    icon: <GearSix size={15} weight="bold" />,
    onSelect: () => router.push(`${detailHref}?tab=settings`),
  });
  menuItems.push({
    label: "Duplicate",
    icon: <Copy size={15} weight="bold" />,
    onSelect: onDuplicate,
  });
  if (deleteAllowed) {
    menuItems.push({
      label: "Delete completely",
      icon: <Trash size={15} weight="bold" />,
      onSelect: onDeleteRequest,
      danger: true,
    });
  } else {
    menuItems.push({
      label: "Delete unavailable",
      description: "Responses exist",
      icon: <Trash size={15} weight="bold" />,
      onSelect: () => undefined,
      disabled: true,
    });
  }
  if (!archived) {
    menuItems.push({
      label: deleteAllowed ? "Archive" : "Archive instead",
      icon: <Archive size={15} weight="bold" />,
      onSelect: onArchive,
      danger: true,
    });
  }

  const cardActions = busy ? (
    <span className={styles.actionSpinner} aria-label="Working">
      <SpinnerGap size={14} weight="bold" />
    </span>
  ) : (
    <span className={styles.formCardActionRow}>
      <span className={styles.formCardActionCluster}>
        {archived ? (
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionBtnSm} ${styles.formCardDraftCta}`}
            onClick={(e) => {
              e.stopPropagation();
              onRestore();
            }}
          >
            <ArrowCounterClockwise size={12} weight="bold" />
            Restore
          </button>
        ) : (
          <>
            {form.is_active ? (
              <>
                <button
                  type="button"
                  className={styles.actionIconOnly}
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(detailHref);
                  }}
                  aria-label={`Edit ${form.name}`}
                  title="Edit"
                >
                  <PencilSimple size={13} weight="bold" />
                </button>
                <button
                  type="button"
                  className={`${styles.actionBtn} ${styles.actionBtnSm} ${styles.actionBtnPrimary} ${styles.formCardPrimaryBtn}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSend();
                  }}
                >
                  <PaperPlaneTilt size={12} weight="bold" />
                  Send form
                </button>
              </>
            ) : (
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.actionBtnSm} ${styles.formCardDraftCta}`}
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(detailHref);
                }}
              >
                <PencilSimple size={12} weight="bold" />
                Continue editing
              </button>
            )}
          </>
        )}
      </span>
      <CardActionMenu items={menuItems} label={`More actions for ${form.name}`} />
    </span>
  );

  return (
    <article
      className={`${styles.formCard} ${archived ? styles.formCardArchived : ""}`}
      style={{
        ["--form-tone" as string]: appearance.fg,
        ["--form-surface" as string]: appearance.bg,
      }}
    >
      <button
        type="button"
        className={styles.formCardBody}
        onClick={() => router.push(detailHref)}
        aria-label={`Open ${form.name}`}
      >
        <span className={styles.formCardPreview}>
          <span className={`${styles.formCardStatus} ${statusClass}`}>
            {statusLabel}
          </span>
          <span className={styles.formCardPreviewSheet} aria-hidden>
            <span className={styles.formCardPreviewHeader}>
              <span />
              <span />
              <span />
            </span>
            <span
              className={styles.formCardIcon}
              style={{ background: appearance.fg, color: "#fff" }}
            >
              <FormGlyph appearance={appearance} size={24} />
            </span>
            <span className={styles.formCardLines}>
              <span />
              <span />
            </span>
          </span>
        </span>
        <span className={styles.formCardContent}>
          <span className={styles.formCardHeader}>
            <span
              className={styles.formCardTitleGlyph}
              style={{ background: appearance.bg, color: appearance.fg }}
            >
              <FormGlyph appearance={appearance} size={13} />
            </span>
            <span className={styles.formCardName} title={form.name}>
              {displayName}
            </span>
          </span>
          <span className={styles.formCardDescription} title={summary}>
            {summary}
          </span>
          <span className={styles.formCardMetrics}>
            <span className={styles.formCardStatsLine}>
              <span className={styles.formCardMetric}>{questionLabel(qCount)}</span>
              <span
                className={`${styles.formCardMetric} ${noResponses ? styles.formCardMetricEmpty : ""}`}
              >
                {responseText}
              </span>
            </span>
            <span className={styles.formCardUpdatedText}>{timelineLabel}</span>
          </span>
        </span>
      </button>
      <div className={styles.formCardFooter}>{cardActions}</div>
    </article>
  );
}

// ── FormsTab ──────────────────────────────────────────────────────────────────

export function FormsTab({
  forms,
  recipients,
  library,
  responses,
}: {
  forms: FormListItem[];
  recipients: SendRecipient[];
  library: LibraryTemplate[];
  responses: FormActivityRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<HubTab>("library");
  const [view, setView] = useStickyView("forms", "cards");
  const [formStatusFilter, setFormStatusFilter] = useState<FormStatusFilter>("all");
  const [updatedFilter, setUpdatedFilter] = useState<LastUpdatedFilter>("all");
  const [sendTarget, setSendTarget] = useState<UnifiedTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FormListItem | null>(null);
  const [previewResponse, setPreviewResponse] = useState<FormActivityRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [optimisticDeletedIds, setOptimisticDeletedIds] = useState<Set<string>>(() => new Set());
  const [, startTransition] = useTransition();

  // Activity filters
  const [search, setSearch] = useState("");
  const [filterFormId, setFilterFormId] = useState("");
  const [filterPropertyId, setFilterPropertyId] = useState("");
  const [filterPerson, setFilterPerson] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const visibleForms = useMemo(
    () => forms.filter((form) => !optimisticDeletedIds.has(form.id)),
    [forms, optimisticDeletedIds],
  );
  const formsById = useMemo(() => new Map(forms.map((form) => [form.id, form])), [forms]);
  const active = useMemo(() => visibleForms.filter((f) => f.archived_at === null), [visibleForms]);
  const archived = useMemo(() => visibleForms.filter((f) => f.archived_at !== null), [visibleForms]);
  const filteredActive = useMemo(() => {
    return active.filter((form) => {
      if (formStatusFilter === "live" && !form.is_active) return false;
      if (formStatusFilter === "draft" && form.is_active) return false;
      return matchesLastUpdated(form, updatedFilter);
    });
  }, [active, formStatusFilter, updatedFilter]);
  const filteredArchived = useMemo(() => {
    return archived.filter((form) => matchesLastUpdated(form, updatedFilter));
  }, [archived, updatedFilter]);

  // Build form filter options from the fetched forms
  const formFilterOptions = useMemo(() => [
    { value: "", label: "All forms" },
    ...forms.map((f) => ({ value: f.id, label: f.name })),
  ], [forms]);

  // Respondent options derived from the responses that exist
  const personFilterOptions = useMemo(() => [
    { value: "", label: "All people" },
    ...Array.from(
      new Set(responses.map((r) => r.respondent_name ?? "Anonymous")),
    ).map((p) => ({ value: p, label: p })),
  ], [responses]);

  const propertyFilterOptions = useMemo(() => {
    const attached = new Map<string, string>();
    let hasUnattached = false;
    for (const response of responses) {
      if (response.property_id && response.property_name) {
        attached.set(response.property_id, response.property_name);
      } else {
        hasUnattached = true;
      }
    }
    return [
      { value: "", label: "All properties" },
      ...(hasUnattached ? [{ value: "__none", label: "Not attached" }] : []),
      ...Array.from(attached, ([value, label]) => ({ value, label })),
    ];
  }, [responses]);

  // Map responses to ActivityRow
  const activityRows = useMemo<ActivityRow[]>(() => {
    let rows = responses;
    if (filterFormId) rows = rows.filter((r) => r.form_id === filterFormId);
    if (filterPropertyId === "__none") rows = rows.filter((r) => r.property_id === null);
    if (filterPropertyId && filterPropertyId !== "__none") {
      rows = rows.filter((r) => r.property_id === filterPropertyId);
    }
    if (filterPerson) rows = rows.filter((r) => (r.respondent_name ?? "Anonymous") === filterPerson);
    if (filterStatus === "submitted") rows = rows.filter((r) => r.completed_at !== null);
    if (filterStatus === "started") rows = rows.filter((r) => r.completed_at === null);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((r) => responseSearchText(r).toLowerCase().includes(q));
    }
    return rows.map((r) => {
      const form = formsById.get(r.form_id);
      const formAppearance = resolveFormAppearance({
        id: r.form_id,
        icon: form?.icon ?? null,
        icon_color: form?.icon_color ?? null,
      });
      const who = r.respondent_name ?? "Anonymous";
      // completed_at is the true submission signal; submitted_at is the row's
      // creation time (NOT NULL DEFAULT now()) and only marks when we received it.
      const isComplete = r.completed_at !== null;
      return {
        id: r.id,
        doc: r.form_name,
        glyph: <FormGlyph appearance={formAppearance} size={14} />,
        glyphTone: { bg: formAppearance.bg, fg: formAppearance.fg },
        who,
        whoColor: avatarColor(who),
        context: { label: r.property_name ?? "Not attached", muted: r.property_name === null },
        status: isComplete
          ? { label: "Submitted", tone: "complete" as const }
          : { label: "Started", tone: "draft" as const },
        sent: fmtShortDate(r.submitted_at),
        seen: null,
        last: r.completed_at ? fmtShortDate(r.completed_at) : "Not submitted",
        onOpen: () => setPreviewResponse(r),
      };
    });
  }, [
    responses,
    filterFormId,
    filterPropertyId,
    filterPerson,
    filterStatus,
    search,
    formsById,
  ]);

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
    if (!canDeleteForm(target)) {
      setError("Forms with responses cannot be deleted. Archive the form instead.");
      return;
    }
    setError(null);
    setBusyId(target.id);
    setOptimisticDeletedIds((prev) => {
      const next = new Set(prev);
      next.add(target.id);
      return next;
    });
    startTransition(async () => {
      try {
        const res = await deleteFormAction(target.id);
        if (!res.ok) {
          setOptimisticDeletedIds((prev) => {
            const next = new Set(prev);
            next.delete(target.id);
            return next;
          });
          setError("error" in res && res.error ? res.error : "Delete failed.");
          return;
        }
        router.refresh();
      } finally {
        setBusyId(null);
      }
    });
  }

  function requestDelete(form: FormListItem) {
    if (!canDeleteForm(form)) {
      setError("Forms with responses cannot be deleted. Archive the form instead.");
      return;
    }
    setDeleteTarget(form);
  }

  const activityFilters = (
    <ActivityFilters
      search={search}
      onSearch={setSearch}
      searchPlaceholder="Search names, forms, answers, properties"
      searchAriaLabel="Search responses"
      facets={[
        { key: "form", placeholder: "All forms", value: filterFormId, onChange: setFilterFormId, options: formFilterOptions },
        { key: "property", placeholder: "All properties", value: filterPropertyId, onChange: setFilterPropertyId, options: propertyFilterOptions },
        { key: "person", placeholder: "All people", value: filterPerson, onChange: setFilterPerson, options: personFilterOptions },
        { key: "status", placeholder: "All statuses", value: filterStatus, onChange: setFilterStatus, options: RESPONSE_STATUS_OPTIONS },
      ]}
    />
  );

  const formsControls = (
    <div className={styles.libraryControls}>
      {tab !== "archive" ? (
        <FilterMenu
          label="Status"
          value={formStatusFilter}
          options={FORM_STATUS_OPTIONS}
          onChange={setFormStatusFilter}
          compact
        />
      ) : null}
      <FilterMenu
        label="Updated"
        value={updatedFilter}
        options={LAST_UPDATED_OPTIONS}
        onChange={setUpdatedFilter}
      />
      <span className={styles.controlDivider} aria-hidden />
      <ViewToggle view={view} onView={setView} />
    </div>
  );

  function renderEmptyState(
    title: string,
    body: string,
    includeLibrarySuggestions: boolean,
  ) {
    return (
      <div className={styles.emptyState}>
        <FileDashed size={40} weight="duotone" />
        <p className={styles.emptyTitle}>{title}</p>
        <p className={styles.emptyBody}>{body}</p>
        {includeLibrarySuggestions && library.length > 0 ? (
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
        ) : null}
      </div>
    );
  }

  function renderFormCollection(items: FormListItem[], mode: FormCollectionMode) {
    const isArchive = mode === "archive";
    const total = isArchive ? archived.length : active.length;

    if (items.length === 0) {
      if (isArchive && total === 0) {
        return renderEmptyState(
          "No archived forms",
          "Archived forms will appear here when you need to retain response history without keeping a form active.",
          false,
        );
      }
      if (!isArchive && total === 0) {
        return renderEmptyState(
          "No forms yet",
          "Use the New form button to build your first form. Add questions, then share a link or send it out.",
          true,
        );
      }
      return renderEmptyState(
        isArchive ? "No archived forms match these filters" : "No forms match these filters",
        "Adjust the toolbar filters to see more forms.",
        false,
      );
    }

    if (view === "cards") {
      return (
        <div className={styles.libGrid}>
          {items.map((form) => (
            <FormCardItem
              key={form.id}
              form={form}
              archived={isArchive}
              busy={busyId === form.id}
              onSend={() => setSendTarget(toUnifiedTemplate(form))}
              onDuplicate={() => handleDuplicate(form)}
              onArchive={() =>
                runRowAction(form.id, () => archiveFormAction(form.id), "Archive failed.")
              }
              onRestore={() =>
                runRowAction(form.id, () => unarchiveFormAction(form.id), "Restore failed.")
              }
              onDeleteRequest={() => requestDelete(form)}
            />
          ))}
        </div>
      );
    }

    return (
      <div className={styles.tableWrap}>
        <div className={styles.headerRow} aria-hidden>
          <span />
          <span className={styles.headerCell}>Name</span>
          <span className={`${styles.headerCell} ${styles.statusCell}`}>Status</span>
          <span className={`${styles.headerCell} ${styles.responseCell}`}>Responses</span>
          <span className={`${styles.headerCell} ${styles.dateCell}`}>
            {isArchive ? "Archived" : "Created"}
          </span>
          <span className={`${styles.headerCell} ${styles.dateCell}`}>Updated</span>
          <span />
        </div>
        <div className={styles.list} role="list">
          {items.map((form) => (
            <FormRow
              key={form.id}
              form={form}
              archived={isArchive}
              busy={busyId === form.id}
              onSend={() => setSendTarget(toUnifiedTemplate(form))}
              onDuplicate={() => handleDuplicate(form)}
              onArchive={() =>
                runRowAction(form.id, () => archiveFormAction(form.id), "Archive failed.")
              }
              onRestore={() =>
                runRowAction(form.id, () => unarchiveFormAction(form.id), "Restore failed.")
              }
              onDeleteRequest={() => requestDelete(form)}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <HubSubTabs
        tab={tab}
        onTab={setTab}
        libraryLabel="forms"
        libraryTabLabel="Forms"
        libraryCount={active.length}
        activityLabel="Responses"
        activityCount={responses.length}
        archiveLabel="Archived"
        archiveCount={archived.length}
        right={tab === "activity" ? activityFilters : formsControls}
      />

      {error && (
        <div className={styles.errorBanner} role="alert">
          <Warning size={15} weight="duotone" />
          {error}
        </div>
      )}

      {tab === "library" && renderFormCollection(filteredActive, "active")}
      {tab === "archive" && renderFormCollection(filteredArchived, "archive")}

      {/* ── Activity tab ─────────────────────────────────────────── */}
      {tab === "activity" && (
        <ActivityTable
          rows={activityRows}
          hideSeen
          contextLabel="Property"
          sentLabel="Received"
          lastLabel="Submitted"
          emptyText={
            search || filterFormId || filterPropertyId || filterPerson || filterStatus
              ? "No responses match your filters."
              : "No form responses yet."
          }
        />
      )}

      <AnimatePresence>
        {previewResponse ? (
          <ResponsePreviewDrawer
            key={previewResponse.id}
            response={previewResponse}
            form={formsById.get(previewResponse.form_id)}
            onClose={() => setPreviewResponse(null)}
            onOpenForm={() =>
              router.push(`/admin/paperwork/templates/${previewResponse.form_id}?tab=responses`)
            }
          />
        ) : null}
      </AnimatePresence>

      {/* ── SendSheet ─────────────────────────────────────────────── */}
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
            ? `"${deleteTarget.name}" has no responses, so it can be deleted completely. This is irreversible and cannot be undone.`
            : ""
        }
        confirmLabel="Delete completely"
        cancelLabel="Keep form"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
