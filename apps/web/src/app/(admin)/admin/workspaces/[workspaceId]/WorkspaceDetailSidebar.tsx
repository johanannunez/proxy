"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useTransition,
  type KeyboardEvent,
  type ChangeEvent,
  type ReactNode,
} from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowSquareOut,
  Briefcase,
  CalendarBlank,
  ChatCircle,
  LinkedinLogo,
  InstagramLogo,
  FacebookLogo,
  XLogo,
  EnvelopeSimple,
  Globe,
  IdentificationCard,
  PencilSimple,
  Phone,
  UserCircle,
  X as XIcon,
  CheckCircle,
  XCircle,
  CopySimple,
  Check,
} from "@phosphor-icons/react";
import { parsePhoneNumber } from "libphonenumber-js";
import type { WorkspaceContactDetail, AddressComponents, WorkspaceInfo, WorkspaceMember, SocialLinks } from "@/lib/admin/workspace-contact-detail";
import { useRouter, useSearchParams } from "next/navigation";
import type { AdminProfile } from "./workspace-person-actions";
import { updateWorkspaceContactFields, updateEmailWithPortalSync } from "./workspace-person-actions";
import { DatePickerInput } from "@/components/admin/DatePickerInput";
import styles from "./WorkspaceDetailSidebar.module.css";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatPhone(raw: string | null): string {
  if (!raw) return "";
  try {
    const parsed = parsePhoneNumber(raw, "US");
    if (parsed?.isValid()) return parsed.formatNational();
  } catch {
    // fall through
  }
  return raw;
}

