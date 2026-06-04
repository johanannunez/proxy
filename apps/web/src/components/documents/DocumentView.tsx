"use client";

import { useActionState, useState } from "react";
import {
  WarningCircle,
  PencilSimple,
  Check,
  X,
  Eye,
  EyeSlash,
  ClipboardText,
  CheckCircle,
} from "@phosphor-icons/react";
import {
  computeFormCompletion,
  mergeDataOverRegistry,
  type FormDef,
  type MergedField,
} from "@/lib/forms/form-registry";
import { RegistryField } from "./fields/RegistryField";
import type { SaveFormState } from "@/lib/forms/save-form";

type SaveAction = (
  prev: SaveFormState,
  formData: FormData,
) => Promise<SaveFormState>;

/* ─── Read-mode value (handles sensitive masking + copy) ─── */
function ReadValue({ field }: { field: MergedField }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  if (field.value == null) {
    return (
      <span className="text-sm italic" style={{ color: "var(--color-text-tertiary)" }}>
        Not provided
      </span>
    );
  }

  const display =
    field.sensitive && !revealed ? "•".repeat(Math.min(field.value.length, 10)) : field.value;

  function copy() {
    navigator.clipboard.writeText(field.value ?? "").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="text-sm"
        style={{
          color: "var(--color-text-primary)",
          fontFamily: field.sensitive ? "ui-monospace, monospace" : undefined,
          whiteSpace: "pre-wrap",
        }}
      >
        {display}
      </span>
      {field.sensitive && (
        <button
          type="button"
          onClick={() => setRevealed((r) => !r)}
          className="shrink-0 rounded p-0.5 transition-colors hover:bg-[var(--color-warm-gray-100)]"
          style={{ color: "var(--color-text-tertiary)" }}
          aria-label={revealed ? "Hide value" : "Reveal value"}
        >
          {revealed ? <EyeSlash size={13} /> : <Eye size={13} />}
        </button>
      )}
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded p-0.5 transition-colors hover:bg-[var(--color-warm-gray-100)]"
        style={{ color: copied ? "#15803d" : "var(--color-text-tertiary)" }}
        aria-label="Copy value"
      >
        {copied ? <Check size={12} weight="bold" /> : <ClipboardText size={12} />}
      </button>
    </span>
  );
}

/* ─── Completion chip ─── */
function CompletionChip({ pct }: { pct: number }) {
  const complete = pct >= 100;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{
        backgroundColor: complete ? "rgba(22, 163, 74, 0.12)" : "var(--color-warm-gray-100)",
        color: complete ? "#15803d" : "var(--color-text-secondary)",
      }}
    >
      {complete && <CheckCircle size={12} weight="fill" />}
      {pct}% complete
    </span>
  );
}

/* ─── Read mode ─── */
function ReadMode({ def, data }: { def: FormDef; data: Record<string, unknown> }) {
  const merged = mergeDataOverRegistry(def, data);
  return (
    <div className="flex flex-col gap-6">
      {def.sections.map((section) => {
        const fields = merged.filter((f) => f.section === section.key);
        return (
          <section key={section.key}>
            <h3
              className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              {section.title}
            </h3>
            <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              {fields.map((field) => (
                <div key={field.key} className="flex flex-col gap-0.5">
                  <span className="text-[12px] font-medium" style={{ color: "var(--color-text-secondary)" }}>
                    {field.label}
                  </span>
                  <ReadValue field={field} />
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* ─── Edit mode ─── */
function EditMode({
  def,
  data,
  action,
  hiddenFields,
  onDone,
  onCancel,
}: {
  def: FormDef;
  data: Record<string, unknown>;
  action: SaveAction;
  hiddenFields: Record<string, string>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState<SaveFormState, FormData>(
    async (prev, formData) => {
      const result = await action(prev, formData);
      if (result.ok) onDone();
      return result;
    },
    {},
  );
  const err = (key: string) => state.fieldErrors?.[key];

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {Object.entries(hiddenFields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}

      {state.error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border px-4 py-3 text-sm"
          style={{ borderColor: "#f1c4c4", backgroundColor: "#fdf4f4", color: "#8a1f1f" }}
        >
          <WarningCircle size={18} weight="fill" style={{ color: "#c0372a" }} />
          <span>{state.error}</span>
        </div>
      )}

      {def.sections.map((section) => (
        <section key={section.key}>
          <h3
            className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {section.title}
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {section.fields.map((field) => (
              <div key={field.key} className={field.type === "textarea" ? "sm:col-span-2" : ""}>
                <RegistryField
                  field={field}
                  defaultValue={data[field.key] != null ? String(data[field.key]) : undefined}
                  error={err(field.key)}
                />
              </div>
            ))}
          </div>
        </section>
      ))}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors"
          style={{ borderColor: "var(--color-warm-gray-200)", color: "var(--color-text-secondary)" }}
        >
          <X size={14} />
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
          style={{ backgroundColor: "var(--color-text-primary)" }}
        >
          <Check size={14} weight="bold" />
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

/**
 * Shared document presentation used by the client portal, the admin
 * per-workspace tab, and the admin global hub drawer. Renders EVERY question
 * in the form — filled or blank — in read mode, with an optional inline
 * editor when an `action` is supplied.
 */
export function DocumentView({
  def,
  data,
  action,
  hiddenFields,
  startInEdit = false,
  hideHeader = false,
}: {
  def: FormDef;
  data: Record<string, unknown>;
  /** When provided, an "Edit" affordance is shown and edits post to this action. */
  action?: SaveAction;
  /** Hidden inputs the action needs (form_key, property_id, profile_id). */
  hiddenFields?: Record<string, string>;
  startInEdit?: boolean;
  /** Skip the built-in title/description block (e.g. when wrapped in a card). */
  hideHeader?: boolean;
}) {
  const editable = Boolean(action && hiddenFields);
  const [editing, setEditing] = useState(startInEdit && editable);
  const completion = computeFormCompletion(def, data);

  if (hideHeader) {
    return (
      <div className="flex flex-col gap-4">
        {editable && !editing && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--color-warm-gray-50)]"
              style={{ borderColor: "var(--color-warm-gray-200)", color: "var(--color-text-secondary)" }}
            >
              <PencilSimple size={14} />
              Edit
            </button>
          </div>
        )}
        {editing && editable ? (
          <EditMode
            def={def}
            data={data}
            action={action!}
            hiddenFields={hiddenFields!}
            onDone={() => setEditing(false)}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <ReadMode def={def} data={data} />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight" style={{ color: "var(--color-text-primary)" }}>
              {def.label}
            </h2>
            <CompletionChip pct={completion.pct} />
          </div>
          {def.description && (
            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              {def.description}
            </p>
          )}
        </div>
        {editable && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--color-warm-gray-50)]"
            style={{ borderColor: "var(--color-warm-gray-200)", color: "var(--color-text-secondary)" }}
          >
            <PencilSimple size={14} />
            Edit
          </button>
        )}
      </div>

      {editing && editable ? (
        <EditMode
          def={def}
          data={data}
          action={action!}
          hiddenFields={hiddenFields!}
          onDone={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <ReadMode def={def} data={data} />
      )}
    </div>
  );
}
