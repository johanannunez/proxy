"use client";

import { useActionState, useId } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { StepSaveBar } from "@/components/workspace/setup/StepShell";
import { saveSetupHouseRules, type SaveSetupHouseRulesState } from "./actions";

const initialState: SaveSetupHouseRulesState = {};

export function HouseRulesForm({
  propertyId,
  initial,
  isEditing,
}: {
  propertyId: string;
  initial: Record<string, unknown>;
  isEditing: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveSetupHouseRules, initialState);
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
        <div className="flex flex-col gap-6">
          <RadioGroup
            name="pets_policy"
            label="Pets"
            options={[
              { value: "Allowed", label: "Allowed" },
              { value: "Not allowed", label: "Not allowed" },
              { value: "Case by case", label: "Case by case" },
            ]}
            defaultValue={initial.pets_policy as string | undefined}
          />
          <TextInput
            name="pets_notes"
            label="Pet conditions/restrictions"
            placeholder="e.g. Small dogs only, max 25 lbs, $50 pet fee"
            defaultValue={initial.pets_notes as string | undefined}
            error={err("pets_notes")}
          />
          <RadioGroup
            name="events_allowed"
            label="Events and parties allowed?"
            options={[
              { value: "Yes", label: "Yes" },
              { value: "No", label: "No" },
            ]}
            defaultValue={initial.events_allowed as string | undefined}
          />
          <RadioGroup
            name="smoking_policy"
            label="Smoking"
            options={[
              { value: "Inside", label: "Inside" },
              { value: "Outside only", label: "Outside only" },
              { value: "Not allowed", label: "Not allowed" },
            ]}
            defaultValue={initial.smoking_policy as string | undefined}
          />
          <TextInput
            name="noise_curfew"
            label="Noise curfew time"
            placeholder="e.g. 10 PM"
            defaultValue={initial.noise_curfew as string | undefined}
            error={err("noise_curfew")}
          />
        </div>
      </Section>

      <Section title="Occupancy and booking">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TextInput
            name="max_occupancy"
            label="Max occupancy (if different from max guests)"
            defaultValue={initial.max_occupancy as string | undefined}
            error={err("max_occupancy")}
          />
          <TextInput
            name="min_guest_age"
            label="Minimum guest age to book"
            placeholder="e.g. 25"
            defaultValue={initial.min_guest_age as string | undefined}
            error={err("min_guest_age")}
          />
          <TextInput
            name="min_night_stay"
            label="Minimum night stay preference"
            placeholder="e.g. 2 nights weekdays, 3 nights weekends"
            defaultValue={initial.min_night_stay as string | undefined}
            error={err("min_night_stay")}
          />
        </div>
      </Section>

      <Section title="Parking">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInput
            name="parking_car_count"
            label="Max cars allowed"
            placeholder="e.g. 2"
            defaultValue={initial.parking_car_count as string | undefined}
            error={err("parking_car_count")}
          />
          <TextInput
            name="parking_locations"
            label="Parking locations"
            placeholder="e.g. 2-car garage + 1 street spot"
            defaultValue={initial.parking_locations as string | undefined}
            error={err("parking_locations")}
          />
        </div>
      </Section>

      <Section title="Amenity hours">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInput
            name="pool_hours"
            label="Pool hours (if applicable)"
            placeholder="e.g. 8am - 10pm"
            defaultValue={initial.pool_hours as string | undefined}
            error={err("pool_hours")}
          />
          <TextInput
            name="hot_tub_hours"
            label="Hot tub hours (if applicable)"
            placeholder="e.g. 7am - 11pm"
            defaultValue={initial.hot_tub_hours as string | undefined}
            error={err("hot_tub_hours")}
          />
        </div>
      </Section>

      <Section title="Custom rules">
        <TextArea
          name="custom_rules"
          label="Additional custom rules"
          placeholder="e.g. No shoes inside. Use only the provided cleaning products on wood floors. Do not move furniture."
          defaultValue={initial.custom_rules as string | undefined}
          rows={5}
          helpText="These will be included in your listing house rules and guest check-in instructions."
        />
      </Section>

      <StepSaveBar pending={pending} isEditing={isEditing} />
    </form>
  );
}

function Section({
  title,
  children,
  helpText,
}: {
  title: string;
  children: React.ReactNode;
  helpText?: string;
}) {
  return (
    <section
      className="rounded-2xl border p-6"
      style={{ borderColor: "var(--color-warm-gray-200)", backgroundColor: "var(--color-white)" }}
    >
      <h2
        className="mb-4 text-base font-semibold tracking-tight"
        style={{ color: "var(--color-text-primary)" }}
      >
        {title}
      </h2>
      {helpText && (
        <p className="mb-4 text-[13px]" style={{ color: "var(--color-text-tertiary)" }}>
          {helpText}
        </p>
      )}
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
  helpText,
}: {
  name: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  error?: string;
  type?: string;
  helpText?: string;
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
      {helpText && (
        <p className="text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
          {helpText}
        </p>
      )}
      {error ? (
        <p className="flex items-center gap-1 text-[12px] font-medium" style={{ color: "#c0372a" }}>
          <WarningCircle size={12} weight="fill" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

function TextArea({
  name,
  label,
  placeholder,
  defaultValue,
  rows = 3,
  helpText,
}: {
  name: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  rows?: number;
  helpText?: string;
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
        rows={rows}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 resize-none"
        style={{
          borderColor: "var(--color-warm-gray-200)",
          backgroundColor: "var(--color-white)",
          color: "var(--color-text-primary)",
        }}
      />
      {helpText && (
        <p className="text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
          {helpText}
        </p>
      )}
    </div>
  );
}

function RadioGroup({
  name,
  label,
  options,
  defaultValue,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
}) {
  return (
    <fieldset>
      <legend
        className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        {label}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <label key={opt.value} className="relative cursor-pointer">
            <input
              type="radio"
              name={name}
              value={opt.value}
              defaultChecked={defaultValue === opt.value}
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
              {opt.label}
            </span>
          </label>
        ))}
      </div>
      <style>{`
        [data-radio-pill] { transition: background-color 0.15s, color 0.15s, border-color 0.15s; }
        input[type="radio"]:checked + [data-radio-pill] {
          background-color: var(--color-text-primary);
          color: var(--color-white);
          border-color: var(--color-text-primary);
        }
      `}</style>
    </fieldset>
  );
}
