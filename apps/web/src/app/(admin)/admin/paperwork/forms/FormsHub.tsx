"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  FileText,
  Globe,
  Lock,
  PencilSimple,
  Trash,
  ArrowSquareOut,
  ChartBar,
  SpinnerGap,
  Warning,
  LinkSimple,
  CheckCircle,
  Buildings,
  ClipboardText,
  Star,
  House,
  X,
  UserCircle,
} from "@phosphor-icons/react";
import { createFormAction, deleteFormAction, updateFormSchemaAction, getRespondentDataAction } from "./form-actions";
import type { RespondentFormEntry, FormWithCount } from "@/lib/admin/forms";
import type { RespondentProfile, FormPropertyOption } from "@/lib/admin/forms";
import type { FormSchema } from "@/lib/admin/forms-types";
import { CustomSelect } from "@/components/admin/CustomSelect";
import { TemplatePickerModal } from "./TemplatePickerModal";
import type { PickerTemplate } from "./TemplatePickerModal";
import styles from "./FormsHub.module.css";

type Props = {
  forms: FormWithCount[];
  orgId: string;
  respondents: RespondentProfile[];
  propertyOptions: FormPropertyOption[];
};

const FORM_TEMPLATES: PickerTemplate[] = [
  {
    id: "blank",
    name: "Blank",
    description: "Start from scratch",
    icon: <Plus size={20} weight="duotone" />,
    fields: [],
  },
  {
    id: "owner-intake",
    name: "Owner Intake",
    description: "Onboard new property owners",
    icon: <Buildings size={20} weight="duotone" />,
    fields: [
      { id: "field_001", type: "section_header", label: "Owner Information", required: false },
      { id: "field_002", type: "short_text", label: "Full Name", required: true, placeholder: "Your full name" },
      { id: "field_003", type: "email", label: "Email Address", required: true },
      { id: "field_004", type: "phone", label: "Phone Number", required: false },
      { id: "field_005", type: "section_header", label: "Property Details", required: false },
      { id: "field_006", type: "short_text", label: "Property Address", required: true, placeholder: "123 Main St, City, State" },
      { id: "field_007", type: "dropdown", label: "Property Type", required: true, options: ["Single Family Home", "Condo/Apartment", "Townhouse", "Multi-Family", "Other"] },
      { id: "field_008", type: "number", label: "Number of Bedrooms", required: true },
      { id: "field_009", type: "section_header", label: "Goals & Expectations", required: false },
      { id: "field_010", type: "long_text", label: "What are your goals with this property?", required: false, placeholder: "Tell us what you're hoping to achieve..." },
      { id: "field_011", type: "single_choice", label: "Preferred communication method", required: true, options: ["Email", "Phone", "Text message"] },
    ],
  },
  {
    id: "inspection",
    name: "Inspection Checklist",
    description: "Property condition walkthrough",
    icon: <ClipboardText size={20} weight="duotone" />,
    fields: [
      { id: "field_001", type: "section_header", label: "Property Information", required: false },
      { id: "field_002", type: "short_text", label: "Property Address", required: true },
      { id: "field_003", type: "date", label: "Inspection Date", required: true },
      { id: "field_004", type: "section_header", label: "Exterior", required: false },
      { id: "field_005", type: "single_choice", label: "Exterior condition", required: true, options: ["Excellent", "Good", "Fair", "Poor"] },
      { id: "field_006", type: "long_text", label: "Exterior notes", required: false, placeholder: "Any issues or observations..." },
      { id: "field_007", type: "section_header", label: "Interior", required: false },
      { id: "field_008", type: "single_choice", label: "Overall interior condition", required: true, options: ["Excellent", "Good", "Fair", "Poor"] },
      { id: "field_009", type: "multiple_choice", label: "Areas needing attention", required: false, options: ["Kitchen", "Bathrooms", "Living areas", "Bedrooms", "HVAC", "Plumbing", "Electrical"] },
      { id: "field_010", type: "long_text", label: "Additional notes", required: false },
      { id: "field_011", type: "signature", label: "Inspector signature", required: true },
    ],
  },
  {
    id: "guest-survey",
    name: "Guest Survey",
    description: "Post-stay feedback collection",
    icon: <Star size={20} weight="duotone" />,
    fields: [
      { id: "field_001", type: "section_header", label: "Your Stay", required: false },
      { id: "field_002", type: "rating", label: "Overall experience", required: true, ratingMax: 5 },
      { id: "field_003", type: "rating", label: "Cleanliness", required: true, ratingMax: 5 },
      { id: "field_004", type: "rating", label: "Communication", required: true, ratingMax: 5 },
      { id: "field_005", type: "rating", label: "Accuracy of listing", required: true, ratingMax: 5 },
      { id: "field_006", type: "section_header", label: "Your Feedback", required: false },
      { id: "field_007", type: "long_text", label: "What did you enjoy most?", required: false, placeholder: "Tell us the highlights..." },
      { id: "field_008", type: "long_text", label: "What could we improve?", required: false, placeholder: "We value your honest feedback..." },
      { id: "field_009", type: "single_choice", label: "Would you stay again?", required: true, options: ["Definitely yes", "Probably yes", "Probably not", "Definitely not"] },
    ],
  },
  {
    id: "property-welcome",
    name: "Property Welcome",
    description: "Guest arrival information form",
    icon: <House size={20} weight="duotone" />,
    fields: [
      { id: "field_001", type: "section_header", label: "Your Arrival", required: false },
      { id: "field_002", type: "short_text", label: "Guest name", required: true },
      { id: "field_003", type: "date", label: "Check-in date", required: true },
      { id: "field_004", type: "number", label: "Number of guests", required: true },
      { id: "field_005", type: "section_header", label: "House Rules Acknowledgment", required: false },
      { id: "field_006", type: "description", label: "Please review and acknowledge the house rules before your arrival.", required: false },
      { id: "field_007", type: "multiple_choice", label: "I acknowledge and agree to", required: true, options: ["No smoking inside the property", "No parties or events", "Quiet hours 10pm-8am", "Pets policy as agreed", "Check-out by agreed time"] },
      { id: "field_008", type: "short_text", label: "Emergency contact name", required: false },
      { id: "field_009", type: "phone", label: "Emergency contact phone", required: false },
      { id: "field_010", type: "signature", label: "Guest signature", required: true },
    ],
  },
];

