"use client";

import { useActionState, useId } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { StepSaveBar } from "@/components/workspace/setup/StepShell";
import { saveSetupAccess, type SaveSetupAccessState } from "./actions";

const initialState: SaveSetupAccessState = {};

export function AccessForm({
  propertyId,
  initial,
  isEditing,
}: {
  propertyId: string;
  initial: Record<string, unknown>;
  isEditing: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveSetupAccess, initialState);
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

      <Section title="Primary entry">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--color-text-tertiary)" }}>
              Primary entry method
            </p>
            <RadioGroup
              name="entry_method"
              options={["Smart lock", "Lockbox", "Key pickup"]}
              defaultValue={initial.entry_method as string | undefined}
              error={err("entry_method")}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextInput name="smart_lock_brand" label="Smart lock brand" defaultValue={initial.smart_lock_brand as string | undefined} placeholder="e.g. Schlage Encode, August, Kwikset, Yale" error={err("smart_lock_brand")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--color-text-tertiary)" }}>
              Admin access shared with hello@myproxyhost.com
            </p>
            <RadioGroup
              name="admin_access_shared"
              options={["Yes", "No"]}
              defaultValue={initial.admin_access_shared as string | undefined}
              error={err("admin_access_shared")}
            />
          </div>
          <TextInput name="backup_key_location" label="Backup key location" defaultValue={initial.backup_key_location as string | undefined} placeholder="e.g. Lockbox on side gate, code 4321" error={err("backup_key_location")} />
        </div>
      </Section>

      <Section title="Codes and access">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInput name="gate_code" label="Gate code" defaultValue={initial.gate_code as string | undefined} placeholder="e.g. #1234" error={err("gate_code")} />
          <TextInput name="garage_code" label="Garage code" defaultValue={initial.garage_code as string | undefined} placeholder="e.g. 5678" error={err("garage_code")} />
          <TextInput name="parking_pass_details" label="Parking pass details" defaultValue={initial.parking_pass_details as string | undefined} placeholder="e.g. 2 passes in kitchen drawer" error={err("parking_pass_details")} />
        </div>
      </Section>

      <Section title="Entry points">
        <div className="flex flex-col gap-4">
          <TextAreaInput
            name="secondary_entry_points"
            label="Secondary entry points"
            defaultValue={initial.secondary_entry_points as string | undefined}
            placeholder="Back door, side gate instructions..."
            error={err("secondary_entry_points")}
          />
          <TextAreaInput
            name="check_in_notes"
            label="Guest check-in notes"
            defaultValue={initial.check_in_notes as string | undefined}
            placeholder="Step-by-step instructions for guests..."
            error={err("check_in_notes")}
          />
        </div>
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
  options,
  defaultValue,
  error,
}: {
  name: string;
  options: string[];
  defaultValue?: string;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
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
              className="inline-flex items-center rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors peer-checked:border-transparent"
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
