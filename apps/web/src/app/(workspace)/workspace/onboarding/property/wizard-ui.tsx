"use client";

import type { ReactNode } from "react";
import { CustomSelect } from "@/components/workspace/CustomSelect";

/**
 * Shared form primitives for the wizard. Keeping these in one file
 * means every section uses identical spacing, focus rings, label
 * weights, and error styling — the kind of consistency that makes a
 * 9-section form feel like one product instead of nine.
 */

const inputBase =
  "w-full rounded-lg border bg-[var(--color-white)] px-4 py-2.5 text-sm outline-none transition-colors focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[rgba(2,170,235,0.16)]";

export function Field({
  label,
  hint,
  required,
  children,
  error,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  error?: string;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span
        className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.12em]"
        style={{ color: "var(--color-text-secondary)" }}
      >
        {label}
        {required ? (
          <span aria-label="required" style={{ color: "var(--color-error)" }}>
            *
          </span>
        ) : null}
      </span>
      {children}
      {hint ? (
        <span
          className="text-[11px]"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          {hint}
        </span>
      ) : null}
      {error ? (
        <span className="text-[11px]" style={{ color: "var(--color-error)" }}>
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  required,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "email" | "tel" | "number" | "date";
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      autoComplete={autoComplete}
      className={inputBase}
      style={{ borderColor: "var(--color-warm-gray-200)" }}
    />
  );
}

export function Select({
  value,
  onChange,
  options,
  placeholder = "Select",
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <CustomSelect
      value={value}
      onChange={onChange}
      required={required}
      options={[{ value: "", label: placeholder }, ...options]}
    />
  );
}

export function Textarea({
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={`${inputBase} resize-y`}
      style={{ borderColor: "var(--color-warm-gray-200)" }}
    />
  );
}

export function ChoicePill({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string; hint?: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className="flex flex-col items-start rounded-xl border px-4 py-3 text-left transition-shadow hover:shadow-[0_10px_24px_-20px_rgba(15,23,42,0.25)]"
            style={{
              backgroundColor: "var(--color-white)",
              borderColor: active
                ? "var(--color-brand)"
                : "var(--color-warm-gray-200)",
              boxShadow: active
                ? "0 0 0 3px rgba(2,170,235,0.12)"
                : undefined,
            }}
          >
            <span
              className="text-sm font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              {o.label}
            </span>
            {o.hint ? (
              <span
                className="mt-0.5 text-[11px]"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {o.hint}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function CheckboxCard({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      role="checkbox"
      aria-checked={checked}
      className="flex items-start gap-3 rounded-xl border p-3 text-left transition-colors"
      style={{
        backgroundColor: checked
          ? "rgba(2, 170, 235, 0.06)"
          : "var(--color-white)",
        borderColor: checked
          ? "var(--color-brand)"
          : "var(--color-warm-gray-200)",
      }}
    >
      <span
        className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border"
        style={{
          backgroundColor: checked ? "var(--color-brand)" : "var(--color-white)",
          borderColor: checked
            ? "var(--color-brand)"
            : "var(--color-warm-gray-400)",
        }}
        aria-hidden="true"
      >
        {checked ? (
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M1 5l3 3 5-6"
              stroke="white"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </span>
      <span className="min-w-0">
        <span
          className="block text-sm font-semibold"
          style={{ color: "var(--color-text-primary)" }}
        >
          {label}
        </span>
        {hint ? (
          <span
            className="mt-0.5 block text-[11px]"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {hint}
          </span>
        ) : null}
      </span>
    </button>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div>
      <p
        className="text-[11px] font-semibold uppercase tracking-[0.18em]"
        style={{ color: "var(--color-brand)" }}
      >
        {eyebrow}
      </p>
      <h2
        className="mt-2 text-2xl font-semibold tracking-tight sm:text-[28px]"
        style={{ color: "var(--color-text-primary)" }}
      >
        {title}
      </h2>
      <p
        className="mt-2 max-w-xl text-sm"
        style={{ color: "var(--color-text-secondary)" }}
      >
        {body}
      </p>
    </div>
  );
}