const LAYOUT_TYPES = new Set(["section_header", "description", "divider"]);

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function FormsHub({ forms, orgId, respondents, propertyOptions }: Props) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all");
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);

  const [selectedRespondentId, setSelectedRespondentId] = useState<string | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [respondentData, setRespondentData] = useState<Map<string, RespondentFormEntry>>(new Map());
  const [loadingRespondent, setLoadingRespondent] = useState(false);

  useEffect(() => {
    if (!selectedRespondentId) {
      setRespondentData(new Map());
      return;
    }
    setLoadingRespondent(true);
    getRespondentDataAction(orgId, selectedRespondentId, selectedPropertyId ?? undefined)
      .then((entries) => {
        const m = new Map<string, RespondentFormEntry>();
        for (const entry of entries) {
          if (!m.has(entry.form_id)) m.set(entry.form_id, entry);
        }
        setRespondentData(m);
      })
      .finally(() => setLoadingRespondent(false));
  }, [selectedRespondentId, selectedPropertyId, orgId]);

  const filteredForms = forms.filter((f) => {
    if (filter === "published" && !f.is_active) return false;
    if (filter === "draft" && f.is_active) return false;
    if (search && !f.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (selectedRespondentId && !respondentData.has(f.id)) return false;
    return true;
  });

  function handleCopyLink(form: FormWithCount) {
    const url = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://www.theparcelco.com"}/f/${form.slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(form.id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }

  async function handleCreateFromTemplate(template: PickerTemplate) {
    setCreating(template.id);
    try {
      const result = await createFormAction(
        orgId,
        template.name === "Blank" ? "Untitled Form" : template.name,
      );
      if (!result.ok || !result.data?.id) {
        setError(result.ok ? "Failed to create form." : result.error);
        return;
      }
      if (template.fields.length > 0) {
        const schema: FormSchema = {
          version: 1,
          fields: template.fields,
          settings: {},
        };
        await updateFormSchemaAction(result.data.id, schema);
      }
      router.push(`/admin/paperwork/forms/${result.data.id}/edit`);
    } finally {
      setCreating(null);
    }
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

  const hasRespondentFilters = respondents.length > 0;
  const isRespondentFilterActive = !!(selectedRespondentId || selectedPropertyId);

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
          onClick={() => setShowTemplateModal(true)}
          disabled={creating !== null}
        >
          {creating !== null ? (
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

      {forms.length === 0 ? (
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
            onClick={() => setShowTemplateModal(true)}
            disabled={creating !== null}
          >
            <Plus size={14} weight="bold" />
            New Form
          </button>
        </div>
      ) : (
        <>
          <div className={styles.filterBar}>
            <div className={styles.filterChips}>
              {(["all", "published", "draft"] as const).map((val) => (
                <button
                  key={val}
                  type="button"
                  className={`${styles.filterChip} ${filter === val ? styles.filterChipActive : ""}`}
                  onClick={() => setFilter(val)}
                >
                  {val === "all" ? "All" : val === "published" ? "Published" : "Drafts"}
                  <span className={styles.filterChipCount}>
                    {val === "all"
                      ? forms.length
                      : val === "published"
                      ? forms.filter((f) => f.is_active).length
                      : forms.filter((f) => !f.is_active).length}
                  </span>
                </button>
              ))}
            </div>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search forms..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {hasRespondentFilters && (
            <div className={styles.respondentBar}>
              <UserCircle size={15} weight="duotone" className={styles.respondentBarIcon} />
              <div className={styles.respondentSelectWrap}>
                <CustomSelect
                  value={selectedRespondentId ?? ""}
                  onChange={(v) => setSelectedRespondentId(v || null)}
                  options={[
                    { value: "", label: "All respondents" },
                    ...respondents.map((r) => ({ value: r.id, label: r.name })),
                  ]}
                  placeholder="Filter by person"
                />
              </div>
              {propertyOptions.length > 0 && (
                <div className={styles.respondentSelectWrap}>
                  <CustomSelect
                    value={selectedPropertyId ?? ""}
                    onChange={(v) => setSelectedPropertyId(v || null)}
                    options={[
                      { value: "", label: "All properties" },
                      ...propertyOptions.map((p) => ({ value: p.id, label: p.name })),
                    ]}
                    placeholder="Filter by property"
                  />
                </div>
              )}
              {isRespondentFilterActive && (
                <button
                  type="button"
                  className={styles.clearFilterBtn}
                  onClick={() => {
                    setSelectedRespondentId(null);
                    setSelectedPropertyId(null);
                  }}
                >
                  <X size={12} weight="bold" />
                  Clear
                </button>
              )}
              {loadingRespondent && (
                <SpinnerGap size={14} weight="bold" className={styles.spin} />
              )}
            </div>
          )}

          <div className={styles.formList}>
            {filteredForms.length === 0 ? (
              <div className={styles.noResults}>
                <FileText size={24} weight="duotone" />
                <p>
                  {isRespondentFilterActive
                    ? "This person has not responded to any forms."
                    : "No forms match your search."}
                </p>
              </div>
            ) : (
              filteredForms.map((form) => (
                <FormCard
                  key={form.id}
                  form={form}
                  onDelete={handleDelete}
                  deletingId={deletingId}
                  confirmDeleteId={confirmDeleteId}
                  onCancelDelete={() => setConfirmDeleteId(null)}
                  copiedId={copiedId}
                  onCopyLink={handleCopyLink}
                  respondentEntry={respondentData.get(form.id) ?? null}
                />
              ))
            )}
          </div>
        </>
      )}

      {showTemplateModal && (
        <TemplatePickerModal
          templates={FORM_TEMPLATES}
          creating={creating}
          error={error}
          onSelect={handleCreateFromTemplate}
          onClose={() => {
            setShowTemplateModal(false);
            setError(null);
          }}
        />
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
  copiedId,
  onCopyLink,
  respondentEntry,
}: {
  form: FormWithCount;
  onDelete: (id: string) => void;
  deletingId: string | null;
  confirmDeleteId: string | null;
  onCancelDelete: () => void;
  copiedId: string | null;
  onCopyLink: (form: FormWithCount) => void;
  respondentEntry: RespondentFormEntry | null;
}) {
  const router = useRouter();
  const isDeleting = deletingId === form.id;
  const isConfirming = confirmDeleteId === form.id;

  const fieldCount = form.schema.fields.length;

  const answerFields = respondentEntry
    ? form.schema.fields
        .filter((f) => !LAYOUT_TYPES.has(f.type))
        .slice(0, 4)
        .filter((f) => {
          const val = respondentEntry.data[f.id];
          return val !== undefined && val !== null && val !== "";
        })
    : [];

  return (
    <div className={`${styles.card} ${isDeleting ? styles.cardDeleting : ""}`}>
      <div className={`${styles.cardAccent} ${form.is_active ? styles.cardAccentPublished : ""}`} />

      <div
        className={`${styles.statusPill} ${form.is_active ? styles.statusPillPublished : styles.statusPillDraft}`}
      >
        <span className={styles.statusDot} />
        {form.is_active ? "Published" : "Draft"}
      </div>

      <div className={styles.cardIcon}>
        <FileText size={20} weight="duotone" />
      </div>

      <div className={styles.cardBody}>
        <div className={styles.cardTop}>
          <span className={styles.cardName}>{form.name}</span>
          <div className={styles.cardBadges}>
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
          <span className={`${styles.metaItem} ${styles.metaItemResponses} ${form.response_count === 0 ? styles.metaItemNoResponses : ""}`}>
            <ChartBar size={12} weight="duotone" />
            {form.response_count === 0
              ? "No responses"
              : form.response_count === 1
              ? "1 response"
              : `${form.response_count} responses`}
          </span>
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
              <>
                <button
                  type="button"
                  className={`${styles.actionBtn} ${copiedId === form.id ? styles.cardActionCopied : ""}`}
                  onClick={() => onCopyLink(form)}
                  title="Copy public link"
                >
                  {copiedId === form.id ? (
                    <CheckCircle size={15} weight="bold" />
                  ) : (
                    <LinkSimple size={15} weight="bold" />
                  )}
                </button>
                <a
                  href={`/f/${form.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.actionBtn}
                  title="Open public form"
                >
                  <ArrowSquareOut size={14} weight="bold" />
                </a>
              </>
            )}
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => router.push(`/admin/paperwork/forms/${form.id}/responses`)}
              title="View responses"
            >
              <ChartBar size={14} weight="bold" />
            </button>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => router.push(`/admin/paperwork/forms/${form.id}/edit`)}
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

      {respondentEntry && (
        <div className={styles.inlineAnswers}>
          <div className={styles.inlineAnswersHeader}>
            <CheckCircle size={12} weight="bold" className={styles.inlineAnswersCheck} />
            Submitted {formatRelative(respondentEntry.submitted_at)}
            {respondentEntry.completed_at && (
              <span className={styles.inlineAnswersComplete}>Complete</span>
            )}
          </div>
          {answerFields.length > 0 && (
            <div className={styles.inlineAnswerRows}>
              {answerFields.map((f) => {
                const val = respondentEntry.data[f.id];
                return (
                  <div key={f.id} className={styles.inlineAnswerRow}>
                    <span className={styles.inlineAnswerLabel}>{f.label}</span>
                    <span className={styles.inlineAnswerValue}>
                      {Array.isArray(val)
                        ? (val as string[]).join(", ").slice(0, 80)
                        : String(val).slice(0, 80)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <a
            href={`/admin/paperwork/forms/${form.id}/responses`}
            className={styles.inlineAnswersLink}
          >
            View full response
          </a>
        </div>
      )}
    </div>
  );
}
