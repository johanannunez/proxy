"use client";

import { useActionState, useId } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { StepSaveBar } from "@/components/workspace/setup/StepShell";
import { saveSetupUtilities, type SaveSetupUtilitiesState } from "./actions";

const initialState: SaveSetupUtilitiesState = {};

export function UtilitiesForm({
  propertyId,
  initial,
  isEditing,
}: {
  propertyId: string;
  initial: Record<string, unknown>;
  isEditing: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveSetupUtilities, initialState);
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

      <Section title="Electric and gas">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInput name="electric_provider" label="Electric provider" defaultValue={initial.electric_provider as string | undefined} placeholder="e.g. PG&E, Xcel Energy" error={err("electric_provider")} />
          <TextInput name="electric_account_number" label="Electric account number" defaultValue={initial.electric_account_number as string | undefined} error={err("electric_account_number")} />
          <TextInput name="gas_provider" label="Gas provider" defaultValue={initial.gas_provider as string | undefined} placeholder="e.g. SoCalGas, or 'No gas'" error={err("gas_provider")} />
          <TextInput name="gas_account_number" label="Gas account number" defaultValue={initial.gas_account_number as string | undefined} error={err("gas_account_number")} />
        </div>
      </Section>

      <Section title="Water and trash">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInput name="water_provider" label="Water provider" defaultValue={initial.water_provider as string | undefined} error={err("water_provider")} />
          <TextInput name="water_account_number" label="Water account number" defaultValue={initial.water_account_number as string | undefined} error={err("water_account_number")} />
          <TextInput name="trash_pickup_days" label="Trash pickup days" defaultValue={initial.trash_pickup_days as string | undefined} placeholder="e.g. Monday (trash), Thursday (recycling)" error={err("trash_pickup_days")} />
          <TextInput name="bin_location" label="Bin location" defaultValue={initial.bin_location as string | undefined} placeholder="e.g. Left side of garage" error={err("bin_location")} />
        </div>
      </Section>

      <Section title="Systems">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInput name="breaker_panel_location" label="Breaker panel location" defaultValue={initial.breaker_panel_location as string | undefined} placeholder="e.g. Garage, left wall" error={err("breaker_panel_location")} />
          <TextInput name="hvac_brand" label="HVAC brand" defaultValue={initial.hvac_brand as string | undefined} error={err("hvac_brand")} />
          <TextInput name="hvac_filter_size" label="HVAC filter size" defaultValue={initial.hvac_filter_size as string | undefined} placeholder="e.g. 16x25x1" error={err("hvac_filter_size")} />
          <TextInput name="hvac_filter_interval" label="Filter replacement interval" defaultValue={initial.hvac_filter_interval as string | undefined} placeholder="e.g. Every 3 months" error={err("hvac_filter_interval")} />
          <TextInput name="hvac_service_company" label="HVAC service company" defaultValue={initial.hvac_service_company as string | undefined} error={err("hvac_service_company")} />
          <TextInput name="hvac_service_phone" label="HVAC service phone" defaultValue={initial.hvac_service_phone as string | undefined} error={err("hvac_service_phone")} />
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--color-text-tertiary)" }}>
            Water heater type
          </p>
          <RadioGroup
            name="water_heater_type"
            options={["Tank", "Tankless", "Heat pump"]}
            defaultValue={initial.water_heater_type as string | undefined}
            error={err("water_heater_type")}
          />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInput name="water_heater_location" label="Water heater location" defaultValue={initial.water_heater_location as string | undefined} error={err("water_heater_location")} />
        </div>
      </Section>

      <Section title="Safety equipment">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextAreaInput
            name="smoke_detector_locations"
            label="Smoke detector locations"
            defaultValue={initial.smoke_detector_locations as string | undefined}
            placeholder="e.g. Kitchen, Master bedroom, Hallway"
            error={err("smoke_detector_locations")}
          />
          <TextAreaInput
            name="co_detector_locations"
            label="CO detector locations"
            defaultValue={initial.co_detector_locations as string | undefined}
            placeholder="e.g. Hallway outside bedrooms"
            error={err("co_detector_locations")}
          />
          <TextInput name="first_aid_kit_location" label="First aid kit location" defaultValue={initial.first_aid_kit_location as string | undefined} placeholder="e.g. Under kitchen sink" error={err("first_aid_kit_location")} />
          <TextInput name="fire_extinguisher_location" label="Fire extinguisher location" defaultValue={initial.fire_extinguisher_location as string | undefined} placeholder="e.g. Kitchen, near stove" error={err("fire_extinguisher_location")} />
          <TextInput name="fire_extinguisher_last_inspection" label="Last inspection date" defaultValue={initial.fire_extinguisher_last_inspection as string | undefined} placeholder="e.g. Jan 2025" error={err("fire_extinguisher_last_inspection")} />
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
