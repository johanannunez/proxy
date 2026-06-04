"use client";

import { useState } from "react";
import { CaretRight, CheckCircle, Circle } from "@phosphor-icons/react";
import { DocumentView } from "./DocumentView";
import { computeFormCompletion, type FormDef } from "@/lib/forms/form-registry";
import type { SaveFormState } from "@/lib/forms/save-form";

type SaveAction = (prev: SaveFormState, formData: FormData) => Promise<SaveFormState>;

/**
 * Collapsible disclosure card for one property form. Shared across the client
 * portal and the admin per-workspace tab. The compact header shows the form
 * label and completion; expanding reveals the full all-questions
 * DocumentView, editable inline when an action is provided.
 */
export function DocumentCard({
  def,
  data,
  action,
  hiddenFields,
  defaultOpen = false,
}: {
  def: FormDef;
  data: Record<string, unknown>;
  action?: SaveAction;
  hiddenFields?: Record<string, string>;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const completion = computeFormCompletion(def, data);
  const complete = completion.pct >= 100;
  const started = completion.filled > 0;

  return (
    <div
      className="overflow-hidden rounded-2xl border transition-colors"
      style={{ borderColor: "var(--color-warm-gray-200)", backgroundColor: "var(--color-white)" }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-4 p-5 text-left transition-colors hover:bg-[var(--color-warm-gray-50)]"
        aria-expanded={open}
      >
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{
            backgroundColor: complete ? "rgba(22, 163, 74, 0.12)" : "var(--color-warm-gray-100)",
            color: complete ? "#15803d" : "var(--color-text-tertiary)",
          }}
        >
          {complete ? <CheckCircle size={20} weight="fill" /> : <Circle size={18} weight="duotone" />}
        </span>

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            {def.label}
          </div>
          <div className="mt-0.5 text-xs" style={{ color: "var(--color-text-secondary)" }}>
            {complete
              ? "Complete"
              : started
                ? `${completion.filled} of ${completion.total} fields filled`
                : "Not started"}
          </div>
        </div>

        <span
          className="hidden shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold sm:inline-flex"
          style={{
            backgroundColor: complete ? "rgba(22, 163, 74, 0.12)" : "var(--color-warm-gray-100)",
            color: complete ? "#15803d" : "var(--color-text-secondary)",
          }}
        >
          {completion.pct}%
        </span>

        <CaretRight
          size={16}
          weight="bold"
          className="shrink-0 transition-transform"
          style={{ color: "var(--color-text-tertiary)", transform: open ? "rotate(90deg)" : "none" }}
        />
      </button>

      {open && (
        <div className="border-t px-5 py-5" style={{ borderColor: "var(--color-warm-gray-200)" }}>
          <DocumentView def={def} data={data} action={action} hiddenFields={hiddenFields} hideHeader />
        </div>
      )}
    </div>
  );
}