function isoToDateInput(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function dateInputToIso(val: string): string | null {
  if (!val) return null;
  return new Date(val + "T00:00:00").toISOString();
}

// ---------------------------------------------------------------------------
// Saved badge
// ---------------------------------------------------------------------------

function SavedBadge({ visible }: { visible: boolean }) {
  return (
    <span className={`${styles.savedBadge} ${visible ? styles.savedBadgeVisible : ""}`}>
      <Check size={8} weight="bold" />
      saved
    </span>
  );
}

// ---------------------------------------------------------------------------
// Inline editable field
// ---------------------------------------------------------------------------

type EditableFieldProps = {
  label: string;
  value: string;
  displayValue?: string;
  placeholder?: string;
  type?: "text" | "email" | "tel" | "number";
  min?: number;
  max?: number;
  copyValue?: string;
  externalCopied?: boolean;
  onChange?: (val: string) => void;
  onEditStart?: () => void;
  onEditEnd?: () => void;
  onCopied?: () => void;
  isSaved?: boolean;
  onSave: (val: string) => Promise<void>;
};

function EditableField({
  label,
  value,
  displayValue,
  placeholder,
  type = "text",
  min,
  max,
  copyValue,
  externalCopied,
  onChange: onChangeProp,
  onEditStart,
  onEditEnd,
  onCopied: onCopiedProp,
  isSaved,
  onSave,
}: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [rowCopied, setRowCopied] = useState(false);
  const rowCopiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const committingRef = useRef(false);

  const handleRowCopied = useCallback(() => {
    if (rowCopiedTimerRef.current) clearTimeout(rowCopiedTimerRef.current);
    setRowCopied(true);
    onCopiedProp?.();
    rowCopiedTimerRef.current = setTimeout(() => setRowCopied(false), 900);
  }, [onCopiedProp]);

  useEffect(() => {
    if (editing) {
      setDraft(value);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing, value]);

  const commit = useCallback(async () => {
    if (committingRef.current) return;
    committingRef.current = true;
    try {
      const trimmed = draft.trim();
      if (trimmed === value) {
        setEditing(false);
        onEditEnd?.();
        return;
      }
      if (type === "email" && trimmed && !trimmed.includes("@")) {
        setDraft(value);
        setEditing(false);
        onEditEnd?.();
        return;
      }
      if (type === "number" && trimmed !== "") {
        const num = parseFloat(trimmed);
        if (isNaN(num) || (min !== undefined && num < min) || (max !== undefined && num > max)) {
          setDraft(value);
          setEditing(false);
          onEditEnd?.();
          return;
        }
      }
      setSaving(true);
      await onSave(trimmed);
      setSaving(false);
      setEditing(false);
      onEditEnd?.();
    } finally {
      committingRef.current = false;
    }
  }, [draft, value, type, min, max, onSave, onEditEnd]);

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    if (e.key === "Escape") {
      setDraft(value);
      setEditing(false);
      onEditEnd?.();
    }
  };

  const shown = displayValue ?? value;
  const isFlashing = rowCopied || !!externalCopied;

  return (
    <div className={styles.fieldRow}>
      <span className={styles.fieldLabel}>
        {label}
        <SavedBadge visible={!!isSaved} />
      </span>
      <div className={styles.fieldValue}>
        {editing ? (
          <input
            ref={inputRef}
            className={`${styles.inlineInput} ${saving ? styles.inlineInputSaving : ""}`}
            type={type}
            value={draft}
            min={min}
            max={max}
            placeholder={placeholder}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              setDraft(e.target.value);
              onChangeProp?.(e.target.value);
            }}
            onBlur={commit}
            onKeyDown={handleKey}
            disabled={saving}
          />
        ) : (
          <>
            <span className={`${styles.fieldValueContent} ${isFlashing ? styles.fieldValueCopied : ""}`}>
              <button
                className={`${styles.valueBtn} ${!shown ? styles.valueBtnEmpty : ""}`}
                onClick={() => { setEditing(true); onEditStart?.(); }}
                type="button"
              >
                {shown || placeholder || "Not set"}
              </button>
            </span>
            {copyValue && shown && <SidebarCopyBtn value={copyValue} onCopied={handleRowCopied} />}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Side-by-side editable field pair
// ---------------------------------------------------------------------------

function EditableFieldPair({
  labelA,
  valueA,
  placeholderA,
  labelB,
  valueB,
  placeholderB,
  copyFullValue,
  onSaveA,
  onSaveB,
  onChangeA,
  onChangeB,
  onEditStartA,
  onEditEndA,
  onEditStartB,
  onEditEndB,
  isSavedA,
  isSavedB,
}: {
  labelA: string;
  valueA: string;
  placeholderA?: string;
  labelB: string;
  valueB: string;
  placeholderB?: string;
  copyFullValue?: string;
  onSaveA: (val: string) => Promise<void>;
  onSaveB: (val: string) => Promise<void>;
  onChangeA?: (val: string) => void;
  onChangeB?: (val: string) => void;
  onEditStartA?: () => void;
  onEditEndA?: () => void;
  onEditStartB?: () => void;
  onEditEndB?: () => void;
  isSavedA?: boolean;
  isSavedB?: boolean;
}) {
  const [pairCopied, setPairCopied] = useState(false);
  const pairCopiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePairCopied = useCallback(() => {
    if (pairCopiedTimerRef.current) clearTimeout(pairCopiedTimerRef.current);
    setPairCopied(true);
    pairCopiedTimerRef.current = setTimeout(() => setPairCopied(false), 900);
  }, []);

  return (
    <div className={styles.fieldRowPair}>
      <div className={styles.fieldPairItem}>
        <EditableField
          label={labelA}
          value={valueA}
          placeholder={placeholderA}
          externalCopied={pairCopied}
          onSave={onSaveA}
          onChange={onChangeA}
          onEditStart={onEditStartA}
          onEditEnd={onEditEndA}
          isSaved={isSavedA}
        />
      </div>
      <div className={styles.fieldPairItem}>
        <EditableField
          label={labelB}
          value={valueB}
          placeholder={placeholderB}
          copyValue={copyFullValue}
          externalCopied={pairCopied}
          onCopied={handlePairCopied}
          onSave={onSaveB}
          onChange={onChangeB}
          onEditStart={onEditStartB}
          onEditEnd={onEditEndB}
          isSaved={isSavedB}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Date field pair
// ---------------------------------------------------------------------------

function DateFieldPair({
  labelA,
  isoA,
  labelB,
  isoB,
  onSaveA,
  onSaveB,
  isSavedA,
  isSavedB,
}: {
  labelA: string;
  isoA: string | null;
  labelB: string;
  isoB: string | null;
  onSaveA: (iso: string | null) => Promise<void>;
  onSaveB: (iso: string | null) => Promise<void>;
  isSavedA?: boolean;
  isSavedB?: boolean;
}) {
  const [draftA, setDraftA] = useState(isoToDateInput(isoA));
  const [draftB, setDraftB] = useState(isoToDateInput(isoB));
  const [, startTransition] = useTransition();

  const saveA = (value: string) => {
    setDraftA(value);
    const newIso = dateInputToIso(value);
    if (newIso !== isoA) {
      startTransition(async () => { await onSaveA(newIso); });
    }
  };

  const saveB = (value: string) => {
    setDraftB(value);
    const newIso = dateInputToIso(value);
    if (newIso !== isoB) {
      startTransition(async () => { await onSaveB(newIso); });
    }
  };

  return (
    <div className={styles.fieldRowPair}>
      <div className={styles.fieldPairItem}>
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>
            {labelA}
            <SavedBadge visible={!!isSavedA} />
          </span>
          <div className={styles.fieldValue}>
            <div className={styles.dateInputWrapper}>
              <DatePickerInput
                value={draftA}
                onChange={saveA}
                placeholder="Set date"
                className={styles.dateInput}
              />
            </div>
          </div>
        </div>
      </div>
      <div className={styles.fieldPairItem}>
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>
            {labelB}
            <SavedBadge visible={!!isSavedB} />
          </span>
          <div className={styles.fieldValue}>
            <div className={styles.dateInputWrapper}>
              <DatePickerInput
                value={draftB}
                onChange={saveB}
                placeholder="Set date"
                className={styles.dateInput}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Address field with Google Places autocomplete
// ---------------------------------------------------------------------------

type PlacePrediction = {
  place_id: string;
  description: string;
};

function formatAddressLines(
  formatted: string | null,
  components: AddressComponents | null
): [string, string] | null {
  if (!formatted) return null;
  if (components && (components.street_number || components.route)) {
    const street = [components.street_number, components.route].filter(Boolean).join(" ");
    const parts = [
      components.locality,
      components.administrative_area_level_1,
      components.postal_code,
      components.country,
    ].filter(Boolean);
    const cityLine = parts.join(", ");
    return [street, cityLine];
  }
  // fallback: split on first comma
  const idx = formatted.indexOf(",");
  if (idx > -1) return [formatted.slice(0, idx).trim(), formatted.slice(idx + 1).trim()];
  return [formatted, ""];
}

const BUSINESS_ENTITY_TYPE_LABELS: Record<string, string> = {
  individual: 'Individual',
  llc: 'LLC',
  s_corp: 'S Corp',
  c_corp: 'C Corp',
  trust: 'Trust',
  partnership: 'Partnership',
};

function AddressField({
  value,
  components,
  isSaved,
  onSave,
}: {
  value: string | null;
  components: AddressComponents | null;
  isSaved?: boolean;
  onSave: (formatted: string, components: AddressComponents) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState(value ?? "");
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [rowCopied, setRowCopied] = useState(false);
  const rowCopiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleRowCopied = () => {
    if (rowCopiedTimerRef.current) clearTimeout(rowCopiedTimerRef.current);
    setRowCopied(true);
    rowCopiedTimerRef.current = setTimeout(() => setRowCopied(false), 900);
  };

  useEffect(() => {
    if (editing) {
      setQuery(value ?? "");
      setPredictions([]);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing, value]);

  // Close on outside click
  useEffect(() => {
    if (!editing) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setEditing(false);
        setQuery(value ?? "");
        setPredictions([]);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [editing, value]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) { setPredictions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(q)}`);
        const json = await res.json() as { predictions?: PlacePrediction[] };
        setPredictions(json.predictions ?? []);
      } catch {
        setPredictions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const selectPrediction = async (pred: PlacePrediction) => {
    setPredictions([]);
    setQuery(pred.description);
    try {
      const res = await fetch(`/api/places/details?place_id=${encodeURIComponent(pred.place_id)}`);
      const json = await res.json() as {
        result?: {
          formatted_address?: string;
          address_components?: Array<{ types: string[]; long_name: string; short_name: string }>;
        };
      };
      if (json.result) {
        const formatted = json.result.formatted_address ?? pred.description;
        const components: AddressComponents = {};
        for (const c of json.result.address_components ?? []) {
          if (c.types.includes("street_number")) components.street_number = c.long_name;
          if (c.types.includes("route")) components.route = c.long_name;
          if (c.types.includes("locality")) components.locality = c.long_name;
          if (c.types.includes("administrative_area_level_1")) components.administrative_area_level_1 = c.short_name;
          if (c.types.includes("postal_code")) components.postal_code = c.long_name;
          if (c.types.includes("country")) components.country = c.short_name;
        }
        await onSave(formatted, components);
        setQuery(formatted);
      }
    } catch {
      // keep whatever was typed
    }
    setEditing(false);
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setEditing(false);
      setQuery(value ?? "");
      setPredictions([]);
    }
  };

  return (
    <div className={styles.fieldRow} ref={containerRef}>
      <span className={styles.fieldLabel}>
        Mailing
        <SavedBadge visible={!!isSaved} />
      </span>
      <div className={`${styles.fieldValue} ${styles.fieldValueAddress}`}>
        {editing ? (
          <div className={styles.addressInputWrap}>
            <input
              ref={inputRef}
              className={styles.inlineInput}
              type="text"
              value={query}
              onChange={handleChange}
              onKeyDown={handleKey}
              placeholder="Owner's mailing address…"
              autoComplete="off"
            />
            {(predictions.length > 0 || loading) && (
              <div className={styles.predictionDropdown}>
                {loading && predictions.length === 0 && (
                  <div className={styles.predictionLoading}>Searching…</div>
                )}
                {predictions.map((p) => (
                  <button
                    key={p.place_id}
                    type="button"
                    className={styles.predictionItem}
                    onMouseDown={() => selectPrediction(p)}
                  >
                    {p.description}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (() => {
          const lines = formatAddressLines(value, components);
          return (
            <>
              <span className={`${styles.fieldValueContent} ${rowCopied ? styles.fieldValueCopied : ""}`}>
                <button
                  className={`${styles.valueBtn} ${!value ? styles.valueBtnEmpty : ""} ${styles.valueBtnAddress}`}
                  onClick={() => setEditing(true)}
                  type="button"
                >
                  {lines ? (
                    <>
                      <span>{lines[0]}</span>
                      {lines[1] && <span>{lines[1]}</span>}
                    </>
                  ) : "Not set"}
                </button>
              </span>
              {value && <SidebarCopyBtn value={value} onCopied={handleRowCopied} />}
            </>
          );
        })()}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Social icons row
// ---------------------------------------------------------------------------

type SocialKey = keyof SocialLinks;

const SOCIAL_FIELDS: Array<{
  key: SocialKey;
  label: string;
  placeholder: string;
  Icon: React.ElementType;
  color: string;
}> = [
  { key: 'linkedin',  label: 'LinkedIn',  placeholder: 'https://linkedin.com/in/…', Icon: LinkedinLogo,  color: '#0077b5' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/…',   Icon: InstagramLogo, color: '#e1306c' },
  { key: 'x',         label: 'X',         placeholder: 'https://x.com/…',            Icon: XLogo,         color: '#000000' },
  { key: 'facebook',  label: 'Facebook',  placeholder: 'https://facebook.com/…',    Icon: FacebookLogo,  color: '#1877f2' },
  { key: 'website',   label: 'Website',   placeholder: 'https://…',                 Icon: Globe,         color: 'var(--color-brand)' },
];

// ---------------------------------------------------------------------------
// Social links (icon row + modal)
// ---------------------------------------------------------------------------

function SocialIconRow({
  social,
  onOpenModal,
}: {
  social: SocialLinks;
  onOpenModal: () => void;
}) {
  return (
    <div className={styles.socialIconRow}>
      {SOCIAL_FIELDS.map(({ key, label, Icon, color }) => {
        const hasValue = !!(social[key]);
        return (
          <button
            key={key}
            type="button"
            title={label}
            className={styles.socialIconBtn}
            style={hasValue ? { color } : undefined}
            onClick={onOpenModal}
            aria-label={`${label}${hasValue ? ': set' : ': not set'}`}
          >
            <Icon size={16} weight={hasValue ? 'fill' : 'regular'} />
          </button>
        );
      })}
    </div>
  );
}

function SocialLinksModal({
  social,
  onSave,
  onClose,
}: {
  social: SocialLinks;
  onSave: (updated: SocialLinks) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<SocialLinks>({ ...(social ?? {}) });
  const [saving, setSaving] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = modalRef.current;
    if (!el) return;
    const focusableSelector =
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const getFocusable = () => Array.from(el.querySelectorAll<HTMLElement>(focusableSelector));
    getFocusable()[0]?.focus();

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = getFocusable();
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.socialModalOverlay} onClick={onClose}>
      <div
        ref={modalRef}
        className={styles.socialModal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Social links"
      >
        <div className={styles.socialModalHeader}>
          <span className={styles.socialModalTitle}>Social Links</span>
          <button type="button" className={styles.socialModalClose} onClick={onClose} aria-label="Close">
            <XIcon size={16} />
          </button>
        </div>
        <div className={styles.socialModalFields}>
          {SOCIAL_FIELDS.map(({ key, label, placeholder, Icon, color }) => (
            <div key={key} className={styles.socialModalField}>
              <label className={styles.socialModalFieldLabel}>
                <Icon size={13} style={{ color: draft[key] ? color : 'var(--color-text-tertiary)' }} />
                {label}
              </label>
              <input
                type="url"
                className={styles.socialModalInput}
                placeholder={placeholder}
                value={draft[key] ?? ''}
                onChange={(e) => setDraft((prev) => ({ ...prev, [key]: e.target.value || null }))}
              />
            </div>
          ))}
        </div>
        <div className={styles.socialModalFooter}>
          <button type="button" className={styles.socialModalCancel} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.socialModalSave}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Assigned-to dropdown
// ---------------------------------------------------------------------------

function AssignedField({
  value,
  profiles,
  isSaved,
  onSave,
}: {
  value: string | null;
  profiles: AdminProfile[];
  isSaved?: boolean;
  onSave: (id: string | null) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [, startTransition] = useTransition();

  const current = profiles.find((p) => p.id === value);

  const select = (id: string | null) => {
    setEditing(false);
    if (id !== value) {
      startTransition(async () => { await onSave(id); });
    }
  };

  return (
    <div className={styles.fieldRow}>
      <span className={styles.fieldLabel}>
        Assigned
        <SavedBadge visible={!!isSaved} />
      </span>
      <div className={styles.fieldValue}>
        {editing ? (
          <div className={styles.assignedDropdown}>
            <button
              type="button"
              className={`${styles.assignedOption} ${!value ? styles.assignedOptionActive : ""}`}
              onMouseDown={() => select(null)}
            >
              Unassigned
            </button>
            {profiles.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`${styles.assignedOption} ${p.id === value ? styles.assignedOptionActive : ""}`}
                onMouseDown={() => select(p.id)}
              >
                {p.fullName}
              </button>
            ))}
          </div>
        ) : (
          <button
            className={`${styles.valueBtn} ${!current ? styles.valueBtnEmpty : ""}`}
            onClick={() => setEditing(true)}
            type="button"
          >
            {current?.fullName ?? "Unassigned"}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preferred contact method toggle
// ---------------------------------------------------------------------------

type ContactMethod = "email" | "phone" | "text" | "whatsapp";

const CONTACT_METHODS: { key: ContactMethod; label: string }[] = [
  { key: "email",    label: "Email"    },
  { key: "phone",    label: "Phone"    },
  { key: "text",     label: "SMS"      },
  { key: "whatsapp", label: "WhatsApp" },
];

const CONTACT_METHOD_LABELS = new Map(CONTACT_METHODS.map((method) => [method.key, method.label]));

type DrawerMode = "summary" | "edit";
type SummaryCopyTarget = "email" | "phone";

function displayValue(value: string | null | undefined, fallback = "Not set"): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function formatSummaryDate(iso: string | null): string {
  if (!iso) return "Not set";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function SummaryDetail({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className={styles.summaryDetail}>
      <span className={styles.summaryDetailIcon}>{icon}</span>
      <span className={styles.summaryDetailText}>
        <span className={styles.summaryDetailLabel}>{label}</span>
        <span className={value === "Not set" ? styles.summaryDetailMuted : styles.summaryDetailValue}>
          {value}
        </span>
      </span>
    </div>
  );
}

function SummaryAction({
  icon,
  label,
  disabled = false,
  href,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  disabled?: boolean;
  href?: string;
  onClick?: () => void;
}) {
  if (href && !disabled) {
    return (
      <a className={styles.summaryAction} href={href}>
        {icon}
        <span>{label}</span>
      </a>
    );
  }

  return (
    <button
      type="button"
      className={styles.summaryAction}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Copy button (sidebar)
// ---------------------------------------------------------------------------

function SidebarCopyBtn({ value, onCopied }: { value: string; onCopied?: () => void }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      onCopied?.();
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API may fail silently
    }
  };
  return (
    <button
      type="button"
      className={`${styles.copyBtn} ${copied ? styles.copyBtnCopied : ""}`}
      onClick={handleCopy}
      aria-label={`Copy ${value}`}
      title={copied ? "Copied!" : "Copy"}
    >
      <CopySimple size={13} weight="bold" />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Email field with verified / unverified badge + inline confirm step
// ---------------------------------------------------------------------------

type EmailFieldState = "display" | "editing" | "confirming" | "sending";

function EmailField({
  email,
  emailVerified,
  profileId,
  onSaveDirect,
  onSaveWithPortal,
  isSaved,
}: {
  email: string;
  emailVerified: boolean;
  profileId: string | null;
  onSaveDirect: (val: string) => Promise<void>;
  onSaveWithPortal: (val: string) => Promise<{ ok: boolean; message: string }>;
  isSaved?: boolean;
}) {
  const [fieldState, setFieldState] = useState<EmailFieldState>("display");
  const [draft, setDraft] = useState(email);
  const [rowCopied, setRowCopied] = useState(false);
  const rowCopiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const committingRef = useRef(false);

  const handleRowCopied = useCallback(() => {
    if (rowCopiedTimerRef.current) clearTimeout(rowCopiedTimerRef.current);
    setRowCopied(true);
    rowCopiedTimerRef.current = setTimeout(() => setRowCopied(false), 900);
  }, []);

  useEffect(() => {
    if (fieldState === "editing") {
      setDraft(email);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [fieldState, email]);

  const handleCommit = useCallback(async () => {
    if (committingRef.current) return;
    const trimmed = draft.trim();
    if (!trimmed || trimmed === email) {
      setFieldState("display");
      return;
    }
    if (!trimmed.includes("@")) {
      setDraft(email);
      setFieldState("display");
      return;
    }
    // Portal account: need the confirm step before changing login credential
    if (profileId) {
      setFieldState("confirming");
      return;
    }
    committingRef.current = true;
    try {
      await onSaveDirect(trimmed);
      setFieldState("display");
    } finally {
      committingRef.current = false;
    }
  }, [draft, email, profileId, onSaveDirect]);

  const handleSend = useCallback(async () => {
    setFieldState("sending");
    await onSaveWithPortal(draft.trim());
    setFieldState("display");
  }, [draft, onSaveWithPortal]);

  const shown = email || "";

  return (
    <div className={styles.fieldRow}>
      <span className={styles.fieldLabel}>
        Email
        <SavedBadge visible={!!isSaved} />
      </span>
      <div className={styles.fieldValue}>
        {fieldState === "editing" ? (
          <input
            ref={inputRef}
            className={styles.inlineInput}
            type="email"
            value={draft}
            placeholder="email@example.com"
            onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft(e.target.value)}
            onBlur={handleCommit}
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
              if (e.key === "Enter") { e.preventDefault(); handleCommit(); }
              if (e.key === "Escape") { setDraft(email); setFieldState("display"); }
            }}
          />
        ) : fieldState === "confirming" || fieldState === "sending" ? (
          <div className={styles.emailConfirmRow}>
            <p className={styles.emailConfirmText}>
              Send login link to <strong>{draft}</strong>?
            </p>
            <div className={styles.emailConfirmActions}>
              <button
                type="button"
                className={styles.emailConfirmSendBtn}
                onClick={handleSend}
                disabled={fieldState === "sending"}
              >
                {fieldState === "sending" ? "Sending…" : "Send"}
              </button>
              <button
                type="button"
                className={styles.emailConfirmCancelBtn}
                onClick={() => setFieldState("display")}
                disabled={fieldState === "sending"}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <span className={[
              styles.fieldValueContent,
              rowCopied ? styles.fieldValueCopied : "",
              profileId && !emailVerified ? styles.fieldValueContentUnverified : "",
            ].filter(Boolean).join(" ")}>
              <button
                className={`${styles.valueBtn} ${!shown ? styles.valueBtnEmpty : ""}`}
                onClick={() => setFieldState("editing")}
                type="button"
              >
                {shown || "email@example.com"}
              </button>
            </span>
            {shown && <SidebarCopyBtn value={shown} onCopied={handleRowCopied} />}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section divider
// ---------------------------------------------------------------------------

function SectionHeader({ label }: { label: string }) {
  return <div className={styles.sectionHeader}>{label}</div>;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function WorkspaceDetailSidebar({
  workspaceContact,
  adminProfiles,
  workspaceInfo,
  members,
  activeContactId,
  onNameChange,
  onNameEditStart,
  onNameEditEnd,
}: {
  workspaceContact: WorkspaceContactDetail;
  adminProfiles: AdminProfile[];
  workspaceInfo: WorkspaceInfo;
  members: WorkspaceMember[];
  activeContactId: string;
  onNameChange?: (first: string, last: string) => void;
  onNameEditStart?: (part: "first" | "last") => void;
  onNameEditEnd?: () => void;
}) {
  // Local optimistic copies of mutable fields
  const [firstName,   setFirstName]   = useState(workspaceContact.firstName   ?? "");
  const [lastName,    setLastName]     = useState(workspaceContact.lastName    ?? "");
  const [email,       setEmail]        = useState(workspaceContact.email       ?? "");
  const [emailVerified, setEmailVerified] = useState(workspaceContact.emailVerified);
  const [phone,       setPhone]        = useState(workspaceContact.phone       ?? "");
  const source = workspaceContact.source ?? "";
  const [addressFmt,  setAddressFmt]   = useState(workspaceContact.addressFormatted ?? null);
  const [social,      setSocial]       = useState<SocialLinks>(workspaceContact.social ?? {});
  const [assignedTo,  setAssignedTo]   = useState(workspaceContact.assignedTo);
  const [contactMethod, setContactMethod] = useState(workspaceContact.preferredContactMethod);
  const [contractStart, setContractStart] = useState(workspaceContact.contractStartAt);
  const [contractEnd,   setContractEnd]   = useState(workspaceContact.contractEndAt);
  const [feePercent,    setFeePercent]    = useState(
    workspaceContact.managementFeePercent !== null ? String(workspaceContact.managementFeePercent) : ""
  );
  const [socialModalOpen, setSocialModalOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("summary");
  const [summaryCopied, setSummaryCopied] = useState<SummaryCopyTarget | null>(null);

  // Saved-field tracker
  const [savedFields, setSavedFields] = useState<Set<string>>(new Set());

  const markSaved = useCallback((key: string) => {
    setSavedFields(prev => new Set(prev).add(key));
    setTimeout(() => {
      setSavedFields(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, 1800);
  }, []);

  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab") ?? "overview";
  const rawSection = searchParams.get("section");
  const rawDetail = searchParams.get("detail");

  const copySummaryValue = useCallback(async (target: SummaryCopyTarget, value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setSummaryCopied(target);
      setTimeout(() => setSummaryCopied(null), 1400);
    } catch {
      // clipboard API may fail silently
    }
  }, []);

  const activeMember = members.find((member) => member.id === activeContactId);
  const contactName = [firstName, lastName].filter(Boolean).join(" ").trim() || workspaceContact.fullName;
  const contactInitials = getInitials(contactName);
  const workspaceTypeLabel = workspaceInfo.type
    ? BUSINESS_ENTITY_TYPE_LABELS[workspaceInfo.type] ?? workspaceInfo.type
    : null;
  const assignedProfile = adminProfiles.find((profile) => profile.id === assignedTo);
  const assignedName = assignedProfile?.fullName || workspaceContact.assignedToName || "Unassigned";
  const preferredMethodLabel = contactMethod ? CONTACT_METHOD_LABELS.get(contactMethod) ?? contactMethod : "Not set";
  const roleLabel = activeMember?.roleLabel ?? "Owner";
  const sourceLabel = displayValue(source);
  const feeLabel = feePercent ? `${feePercent}%` : "Not set";

  const openSchedule = () => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("tab", "meetings");
    params.set("person", activeContactId);
    params.delete("detail");
    params.delete("section");
    router.replace(`/admin/workspaces/${workspaceInfo.id}?${params.toString()}`, { scroll: false });
  };

  async function save(fields: Parameters<typeof updateWorkspaceContactFields>[1]) {
    await updateWorkspaceContactFields(workspaceContact.id, fields);
  }

  // ── Contact saves ──────────────────────────────────────────────────────
  const saveFirstName = async (val: string) => {
    const capped = capitalize(val);
    setFirstName(capped);
    onNameChange?.(capped, lastName);
    await save({ firstName: capped, lastName });
    markSaved("firstName");
  };
  const saveLastName = async (val: string) => {
    const capped = capitalize(val);
    setLastName(capped);
    onNameChange?.(firstName, capped);
    await save({ firstName, lastName: capped });
    markSaved("lastName");
  };
  const saveEmailDirect = async (val: string) => {
    setEmail(val);
    await save({ email: val });
    markSaved("email");
  };
  const saveEmailWithPortal = async (val: string): Promise<{ ok: boolean; message: string }> => {
    const result = await updateEmailWithPortalSync(workspaceContact.id, val);
    if (result.ok) {
      setEmail(val);
      setEmailVerified(false);
      markSaved("email");
    }
    return result;
  };
  const savePhone = async (val: string) => {
    setPhone(val);
    await save({ phone: val });
    markSaved("phone");
  };
  const saveAddress = async (formatted: string, components: AddressComponents) => {
    setAddressFmt(formatted);
    await save({ addressFormatted: formatted, addressComponents: components });
    markSaved("address");
  };
  const saveSocial = async (updated: SocialLinks) => {
    setSocial(updated);
    await save({ social: updated });
    markSaved("social");
  };

  // ── Pipeline saves ──────────────────────────────────────────────────────
  const saveAssigned = async (id: string | null) => {
    setAssignedTo(id);
    await save({ assignedTo: id });
    markSaved("assigned");
  };

  // ── Contract saves ──────────────────────────────────────────────────────
  const saveContractStart = async (iso: string | null) => {
    setContractStart(iso);
    await save({ contractStartAt: iso });
    markSaved("contractStart");
  };
  const saveContractEnd = async (iso: string | null) => {
    setContractEnd(iso);
    await save({ contractEndAt: iso });
    markSaved("contractEnd");
  };
  const saveFeePercent = async (val: string) => {
    const num = val === "" ? null : parseFloat(val);
    setFeePercent(val);
    await save({ managementFeePercent: num });
    markSaved("feePercent");
  };

  // ── Owner saves ─────────────────────────────────────────────────────────
  const saveContactMethod = async (method: ContactMethod) => {
    const next = contactMethod === method ? null : method;
    setContactMethod(next);
    await save({ preferredContactMethod: next });
  };

  const hasPortal = workspaceContact.profileId !== null;

  return (
    <aside className={styles.sidebar}>

      {/* ── Person chips (multi-member only) ─────────────────────────────── */}
      {members.length > 1 && (
        <div className={styles.personChipsSection}>
          {members.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`${styles.sidebarChip} ${m.id === activeContactId ? styles.sidebarChipActive : ''}`}
              onClick={() => {
                const sectionSuffix = rawSection ? `&section=${rawSection}` : "";
                const detailSuffix = rawDetail ? `&detail=${rawDetail}` : "";
                router.replace(`?tab=${rawTab}&person=${m.id}${detailSuffix}${sectionSuffix}`, { scroll: false });
              }}
            >
              {m.avatarUrl ? (
                <Image
                  src={m.avatarUrl}
                  alt={m.fullName}
                  width={16}
                  height={16}
                  className={styles.sidebarChipAvatar}
                />
              ) : (
                <span className={styles.sidebarChipInitials}>
                  {(m.firstName ? m.firstName[0] : m.fullName[0] ?? '?').toUpperCase()}
                </span>
              )}
              <span>{m.firstName ?? m.fullName.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      )}

      <div className={styles.profileHeader}>
        {workspaceContact.avatarUrl ? (
          <Image
            src={workspaceContact.avatarUrl}
            alt={contactName}
            width={56}
            height={56}
            className={styles.profileAvatarImage}
          />
        ) : (
          <span className={styles.profileAvatar}>{contactInitials}</span>
        )}
        <div className={styles.profileIdentity}>
          <span className={styles.profileName}>{contactName}</span>
          <span className={styles.profileRole}>{roleLabel}</span>
          <span className={styles.profileWorkspace}>
            {workspaceInfo.name}
            {workspaceTypeLabel ? <span>{workspaceTypeLabel}</span> : null}
          </span>
        </div>
      </div>

      <div className={styles.profileMetaGrid}>
        <div className={styles.profileMetaItem}>
          <span>Portal</span>
          <strong className={hasPortal ? styles.profileMetaGood : styles.profileMetaMuted}>
            {hasPortal ? "Has access" : "No access"}
          </strong>
        </div>
        <div className={styles.profileMetaItem}>
          <span>Assigned</span>
          <strong>{assignedName}</strong>
        </div>
        <div className={styles.profileMetaItem}>
          <span>Prefers</span>
          <strong>{preferredMethodLabel}</strong>
        </div>
      </div>

      <div className={styles.modeSwitch} role="tablist" aria-label="Contact drawer view">
        <button
          type="button"
          role="tab"
          className={`${styles.modeButton} ${drawerMode === "summary" ? styles.modeButtonActive : ""}`}
          onClick={() => setDrawerMode("summary")}
          aria-selected={drawerMode === "summary"}
        >
          Summary
        </button>
        <button
          type="button"
          role="tab"
          className={`${styles.modeButton} ${drawerMode === "edit" ? styles.modeButtonActive : ""}`}
          onClick={() => setDrawerMode("edit")}
          aria-selected={drawerMode === "edit"}
          data-testid="contact-drawer-edit"
        >
          Edit
        </button>
      </div>

      {drawerMode === "summary" ? (
        <div className={styles.summaryPanel}>
          <div className={styles.summaryActionGrid} aria-label="Quick actions">
            <SummaryAction
              icon={<ChatCircle size={15} weight="bold" />}
              label="Message"
              href={email ? `mailto:${email}` : undefined}
              disabled={!email}
            />
            <SummaryAction
              icon={<CalendarBlank size={15} weight="bold" />}
              label="Schedule"
              onClick={openSchedule}
            />
            <SummaryAction
              icon={summaryCopied === "email" ? <Check size={15} weight="bold" /> : <CopySimple size={15} weight="bold" />}
              label={summaryCopied === "email" ? "Email copied" : "Copy email"}
              disabled={!email}
              onClick={() => copySummaryValue("email", email)}
            />
            <SummaryAction
              icon={summaryCopied === "phone" ? <Check size={15} weight="bold" /> : <CopySimple size={15} weight="bold" />}
              label={summaryCopied === "phone" ? "Phone copied" : "Copy phone"}
              disabled={!phone}
              onClick={() => copySummaryValue("phone", phone)}
            />
            <Link href={`/admin/people/${workspaceContact.id}`} className={styles.summaryAction}>
              <ArrowSquareOut size={15} weight="bold" />
              <span>Open full record</span>
            </Link>
          </div>

          <section className={styles.summarySection}>
            <div className={styles.summarySectionTitle}>Contact info</div>
            <div className={styles.summaryDetailGrid}>
              <SummaryDetail icon={<EnvelopeSimple size={15} weight="bold" />} label="Email" value={displayValue(email)} />
              <SummaryDetail icon={<Phone size={15} weight="bold" />} label="Phone" value={displayValue(formatPhone(phone))} />
              <SummaryDetail icon={<Globe size={15} weight="bold" />} label="Mailing" value={displayValue(addressFmt)} />
              <SummaryDetail icon={<IdentificationCard size={15} weight="bold" />} label="Role" value={roleLabel} />
            </div>
          </section>

          <section className={styles.summarySection}>
            <div className={styles.summarySectionTitle}>Relationship</div>
            <div className={styles.summaryDetailGrid}>
              <SummaryDetail icon={<UserCircle size={15} weight="bold" />} label="Portal" value={hasPortal ? "Has access" : "No access"} />
              <SummaryDetail icon={<Briefcase size={15} weight="bold" />} label="Assigned" value={assignedName} />
              <SummaryDetail icon={<Globe size={15} weight="bold" />} label="Source" value={sourceLabel} />
              <SummaryDetail icon={<ChatCircle size={15} weight="bold" />} label="Preferred" value={preferredMethodLabel} />
            </div>
          </section>

          <section className={styles.summarySection}>
            <div className={styles.summarySectionTitle}>Contract</div>
            <div className={styles.summaryDetailGrid}>
              <SummaryDetail icon={<CalendarBlank size={15} weight="bold" />} label="Start" value={formatSummaryDate(contractStart)} />
              <SummaryDetail icon={<CalendarBlank size={15} weight="bold" />} label="End" value={formatSummaryDate(contractEnd)} />
              <SummaryDetail icon={<Briefcase size={15} weight="bold" />} label="Mgmt fee" value={feeLabel} />
            </div>
          </section>

          <section className={styles.summarySection}>
            <div className={styles.summarySectionTitle}>Admin notes</div>
            <p className={styles.summaryNote}>No private notes saved for this contact.</p>
          </section>

          <button type="button" className={styles.editDetailsButton} onClick={() => setDrawerMode("edit")}>
            <PencilSimple size={15} weight="bold" />
            Edit details
          </button>
        </div>
      ) : (
        <div className={styles.editPanel}>

      {/* ── Workspace section ────────────────────────────────────────────────── */}
      <div className={styles.workspaceSection}>
        <div className={styles.workspaceSectionRow}>
          <span className={styles.workspaceSectionName}>{workspaceInfo.name}</span>
          {workspaceInfo.type && (
            <span className={styles.workspaceSectionBadge}>
              {BUSINESS_ENTITY_TYPE_LABELS[workspaceInfo.type] ?? workspaceInfo.type}
            </span>
          )}
        </div>
      </div>
      <div className={styles.divider} />

      {/* ── Contact ─────────────────────────────────────────────────────── */}
      <SectionHeader label="Contact" />

      <EditableFieldPair
        labelA="First"
        valueA={firstName}
        placeholderA="First name"
        labelB="Last"
        valueB={lastName}
        placeholderB="Last name"
        copyFullValue={[firstName, lastName].filter(Boolean).join(" ") || undefined}
        onSaveA={saveFirstName}
        onSaveB={saveLastName}
        onChangeA={(val) => onNameChange?.(val, lastName)}
        onChangeB={(val) => onNameChange?.(firstName, val)}
        onEditStartA={() => onNameEditStart?.("first")}
        onEditEndA={onNameEditEnd}
        onEditStartB={() => onNameEditStart?.("last")}
        onEditEndB={onNameEditEnd}
        isSavedA={savedFields.has("firstName")}
        isSavedB={savedFields.has("lastName")}
      />

      <EmailField
        email={email}
        emailVerified={emailVerified}
        profileId={workspaceContact.profileId}
        onSaveDirect={saveEmailDirect}
        onSaveWithPortal={saveEmailWithPortal}
        isSaved={savedFields.has("email")}
      />

      <EditableField
        label="Phone"
        value={phone}
        displayValue={formatPhone(phone)}
        type="tel"
        placeholder="+1 (555) 000-0000"
        copyValue={phone || undefined}
        onSave={savePhone}
        isSaved={savedFields.has("phone")}
      />

      <AddressField
        value={addressFmt}
        components={workspaceContact.addressComponents}
        onSave={saveAddress}
        isSaved={savedFields.has("address")}
      />

      <div className={styles.fieldRow}>
        <span className={styles.fieldLabel}>
          Social
          <SavedBadge visible={savedFields.has("social")} />
        </span>
        <div className={styles.fieldValue}>
          <SocialIconRow social={social} onOpenModal={() => setSocialModalOpen(true)} />
        </div>
      </div>
      {socialModalOpen && (
        <SocialLinksModal
          social={social}
          onSave={saveSocial}
          onClose={() => setSocialModalOpen(false)}
        />
      )}

      {/* Prefers + Portal/Newsletter directly under contact, no "Owner" header */}
      <div className={styles.fieldRow}>
        <span className={styles.fieldLabel}>Prefers</span>
        <div className={styles.contactMethodRow}>
          {CONTACT_METHODS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-label={label}
              aria-pressed={contactMethod === key}
              className={`${styles.methodBtn} ${contactMethod === key ? styles.methodBtnActive : ""}`}
              onClick={() => saveContactMethod(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.fieldRow}>
        <span className={styles.fieldLabel}>Portal</span>
        <div className={styles.fieldValue}>
          <span className={`${styles.portalStatus} ${hasPortal ? styles.portalStatusActive : styles.portalStatusNone}`}>
            {hasPortal ? (
              <><CheckCircle size={13} weight="fill" /> Has access</>
            ) : (
              <><XCircle size={13} weight="regular" /> No access</>
            )}
          </span>
        </div>
      </div>

      <div className={styles.divider} />

      {/* ── Pipeline ────────────────────────────────────────────────────── */}
      <SectionHeader label="Pipeline" />

      <div className={styles.fieldRowPair}>
        <div className={styles.fieldPairItem}>
          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>Source</span>
            <div className={styles.fieldValue}>
              <span className={`${styles.readonlyValue} ${!source ? styles.valueBtnEmpty : ""}`}>
                {source || "Not set"}
              </span>
            </div>
          </div>
        </div>
        <div className={styles.fieldPairItem}>
          <AssignedField
            value={assignedTo}
            profiles={adminProfiles}
            onSave={saveAssigned}
            isSaved={savedFields.has("assigned")}
          />
        </div>
      </div>

      <div className={styles.divider} />

      {/* ── Contract ────────────────────────────────────────────────────── */}
      <SectionHeader label="Contract" />

      <DateFieldPair
        labelA="Start"
        isoA={contractStart}
        labelB="End"
        isoB={contractEnd}
        onSaveA={saveContractStart}
        onSaveB={saveContractEnd}
        isSavedA={savedFields.has("contractStart")}
        isSavedB={savedFields.has("contractEnd")}
      />

      <EditableField
        label="Mgmt fee"
        value={feePercent}
        displayValue={feePercent ? `${feePercent}%` : ""}
        type="number"
        min={0}
        max={100}
        placeholder="0%"
        onSave={saveFeePercent}
        isSaved={savedFields.has("feePercent")}
      />

        </div>
      )}

    </aside>
  );
}
