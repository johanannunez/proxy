"use client";

import { useActionState, useId } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { StepSaveBar } from "@/components/workspace/setup/StepShell";
import { saveSetupAmenities, type SaveSetupAmenitiesState } from "./actions";

const initialState: SaveSetupAmenitiesState = {};

export function AmenitiesForm({
  propertyId,
  initial,
  isEditing,
}: {
  propertyId: string;
  initial: Record<string, unknown>;
  isEditing: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveSetupAmenities, initialState);
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

      <Section title="Pool">
        <div className="flex flex-col gap-5">
          <RadioGroup
            name="has_pool"
            label="Has pool?"
            options={[
              { value: "Yes", label: "Yes" },
              { value: "No", label: "No" },
            ]}
            defaultValue={initial.has_pool as string | undefined}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextInput
              name="pool_heating_type"
              label="Pool heating type"
              placeholder="e.g. Solar, Gas, Heat pump"
              defaultValue={initial.pool_heating_type as string | undefined}
              error={err("pool_heating_type")}
            />
            <TextInput
              name="pool_cover_type"
              label="Cover type"
              placeholder="e.g. Manual reel, Electric, Safety cover"
              defaultValue={initial.pool_cover_type as string | undefined}
              error={err("pool_cover_type")}
            />
            <TextInput
              name="pool_chemical_service_company"
              label="Chemical service company"
              defaultValue={initial.pool_chemical_service_company as string | undefined}
              error={err("pool_chemical_service_company")}
            />
            <TextInput
              name="pool_chemical_service_phone"
              label="Service company phone"
              defaultValue={initial.pool_chemical_service_phone as string | undefined}
              error={err("pool_chemical_service_phone")}
            />
            <TextInput
              name="pool_chemical_schedule"
              label="Service schedule"
              placeholder="e.g. Weekly on Tuesdays"
              defaultValue={initial.pool_chemical_schedule as string | undefined}
              error={err("pool_chemical_schedule")}
            />
          </div>
        </div>
      </Section>

      <Section title="Hot tub">
        <div className="flex flex-col gap-5">
          <RadioGroup
            name="has_hot_tub"
            label="Has hot tub?"
            options={[
              { value: "Yes", label: "Yes" },
              { value: "No", label: "No" },
            ]}
            defaultValue={initial.has_hot_tub as string | undefined}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextInput
              name="hot_tub_heating_type"
              label="Heating type"
              placeholder="e.g. Electric, Gas"
              defaultValue={initial.hot_tub_heating_type as string | undefined}
              error={err("hot_tub_heating_type")}
            />
            <TextInput
              name="hot_tub_chemical_service_company"
              label="Chemical service company"
              defaultValue={initial.hot_tub_chemical_service_company as string | undefined}
              error={err("hot_tub_chemical_service_company")}
            />
            <TextInput
              name="hot_tub_chemical_service_phone"
              label="Service company phone"
              defaultValue={initial.hot_tub_chemical_service_phone as string | undefined}
              error={err("hot_tub_chemical_service_phone")}
            />
          </div>
        </div>
      </Section>

      <Section title="Outdoor cooking">
        <div className="flex flex-col gap-5">
          <RadioGroup
            name="bbq_type"
            label="BBQ/grill type"
            options={[
              { value: "Propane", label: "Propane" },
              { value: "Natural gas", label: "Natural gas" },
              { value: "Charcoal", label: "Charcoal" },
              { value: "None", label: "None" },
            ]}
            defaultValue={initial.bbq_type as string | undefined}
          />
          <TextInput
            name="bbq_propane_note"
            label="Propane tanks note"
            placeholder="e.g. 2 tanks in garage, swap via Blue Rhino"
            defaultValue={initial.bbq_propane_note as string | undefined}
            error={err("bbq_propane_note")}
          />
        </div>
      </Section>

      <Section title="Other outdoor features">
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <RadioGroup
                name="has_fire_pit"
                label="Has fire pit?"
                options={[
                  { value: "Yes", label: "Yes" },
                  { value: "No", label: "No" },
                ]}
                defaultValue={initial.has_fire_pit as string | undefined}
              />
              <TextInput
                name="fire_pit_type"
                label="Fire pit type"
                placeholder="e.g. Wood burning, Gas"
                defaultValue={initial.fire_pit_type as string | undefined}
                error={err("fire_pit_type")}
              />
            </div>
            <div className="flex flex-col gap-5">
              <RadioGroup
                name="has_outdoor_shower"
                label="Has outdoor shower?"
                options={[
                  { value: "Yes", label: "Yes" },
                  { value: "No", label: "No" },
                ]}
                defaultValue={initial.has_outdoor_shower as string | undefined}
              />
              <RadioGroup
                name="has_sauna"
                label="Has sauna?"
                options={[
                  { value: "Yes", label: "Yes" },
                  { value: "No", label: "No" },
                ]}
                defaultValue={initial.has_sauna as string | undefined}
              />
            </div>
          </div>
          <TextArea
            name="other_amenities"
            label="Other outdoor amenities"
            placeholder="e.g. Hammock between oak trees, bocce ball court, putting green"
            defaultValue={initial.other_amenities as string | undefined}
            rows={3}
          />
        </div>
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
