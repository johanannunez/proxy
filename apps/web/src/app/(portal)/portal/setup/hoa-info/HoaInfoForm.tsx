"use client";

import { useActionState, useId, useRef, useState } from "react";
import { WarningCircle, Paperclip, ArrowSquareOut, X } from "@phosphor-icons/react";
import { StepSaveBar } from "@/components/portal/setup/StepShell";
import { saveHoaInfo, type SaveHoaInfoState } from "./actions";

const initialState: SaveHoaInfoState = {};

export function HoaInfoForm({
  propertyId,
  initial,
  isEditing,
}: {
  propertyId: string;
  initial: Record<string, unknown>;
  isEditing: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveHoaInfo, initialState);
  const err = (key: string) => state.fieldErrors?.[key];

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <input type="hidden" name="property_id" value={propertyId} />

      {state.error ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border px-4 py-3.5 text-sm"
          style={{ borderColor: "#f1c4c4", backgroundColor: "#fdf4f4", color: "#8a1f1f" }}
        >
          <WarningCircle size={18} weight="fill" style={{ color: "#c0372a" }} />
          <span>{state.error}</span>
        </div>
      ) : null}

      <Section title="HOA status">
        <RadioGroup
          name="has_hoa"
          label="Does the property have an HOA?"
          options={["Yes", "No"]}
          defaultValue={initial.has_hoa as string | undefined}
          error={err("has_hoa")}
        />
      </Section>

      <Section title="HOA contact">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextInput
              name="hoa_name"
              label="HOA name"
              placeholder="e.g. Sunrise Estates HOA"
              defaultValue={initial.hoa_name as string | undefined}
              error={err("hoa_name")}
            />
            <TextInput
              name="management_company"
              label="Management company"
              placeholder="e.g. FirstService Residential"
              defaultValue={initial.management_company as string | undefined}
              error={err("management_company")}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextInput
              name="contact_name"
              label="Contact name"
              defaultValue={initial.contact_name as string | undefined}
              error={err("contact_name")}
            />
            <TextInput
              name="contact_phone"
              label="Contact phone"
              placeholder="e.g. 555-000-0000"
              defaultValue={initial.contact_phone as string | undefined}
              error={err("contact_phone")}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextInput
              name="contact_email"
              label="Contact email"
              placeholder="e.g. manager@hoa.com"
              defaultValue={initial.contact_email as string | undefined}
              error={err("contact_email")}
            />
          </div>
        </div>
      </Section>

      <Section title="STR policy">
        <div className="flex flex-col gap-4">
          <RadioGroup
            name="str_allowed"
            label="STR allowed by HOA?"
            options={["Yes", "No", "Unknown"]}
            defaultValue={initial.str_allowed as string | undefined}
            error={err("str_allowed")}
          />
          <TextAreaInput
            name="key_restrictions"
            label="Key restrictions"
            placeholder="Parking limits, guest limits, quiet hours, etc."
            defaultValue={initial.key_restrictions as string | undefined}
            error={err("key_restrictions")}
          />
        </div>
      </Section>

      <Section title="CC&amp;Rs document">
        <FileUpload
          name="ccrs_pdf"
          existingUrl={initial.ccrs_pdf_url as string | undefined}
          label="Upload your HOA's CC&Rs or rules document (optional)"
          hint="PDF, JPG, or PNG — max 10 MB"
        />
      </Section>

      <StepSaveBar pending={pending} isEditing={isEditing} />
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      className="rounded-2xl border p-6"
      style={{ borderColor: "var(--color-warm-gray-200)", backgroundColor: "var(--color-white)" }}
    >
      <h2 className="mb-4 text-base font-semibold tracking-tight" style={{ color: "var(--color-text-primary)" }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function TextInput({
  name,
  label,
  placeholder,
  defaultValue,
  error,
  type = "text",
}: {
  name: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  error?: string;
  type?: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-[12px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        className="rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2"
        style={{
          borderColor: error ? "#e3867a" : "var(--color-warm-gray-200)",
          backgroundColor: "var(--color-white)",
          color: "var(--color-text-primary)",
        }}
      />
      {error ? (
        <p className="flex items-center gap-1 text-[12px] font-medium" style={{ color: "#c0372a" }}>
          <WarningCircle size={12} weight="fill" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

function TextAreaInput({
  name,
  label,
  placeholder,
  defaultValue,
  error,
}: {
  name: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  error?: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-[12px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        rows={4}
        aria-invalid={Boolean(error)}
        className="rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 resize-none"
        style={{
          borderColor: error ? "#e3867a" : "var(--color-warm-gray-200)",
          backgroundColor: "var(--color-white)",
          color: "var(--color-text-primary)",
        }}
      />
      {error ? (
        <p className="flex items-center gap-1 text-[12px] font-medium" style={{ color: "#c0372a" }}>
          <WarningCircle size={12} weight="fill" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

function RadioGroup({
  name,
  label,
  options,
  defaultValue,
  error,
}: {
  name: string;
  label?: string;
  options: string[];
  defaultValue?: string;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <p
          className="mb-1 text-sm"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {label}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <label key={opt} className="relative cursor-pointer">
            <input
              type="radio"
              name={name}
              value={opt}
              defaultChecked={defaultValue === opt}
              className="peer sr-only"
            />
            <span
              className="inline-flex items-center rounded-full border px-3.5 py-1.5 text-sm font-medium"
              style={{
                borderColor: "var(--color-warm-gray-200)",
                color: "var(--color-text-secondary)",
              }}
              data-radio-pill
            >
              {opt}
            </span>
          </label>
        ))}
      </div>
      {error ? (
        <p className="flex items-center gap-1 text-[12px] font-medium" style={{ color: "#c0372a" }}>
          <WarningCircle size={12} weight="fill" />
          {error}
        </p>
      ) : null}
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

function FileUpload({
  name,
  existingUrl,
  label,
  hint,
}: {
  name: string;
  existingUrl?: string;
  label: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<File | null>(null);
  const [cleared, setCleared] = useState(false);

  const hasExisting = existingUrl && !cleared;
  const existingName = existingUrl
    ? decodeURIComponent(existingUrl.split("/").pop() ?? "document").replace(/^\d+-/, "")
    : null;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>{label}</p>

      {hasExisting && !picked ? (
        <div
          className="flex items-center gap-3 rounded-xl border px-4 py-3"
          style={{ borderColor: "var(--color-warm-gray-200)", backgroundColor: "var(--color-surface-elevated)" }}
        >
          <Paperclip size={16} style={{ color: "var(--color-brand)", flexShrink: 0 }} />
          <span className="flex-1 truncate text-sm" style={{ color: "var(--color-text-primary)" }}>
            {existingName}
          </span>
          <a
            href={existingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs font-medium"
            style={{ color: "var(--color-brand)" }}
          >
            View <ArrowSquareOut size={13} />
          </a>
          <button
            type="button"
            onClick={() => setCleared(true)}
            className="ml-1 rounded p-0.5 hover:opacity-60"
            aria-label="Remove document"
          >
            <X size={14} style={{ color: "var(--color-text-tertiary)" }} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center hover:opacity-80"
          style={{ borderColor: "var(--color-warm-gray-300)", backgroundColor: "var(--color-surface-elevated)" }}
        >
          <Paperclip size={20} style={{ color: "var(--color-text-tertiary)" }} />
          {picked ? (
            <span className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
              {picked.name}
            </span>
          ) : (
            <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              Click to upload
            </span>
          )}
          {hint && !picked ? (
            <span className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>{hint}</span>
          ) : null}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        name={name}
        accept=".pdf,.jpg,.jpeg,.png"
        className="sr-only"
        onChange={(e) => setPicked(e.target.files?.[0] ?? null)}
      />
      <input type="hidden" name={`existing_${name}_url`} value={cleared ? "" : (existingUrl ?? "")} />
    </div>
  );
}
