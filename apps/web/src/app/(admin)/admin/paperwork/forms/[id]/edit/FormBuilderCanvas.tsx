"use client";

import {
  useState,
  useCallback,
  useRef,
  useTransition,
  useEffect,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  Sparkle,
  Eye,
  SpinnerGap,
  DotsSixVertical,
  Trash,
  Plus,
  CheckCircle,
  ShareNetwork,
  CopySimple,
} from "@phosphor-icons/react";
import {
  updateFormSchemaAction,
  updateFormMetaAction,
  publishFormAction,
  unpublishFormAction,
} from "../../form-actions";
import { AiGenerateSlideOver } from "./AiGenerateSlideOver";
import { ShareModal } from "./ShareModal";
import { FieldBlock } from "./FieldBlock";
import { FieldCommandPalette } from "./FieldCommandPalette";
import { FieldPropertyPopover } from "./FieldPropertyPopover";
import { FieldTypePanel } from "./FieldTypePanel";
import { FormPreviewPanel } from "./FormPreviewPanel";
import { FormSettingsPanel } from "./FormSettingsPanel";
import type { Form, FormField, FormSchema } from "@/lib/admin/forms-types";
import styles from "./FormBuilderCanvas.module.css";

type Props = {
  form: Form;
};

export function FormBuilderCanvas({ form: initialForm }: Props) {
  const router = useRouter();
  const [schema, setSchema] = useState<FormSchema>(initialForm.schema);
  const [formName, setFormName] = useState(initialForm.name);
  const [isPublished, setIsPublished] = useState(initialForm.is_active);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [paletteAnchorIndex, setPaletteAnchorIndex] = useState<number | null>(null);
  const [showAiSlideOver, setShowAiSlideOver] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [formIsPublic, setFormIsPublic] = useState(initialForm.is_public);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [publishing, startPublishing] = useTransition();
  const [rightPanelTab, setRightPanelTab] = useState<"preview" | "settings">("preview");
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Undo/redo stacks — refs avoid triggering re-renders for the stacks themselves
  const historyRef = useRef<FormSchema[]>([]);
  const futureRef = useRef<FormSchema[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const fields = schema.fields;
  const selectedField = fields.find((f) => f.id === selectedFieldId) ?? null;

  const liveForm: Form = { ...initialForm, name: formName, schema };

  const scheduleAutoSave = useCallback(
    (nextSchema: FormSchema) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      setSaving(true);
      saveTimeoutRef.current = setTimeout(async () => {
        await updateFormSchemaAction(initialForm.id, nextSchema);
        setSaving(false);
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 1500);
      }, 500);
    },
    [initialForm.id],
  );

  function updateFields(next: FormField[]) {
    historyRef.current = [...historyRef.current.slice(-49), schema];
    futureRef.current = [];
    const nextSchema = { ...schema, fields: next };
    setSchema(nextSchema);
    scheduleAutoSave(nextSchema);
  }

  // Undo/redo keyboard handler
  useEffect(() => {
    function handleUndoRedo(e: globalThis.KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        const prev = historyRef.current.pop();
        if (!prev) return;
        futureRef.current = [schema, ...futureRef.current];
        setSchema(prev);
        scheduleAutoSave(prev);
      }
      if ((e.key === "z" && e.shiftKey) || e.key === "y") {
        e.preventDefault();
        const next = futureRef.current.shift();
        if (!next) return;
        historyRef.current = [...historyRef.current, schema];
        setSchema(next);
        scheduleAutoSave(next);
      }
    }
    document.addEventListener("keydown", handleUndoRedo);
    return () => document.removeEventListener("keydown", handleUndoRedo);
  }, [schema, scheduleAutoSave]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = fields.findIndex((f) => f.id === active.id);
    const newIndex = fields.findIndex((f) => f.id === over.id);
    updateFields(arrayMove(fields, oldIndex, newIndex));
  }

  function addField(type: FormField["type"], atIndex?: number) {
    const id = `field_${Date.now().toString(36)}`;
    const newField: FormField = { id, type, label: labelFor(type), required: false };
    if (type === "single_choice" || type === "multiple_choice" || type === "dropdown") {
      newField.options = ["Option 1", "Option 2"];
    }
    if (type === "rating") {
      newField.ratingMax = 5;
    }
    const next = [...fields];
    const insertAt = atIndex !== undefined ? atIndex + 1 : next.length;
    next.splice(insertAt, 0, newField);
    updateFields(next);
    setSelectedFieldId(id);
    setPaletteAnchorIndex(null);
  }

  function updateField(id: string, patch: Partial<FormField>) {
    const next = fields.map((f) => (f.id === id ? { ...f, ...patch } : f));
    updateFields(next);
  }

  function removeField(id: string) {
    // Strip conditions that reference the removed field so dependents never
    // evaluate against a controller that no longer exists.
    const next = fields
      .filter((f) => f.id !== id)
      .map((f) => {
        if (!f.conditions) return f;
        const conditions = f.conditions.conditions.filter((c) => c.field !== id);
        if (conditions.length === f.conditions.conditions.length) return f;
        return {
          ...f,
          conditions:
            conditions.length === 0 ? undefined : { ...f.conditions, conditions },
        };
      });
    updateFields(next);
    if (selectedFieldId === id) setSelectedFieldId(null);
  }

  async function handleNameBlur() {
    const trimmed = formName.trim() || "Untitled Form";
    setFormName(trimmed);
    await updateFormMetaAction(initialForm.id, { name: trimmed });
  }

  async function handlePublishToggle() {
    startPublishing(async () => {
      if (isPublished) {
        await unpublishFormAction(initialForm.id);
        setIsPublished(false);
      } else {
        await publishFormAction(initialForm.id);
        setIsPublished(true);
      }
      router.refresh();
    });
  }

  function handleAiFieldsConfirm(incoming: FormField[]) {
    updateFields(incoming);
    setShowAiSlideOver(false);
  }

  function handleCanvasKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (
      e.key === "/" &&
      (e.target as HTMLElement).tagName !== "INPUT" &&
      (e.target as HTMLElement).tagName !== "TEXTAREA"
    ) {
      e.preventDefault();
      if (fields.length > 0) {
        setPaletteAnchorIndex(fields.length - 1);
      }
    }
    if (e.key === "Escape") {
      setSelectedFieldId(null);
      setPaletteAnchorIndex(null);
    }
  }

  const fieldCount = fields.length;
  const fieldCountLabel = fieldCount === 1 ? "1 field" : `${fieldCount} fields`;
  const statusLabel = isPublished ? "Published" : "Draft";

  return (
    <div className={styles.root} onKeyDown={handleCanvasKeyDown} tabIndex={0}>
      {/* ── Top bar (spans all columns) ────────────── */}
      <div className={styles.topBar}>
        <div className={styles.topLeft}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => router.push("/admin/paperwork/forms")}
          >
            <ArrowLeft size={16} weight="bold" />
          </button>
          <input
            className={styles.nameInput}
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            onBlur={handleNameBlur}
            placeholder="Untitled Form"
            aria-label="Form name"
          />
          <span className={styles.saveStatus}>
            {saving ? (
              <SpinnerGap size={13} weight="bold" className={styles.spin} />
            ) : savedFlash ? (
              <>
                <CheckCircle size={13} weight="bold" className={styles.savedIcon} />
                Saved
              </>
            ) : null}
          </span>
          {fieldCount > 0 && (
            <span className={styles.fieldCounter}>
              {fieldCountLabel} · {statusLabel}
            </span>
          )}
        </div>

        <div className={styles.topRight}>
          <button
            type="button"
            className={styles.aiBtn}
            onClick={() => setShowAiSlideOver(true)}
          >
            <Sparkle size={14} weight="bold" />
            Generate with AI
          </button>
          <button
            type="button"
            className={styles.shareBtn}
            onClick={() => setShowShareModal(true)}
          >
            <ShareNetwork size={14} weight="bold" />
            Share
          </button>
          <a
            href={isPublished && initialForm.slug ? `/f/${initialForm.slug}` : undefined}
            target="_blank"
            rel="noopener noreferrer"
            className={`${styles.previewBtn} ${!isPublished ? styles.previewBtnDisabled : ""}`}
            aria-disabled={!isPublished}
            onClick={(e) => !isPublished && e.preventDefault()}
          >
            <Eye size={14} weight="bold" />
            Preview
          </a>
          <button
            type="button"
            className={`${styles.publishBtn} ${isPublished ? styles.unpublishBtn : ""}`}
            onClick={handlePublishToggle}
            disabled={publishing}
          >
            {publishing ? (
              <SpinnerGap size={14} weight="bold" className={styles.spin} />
            ) : isPublished ? (
              "Unpublish"
            ) : (
              "Publish"
            )}
          </button>
        </div>
      </div>

      {/* ── Left panel: field type picker ──────────── */}
      <FieldTypePanel onAddField={(type) => addField(type)} />

      {/* ── Center: canvas ─────────────────────────── */}
      <div className={styles.canvasWrap}>
        <div className={styles.canvas}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={fields.map((f) => f.id)}
              strategy={verticalListSortingStrategy}
            >
              {fields.map((field, index) => (
                <SortableFieldItem
                  key={field.id}
                  field={field}
                  isSelected={selectedFieldId === field.id}
                  isLayout={isLayoutField(field.type)}
                  onSelect={() =>
                    setSelectedFieldId((prev) => (prev === field.id ? null : field.id))
                  }
                  onUpdate={(patch) => updateField(field.id, patch)}
                  onRemove={() => removeField(field.id)}
                  onDuplicate={() => {
                    const newId = `field_${Date.now().toString(36)}`;
                    const clone = { ...field, id: newId };
                    const next = [...fields];
                    next.splice(index + 1, 0, clone);
                    updateFields(next);
                    setSelectedFieldId(newId);
                  }}
                  onAddBelow={() => setPaletteAnchorIndex(index)}
                  showPaletteBelow={paletteAnchorIndex === index}
                  onPaletteSelect={(type) => addField(type, index)}
                  onPaletteClose={() => setPaletteAnchorIndex(null)}
                />
              ))}
            </SortableContext>
          </DndContext>

          {fields.length === 0 && (
            <div className={styles.emptyCanvas}>
              <p className={styles.emptyCanvasHint}>
                Pick a field type from the left panel to get started, or use{" "}
                <button
                  type="button"
                  className={styles.emptyAiLink}
                  onClick={() => setShowAiSlideOver(true)}
                >
                  Generate with AI
                </button>
                .
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Right panel: preview or field properties ── */}
      <div className={styles.rightPanel}>
        {selectedField ? (
          <FieldPropertyPopover
            field={selectedField}
            allFields={fields}
            onUpdate={(patch) => updateField(selectedField.id, patch)}
            onClose={() => setSelectedFieldId(null)}
          />
        ) : (
          <div className={styles.rightPanelTabbed}>
            <div className={styles.rightPanelTabs}>
              <button
                type="button"
                className={`${styles.rightPanelTab} ${rightPanelTab === "preview" ? styles.rightPanelTabActive : ""}`}
                onClick={() => setRightPanelTab("preview")}
              >
                Preview
              </button>
              <button
                type="button"
                className={`${styles.rightPanelTab} ${rightPanelTab === "settings" ? styles.rightPanelTabActive : ""}`}
                onClick={() => setRightPanelTab("settings")}
              >
                Settings
              </button>
            </div>
            {rightPanelTab === "preview" ? (
              <FormPreviewPanel form={liveForm} />
            ) : (
              <FormSettingsPanel
                form={initialForm}
                formName={formName}
                schema={schema}
                onUpdateMeta={(updates) => {
                  updateFormMetaAction(initialForm.id, updates);
                }}
                onUpdateSchema={(nextSchema) => {
                  setSchema(nextSchema);
                  scheduleAutoSave(nextSchema);
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* ── AI slide-over ──────────────────────────── */}
      <AiGenerateSlideOver
        open={showAiSlideOver}
        existingFields={fields}
        onConfirm={handleAiFieldsConfirm}
        onClose={() => setShowAiSlideOver(false)}
      />

      {/* ── Share modal ────────────────────────────── */}
      {showShareModal && (
        <ShareModal
          form={{ ...initialForm, is_active: isPublished, is_public: formIsPublic }}
          onClose={() => setShowShareModal(false)}
          onIsPublicChange={(val) => setFormIsPublic(val)}
        />
      )}
    </div>
  );
}

/* ── Layout field helper ──────────────────────────────────── */

function isLayoutField(type: FormField["type"]): boolean {
  return type === "section_header" || type === "description" || type === "divider";
}

/* ── Sortable wrapper ─────────────────────────────────────── */

function SortableFieldItem({
  field,
  isSelected,
  isLayout,
  onSelect,
  onUpdate,
  onRemove,
  onDuplicate,
  onAddBelow,
  showPaletteBelow,
  onPaletteSelect,
  onPaletteClose,
}: {
  field: FormField;
  isSelected: boolean;
  isLayout: boolean;
  onSelect: () => void;
  onUpdate: (patch: Partial<FormField>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onAddBelow: () => void;
  showPaletteBelow: boolean;
  onPaletteSelect: (type: FormField["type"]) => void;
  onPaletteClose: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const rowClass = [
    isLayout ? styles.fieldRowLayout : styles.fieldRow,
    isSelected && !isLayout ? styles.fieldRowSelected : "",
    isDragging ? styles.fieldRowDragging : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={setNodeRef} style={style} className={styles.sortableItem}>
      <div
        className={rowClass}
        onClick={onSelect}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onSelect()}
        aria-pressed={isSelected}
      >
        {/* Drag handle */}
        <span
          className={styles.dragHandle}
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          aria-label="Drag to reorder"
        >
          <DotsSixVertical size={16} weight="bold" />
        </span>

        {/* Field preview */}
        <div className={styles.fieldContent}>
          <FieldBlock field={field} />
        </div>

        {/* Duplicate */}
        <button
          type="button"
          className={styles.duplicateBtn}
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
          aria-label="Duplicate field"
        >
          <CopySimple size={13} weight="bold" />
        </button>

        {/* Remove */}
        <button
          type="button"
          className={styles.removeBtn}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label="Remove field"
        >
          <Trash size={13} weight="bold" />
        </button>
      </div>

      {/* Add below + inline palette */}
      <div className={styles.addBelowRow}>
        <button
          type="button"
          className={styles.addBelowBtn}
          onClick={(e) => {
            e.stopPropagation();
            onAddBelow();
          }}
          aria-label="Add field below"
        >
          <Plus size={11} weight="bold" />
        </button>
        {showPaletteBelow && (
          <div className={styles.paletteBelow}>
            <FieldCommandPalette onSelect={onPaletteSelect} onClose={onPaletteClose} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────────────── */

function labelFor(type: FormField["type"]): string {
  const labels: Record<FormField["type"], string> = {
    short_text: "Short Text",
    long_text: "Long Text",
    number: "Number",
    email: "Email Address",
    phone: "Phone Number",
    date: "Date",
    single_choice: "Single Choice",
    multiple_choice: "Multiple Choice",
    dropdown: "Dropdown",
    file_upload: "File Upload",
    rating: "Rating",
    signature: "Signature",
    section_header: "Section Header",
    description: "Description",
    divider: "Divider",
  };
  return labels[type] ?? "Field";
}
