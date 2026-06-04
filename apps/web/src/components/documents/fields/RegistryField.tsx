"use client";

import { useId } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import type { FieldDef } from "@/lib/forms/form-registry";

const labelCls =
  "text-[12px] font-semibold uppercase tracking-[0.08em]";
const labelStyle = { color: "var(--color-text-tertiary)" } as const;

function inputStyle(error?: string) {
  return {
    borderColor: error ? "#e3867a" : "var(--color-warm-gray-200)",
    backgroundColor: "var(--color-white)",
    color: "var(--color-text-primary)",
  } as const;
}

function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p className="flex items-center gap-1 text-[12px] font-medium" style={{ color: "#c0372a" }}>
      <WarningCircle size={12} weight="fill" />
      {error}
    </p>
  );
}

function FieldHelp({ help }: { help?: string }) {
  if (!help) return null;
  return (
    <p className="text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
      {help}
    </p>
  );
}

/**
 * Renders a single editable input driven by a registry FieldDef. Generalizes
 * the TextInput / TextAreaInput / RadioGroup primitives from the bespoke
 * setup forms and adds select / number / date / tel / email.
 */
export function RegistryField({
  field,
  defaultValue,
  error,
}: {
  field: FieldDef;
  defaultValue?: string | null;
  error?: string;
}) {
  const id = useId();
  const value = defaultValue ?? undefined;

  const label = (
    <label htmlFor={id} className={labelCls} style={labelStyle}>
      {field.label}
      {field.required ? <span style={{ color: "#c0372a" }}> *</span> : null}
    </label>
  );

  if (field.type === "textarea") {
    return (
      <div className="flex flex-col gap-1.5">
        {label}
        <textarea
          id={id}
          name={field.key}
          defaultValue={value}
          placeholder={field.placeholder}
          rows={4}
          maxLength={field.maxLength ?? 500}
          aria-invalid={Boolean(error)}
          className="resize-none rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2"
          style={inputStyle(error)}
        />
        <FieldHelp help={field.help} />
        <FieldError error={error} />
      </div>
    );
  }

  if (field.type === "radio") {
    return (
      <div className="flex flex-col gap-1.5">
        {label}
        <div className="flex flex-wrap gap-2">
          {(field.options ?? []).map((opt) => (
            <label key={opt} className="relative cursor-pointer">
              <input
                type="radio"
                name={field.key}
                value={opt}
                defaultChecked={value === opt}
                className="peer sr-only"
              />
              <span
                className="inline-flex items-center rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors peer-checked:border-transparent"
                style={{ borderColor: "var(--color-warm-gray-200)", color: "var(--color-text-secondary)" }}
                data-radio-pill
              >
                {opt}
              </span>
            </label>
          ))}
        </div>
        <FieldHelp help={field.help} />
        <FieldError error={error} />
        <style>{`
          [data-radio-pill] { transition: background-color 0.15s, color 0.15s, border-color 0.15s; }
          input[type="radio"]:checked + [data-radio-pill] {
            background-color: var(--color-text-primary);
            color: var(--color-white);
            border-color: var(--color-text-primary);
          }
        `}</style>
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div className="flex flex-col gap-1.5">
        {label}
        <select
          id={id}
          name={field.key}
          defaultValue={value ?? ""}
          aria-invalid={Boolean(error)}
          className="rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2"
          style={inputStyle(error)}
        >
          <option value="">{field.placeholder ?? "Select…"}</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <FieldHelp help={field.help} />
        <FieldError error={error} />
      </div>
    );
  }

  const htmlType =
    field.type === "number"
      ? "text"
      : field.type === "tel"
        ? "tel"
        : field.type === "email"
          ? "email"
          : field.type === "date"
            ? "date"
            : "text";

  return (
    <div className="flex flex-col gap-1.5">
      {label}
      <input
        id={id}
        name={field.key}
        type={htmlType}
        inputMode={field.type === "number" ? "numeric" : undefined}
        defaultValue={value}
        placeholder={field.placeholder}
        maxLength={field.maxLength ?? 500}
        aria-invalid={Boolean(error)}
        className="rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2"
        style={{ ...inputStyle(error), fontFamily: field.sensitive ? "ui-monospace, monospace" : undefined }}
      />
      <FieldHelp help={field.help} />
      <FieldError error={error} />
    </div>
  );
}
