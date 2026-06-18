"use client";

import { useActionState, useId } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { StepSaveBar } from "@/components/workspace/setup/StepShell";
import { saveSetupAppliances, type SaveSetupAppliancesState } from "./actions";

const initialState: SaveSetupAppliancesState = {};

export function AppliancesForm({
  propertyId,
  initial,
  isEditing,
}: {
  propertyId: string;
  initial: Record<string, unknown>;
  isEditing: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveSetupAppliances, initialState);
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

      <Section title="Laundry">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInput name="washer_location" label="Washer location" defaultValue={initial.washer_location as string | undefined} placeholder="e.g. Laundry room off hallway" error={err("washer_location")} />
          <TextInput name="washer_brand" label="Washer brand" defaultValue={initial.washer_brand as string | undefined} error={err("washer_brand")} />
          <div className="sm:col-span-2">
            <TextAreaInput
              name="washer_instructions"
              label="Washer special instructions"
              defaultValue={initial.washer_instructions as string | undefined}
              placeholder="e.g. Cold water only, do not use pods"
              error={err("washer_instructions")}
            />
          </div>
          <TextInput name="dryer_location" label="Dryer location" defaultValue={initial.dryer_location as string | undefined} error={err("dryer_location")} />
          <TextInput name="dryer_brand" label="Dryer brand" defaultValue={initial.dryer_brand as string | undefined} error={err("dryer_brand")} />
          <div className="sm:col-span-2">
            <TextAreaInput
              name="dryer_instructions"
              label="Dryer special instructions"
              defaultValue={initial.dryer_instructions as string | undefined}
              error={err("dryer_instructions")}
            />
          </div>
        </div>
      </Section>

      <Section title="Kitchen appliances">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--color-text-tertiary)" }}>
              Has dishwasher?
            </p>
            <RadioGroup
              name="has_dishwasher"
              options={["Yes", "No"]}
              defaultValue={initial.has_dishwasher as string | undefined}
              error={err("has_dishwasher")}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextInput name="refrigerator_brand" label="Refrigerator brand" defaultValue={initial.refrigerator_brand as string | undefined} error={err("refrigerator_brand")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--color-text-tertiary)" }}>
              Has coffee maker?
            </p>
            <RadioGroup
              name="has_coffee_maker"
              options={["Yes", "No"]}
              defaultValue={initial.has_coffee_maker as string | undefined}
              error={err("has_coffee_maker")}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextInput name="coffee_maker_type" label="Coffee maker brand/type" defaultValue={initial.coffee_maker_type as string | undefined} placeholder="e.g. Keurig K-Duo, Nespresso Vertuo" error={err("coffee_maker_type")} />
          </div>
        </div>
      </Section>

      <Section title="Other appliances">
        <TextAreaInput
          name="other_appliances"
          label="Other notable appliances"
          defaultValue={initial.other_appliances as string | undefined}
          placeholder="e.g. Instant Pot (pantry shelf), KitchenAid mixer (cabinet above fridge)"
          error={err("other_appliances")}
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
        rows={3}
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
