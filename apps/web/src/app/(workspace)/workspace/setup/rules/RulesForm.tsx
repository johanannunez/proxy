"use client";

import { useActionState, useId, useState } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { StepSaveBar } from "@/components/workspace/setup/StepShell";
import { saveRules, type SaveRulesState } from "./actions";

type RulesInitial = {
  pets?: string;
  pets_note?: string;
  smoking?: string;
  events?: string;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  check_in_time?: string;
  check_out_time?: string;
  additional_rules?: string;
  backup_key_location?: string;
  lockbox_code?: string;
  gate_code?: string;
  access_instructions?: string;
};

const initialState: SaveRulesState = {};

export function RulesForm({
  propertyId,
  initial,
  isEditing,
}: {
  propertyId: string;
  initial: RulesInitial;
  isEditing: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveRules, initialState);
  const [pets, setPets] = useState(initial.pets ?? "");

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

      <Section title="Guest policies">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <RadioGroup
            name="pets"
            label="Pets allowed?"
            options={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
              { value: "conditional", label: "Conditional" },
            ]}
            defaultValue={initial.pets}
            onChange={setPets}
          />
          <RadioGroup
            name="smoking"
            label="Smoking allowed?"
            options={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
            ]}
            defaultValue={initial.smoking}
          />
          <RadioGroup
            name="events"
            label="Events allowed?"
            options={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
            ]}
            defaultValue={initial.events}
          />
        </div>
        {pets === "conditional" && (
          <div className="mt-4">
            <TextInput
              name="pets_note"
              label="Pet conditions"
              defaultValue={initial.pets_note}
              placeholder="e.g. Small dogs only, $50 pet fee, max 2 pets"
              error={err("pets_note")}
            />
          </div>
        )}
      </Section>

      <Section title="Timing">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TimeInput name="check_in_time" label="Check-in time" defaultValue={initial.check_in_time ?? "15:00"} />
          <TimeInput name="check_out_time" label="Check-out time" defaultValue={initial.check_out_time ?? "11:00"} />
          <TimeInput name="quiet_hours_start" label="Quiet hours start" defaultValue={initial.quiet_hours_start ?? "22:00"} />
          <TimeInput name="quiet_hours_end" label="Quiet hours end" defaultValue={initial.quiet_hours_end ?? "08:00"} />
        </div>
      </Section>

      <Section title="Additional rules">
        <textarea
          name="additional_rules"
          rows={4}
          defaultValue={initial.additional_rules ?? ""}
          placeholder="Any other rules guests should know about..."
          className="w-full rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2"
          style={{
            borderColor: "var(--color-warm-gray-200)",
            backgroundColor: "var(--color-white)",
            color: "var(--color-text-primary)",
          }}
        />
      </Section>

      <Section title="Access information">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInput name="lockbox_code" label="Lockbox code" defaultValue={initial.lockbox_code} placeholder="e.g. 1234" error={err("lockbox_code")} />
          <TextInput name="gate_code" label="Gate code" defaultValue={initial.gate_code} placeholder="e.g. #5678" error={err("gate_code")} />
          <TextInput name="backup_key_location" label="Backup key location" defaultValue={initial.backup_key_location} placeholder="Under the doormat, left side" error={err("backup_key_location")} />
        </div>
        <div className="mt-4">
          <label
            className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Access instructions
          </label>
          <textarea
            name="access_instructions"
            rows={3}
            defaultValue={initial.access_instructions ?? ""}
            placeholder="Step by step instructions for entering the property..."
            className="w-full rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2"
            style={{
              borderColor: "var(--color-warm-gray-200)",
              backgroundColor: "var(--color-white)",
              color: "var(--color-text-primary)",
            }}
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

function RadioGroup({
  name,
  label,
  options,
  defaultValue,
  onChange,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  onChange?: (v: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--color-text-tertiary)" }}>
        {label}
      </legend>
      <div className="flex gap-2">
        {options.map((opt) => (
          <label
            key={opt.value}
            className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-[var(--color-warm-gray-50)]"
            style={{ borderColor: "var(--color-warm-gray-200)", color: "var(--color-text-primary)" }}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              defaultChecked={defaultValue === opt.value}
              onChange={() => onChange?.(opt.value)}
              className="accent-[var(--color-brand)]"
            />
            {opt.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function TimeInput({ name, label, defaultValue }: { name: string; label: string; defaultValue?: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--color-text-tertiary)" }}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="time"
        defaultValue={defaultValue}
        className="rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2"
        style={{ borderColor: "var(--color-warm-gray-200)", backgroundColor: "var(--color-white)", color: "var(--color-text-primary)" }}
      />
    </div>
  );
}

function TextInput({
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
      <label htmlFor={id} className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--color-text-tertiary)" }}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="text"
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
