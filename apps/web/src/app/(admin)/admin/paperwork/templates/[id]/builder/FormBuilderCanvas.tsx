"use client";

import {
  useState,
  useCallback,
  useRef,
  useTransition,
  useEffect,
  useLayoutEffect,
  type KeyboardEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type CollisionDetection,
  type DroppableContainer,
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
import type { Form, FormField, FormFieldType, FormSchema } from "@/lib/admin/forms-types";
import { FIELD_TYPE_LABELS } from "@/lib/admin/forms-types";
import styles from "./FormBuilderCanvas.module.css";

/* ── Drag data types ──────────────────────────────────────── */

type PaletteDragData = { kind: "palette"; fieldType: FormFieldType };
type GapDropData = { kind: "gap"; index: number };

function isPaletteDrag(data: unknown): data is PaletteDragData {
  return typeof data === "object" && data !== null && (data as PaletteDragData).kind === "palette";
}

function isGapDrop(data: unknown): data is GapDropData {
  return typeof data === "object" && data !== null && (data as GapDropData).kind === "gap";
}

/* ── Custom collision detection ───────────────────────────── */

function makeCollisionDetection(isPalette: boolean): CollisionDetection {
  return (args) => {
    const gapPrefix = "gap-";
    if (isPalette) {
      // Only consider gap droppables during a palette drag
      const gaps: DroppableContainer[] = [];
      args.droppableContainers.forEach((c) => {
        if (String(c.id).startsWith(gapPrefix)) {
          gaps.push(c);
        }
      });
      return closestCenter({ ...args, droppableContainers: gaps });
    } else {
      // Only consider field droppables during a field reorder drag
      const fieldDroppables: DroppableContainer[] = [];
      args.droppableContainers.forEach((c) => {
        if (!String(c.id).startsWith(gapPrefix)) {
          fieldDroppables.push(c);
        }
      });
      return closestCenter({ ...args, droppableContainers: fieldDroppables });
    }
  };
}

type Props = {
  form: Form;
};

export function FormBuilderCanvas({ form: initialForm }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
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

  // Active drag state for collision detection and DragOverlay
  const [activeDragData, setActiveDragData] = useState<PaletteDragData | null>(null);
  const [activeGapIndex, setActiveGapIndex] = useState<number | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Undo/redo stacks — refs avoid triggering re-renders for the stacks themselves
  const historyRef = useRef<FormSchema[]>([]);
  const futureRef = useRef<FormSchema[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const fields = schema.fields;
  const selectedField = fields.find((f) => f.id === selectedFieldId) ?? null;

  const liveForm: Form = { ...initialForm, name: formName, schema };

  const collisionDetection: CollisionDetection = useCallback(
    (args) => makeCollisionDetection(activeDragData !== null)(args),
    [activeDragData],
  );

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

  // Arriving from the gallery's "Generate with AI" choice (?ai=1): open the
  // generator immediately, then strip the flag so a refresh won't reopen it.
  useEffect(() => {
    if (searchParams.get("ai") === "1") {
      setShowAiSlideOver(true);
      router.replace(`/admin/paperwork/templates/${initialForm.id}`);
    }
  }, [searchParams, router, initialForm.id]);

  // Pin the builder to the remaining viewport height (viewport bottom − its
  // own top) so the page never scrolls and only the three column bodies do.
  // The admin shell is a grow-based scroll chain, so a measured height is the
  // only reliable cap that survives the shared PullToRefresh/Shell wrappers.
  // useLayoutEffect so the height is set before paint (no first-frame flash).
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const main = el.closest("main");
    function fit() {
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const base = Math.max(420, window.innerHeight - top);
      el.style.height = `${base}px`;
      // Subtract any trailing space below the builder (e.g. the shell's bottom
      // padding) that still makes the scroll container overflow, so the page
      // itself never scrolls — only the column bodies do.
      if (main) {
        const over = main.scrollHeight - main.clientHeight;
        if (over > 0) el.style.height = `${Math.max(420, base - over)}px`;
      }
    }
    fit();
    const settle = window.setTimeout(fit, 120);
    window.addEventListener("resize", fit);
    return () => {
      window.removeEventListener("resize", fit);
      window.clearTimeout(settle);
    };
  }, []);

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

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current;
    if (isPaletteDrag(data)) {
      setActiveDragData(data);
    }
  }

  function handleDragOver(event: DragOverEvent) {
    if (!activeDragData) return;
    const overData = event.over?.data.current;
    if (isGapDrop(overData)) {
      setActiveGapIndex(overData.index);
    } else {
      setActiveGapIndex(null);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    setActiveDragData(null);
    setActiveGapIndex(null);

    if (!over) return;

    const activeData = active.data.current;

    // Palette drag → insert new field at the gap index
    if (isPaletteDrag(activeData)) {
      const overData = over.data.current;
      if (!isGapDrop(overData)) return;
      insertField(activeData.fieldType, overData.index);
      return;
    }

    // Field reorder → existing behavior
    if (active.id === over.id) return;
    const oldIndex = fields.findIndex((f) => f.id === active.id);
    const newIndex = fields.findIndex((f) => f.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    updateFields(arrayMove(fields, oldIndex, newIndex));
  }

  /** Insert a new field at the given absolute index (0 = top, fields.length = bottom). */
  function insertField(type: FormFieldType, atIndex: number) {
    const id = `field_${Date.now().toString(36)}`;
    const newField: FormField = { id, type, label: labelFor(type), required: false };
    if (type === "single_choice" || type === "multiple_choice" || type === "dropdown") {
      newField.options = ["Option 1", "Option 2"];
    }
    if (type === "rating") {
      newField.ratingMax = 5;
    }
    const next = [...fields];
    const clampedIndex = Math.max(0, Math.min(atIndex, next.length));
    next.splice(clampedIndex, 0, newField);
    updateFields(next);
    setSelectedFieldId(id);
    setPaletteAnchorIndex(null);
  }

  /** Click-to-add: inserts after the currently selected field, or at end. */
  function addField(type: FormFieldType) {
    const selectedIndex = selectedFieldId
      ? fields.findIndex((f) => f.id === selectedFieldId)
      : -1;
    const atIndex = selectedIndex >= 0 ? selectedIndex + 1 : fields.length;
    insertField(type, atIndex);
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
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div ref={rootRef} className={styles.root} onKeyDown={handleCanvasKeyDown} tabIndex={0}>
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
        <FieldTypePanel
          onAddField={addField}
          isDragging={activeDragData !== null}
        />

        {/* ── Center: canvas ─────────────────────────── */}
        <div className={styles.canvasWrap}>
          <div className={styles.canvas}>
            <SortableContext
              items={fields.map((f) => f.id)}
              strategy={verticalListSortingStrategy}
            >
              {fields.length === 0 ? (
                <EmptyDropZone
                  isDragActive={activeDragData !== null}
                  isOver={activeGapIndex === 0}
                  onAi={() => setShowAiSlideOver(true)}
                />
              ) : (
                <DropGap
                  index={0}
                  isActive={activeDragData !== null && activeGapIndex === 0}
                />
              )}

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
                  onPaletteSelect={(type) => insertField(type, index + 1)}
                  onPaletteClose={() => setPaletteAnchorIndex(null)}
                >
                  {/* Gap after this field (index + 1) */}
                  <DropGap
                    index={index + 1}
                    isActive={activeDragData !== null && activeGapIndex === index + 1}
                  />
                </SortableFieldItem>
              ))}
            </SortableContext>
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
                  Form Setup
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

      {/* ── Drag overlay (palette preview chip) ───────── */}
      <DragOverlay dropAnimation={null}>
        {activeDragData ? (
          <div className={styles.dragOverlayChip}>
            {FIELD_TYPE_LABELS[activeDragData.fieldType]}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

/* ── Drop gap component ───────────────────────────────────── */

function DropGap({ index, isActive }: { index: number; isActive: boolean }) {
  const { setNodeRef } = useDroppable({
    id: `gap-${index}`,
    data: { kind: "gap", index } satisfies GapDropData,
  });

  return (
    <div
      ref={setNodeRef}
      className={`${styles.dropGap} ${isActive ? styles.dropGapActive : ""}`}
    />
  );
}

/* ── Empty-canvas drop zone (generous first-field target) ─── */

function EmptyDropZone({
  isDragActive,
  isOver,
  onAi,
}: {
  isDragActive: boolean;
  isOver: boolean;
  onAi: () => void;
}) {
  const { setNodeRef } = useDroppable({
    id: "gap-0",
    data: { kind: "gap", index: 0 } satisfies GapDropData,
  });

  return (
    <div
      ref={setNodeRef}
      className={`${styles.emptyCanvas} ${isDragActive ? styles.emptyCanvasArmed : ""} ${isOver ? styles.emptyCanvasOver : ""}`}
    >
      {isDragActive ? (
        <p className={styles.emptyCanvasHint}>Drop the field here to start</p>
      ) : (
        <p className={styles.emptyCanvasHint}>
          Drag a field type from the left panel, or use{" "}
          <button type="button" className={styles.emptyAiLink} onClick={onAi}>
            Generate with AI
          </button>
          .
        </p>
      )}
    </div>
  );
}

/* ── Layout field helper ──────────────────────────────────── */

function isLayoutField(type: FormField["type"]): boolean {
  return type === "section_header" || type === "description" || type === "divider" || type === "page_break";
}

/* ── Sortable wrapper ─────────────────────────────────────── */

function SortableFieldItem({
  field,
  isSelected,
  isLayout,
  onSelect,
  onRemove,
  onDuplicate,
  onAddBelow,
  showPaletteBelow,
  onPaletteSelect,
  onPaletteClose,
  children,
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
  children?: React.ReactNode;
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

      {/* Gap droppable after this field */}
      {children}
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
    page_break: "Page Break",
  };
  return labels[type] ?? "Field";
}
