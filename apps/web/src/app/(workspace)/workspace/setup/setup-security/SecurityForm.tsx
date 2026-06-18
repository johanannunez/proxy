"use client";

import { useActionState, useId } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { StepSaveBar } from "@/components/workspace/setup/StepShell";
import { saveSetupSecurity, type SaveSetupSecurityState } from "./actions";

const initialState: SaveSetupSecurityState = {};

export function SecurityForm({
  propertyId,
  initial,
  isEditing,
}: {
  propertyId: string;
  initial: Record<string, unknown>;
  isEditing: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveSetupSecurity, initialState);
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

      <Section title="Security system">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--color-text-tertiary)" }}>
              Has security system?
            </p>
            <RadioGroup
              name="has_security_system"
              options={["Yes", "No"]}
              defaultValue={initial.has_security_system as string | undefined}
              error={err("has_security_system")}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextInput name="system_brand" label="System brand" defaultValue={initial.system_brand as string | undefined} placeholder="e.g. ADT, Ring, SimpliSafe, Brinks" error={err("system_brand")} />
            <TextInput name="panel_location" label="Panel location" defaultValue={initial.panel_location as string | undefined} placeholder="e.g. Hallway closet near front door" error={err("panel_location")} />
            <TextInput name="arm_disarm_code" label="Arm/disarm code" defaultValue={initial.arm_disarm_code as string | undefined} error={err("arm_disarm_code")} />
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
        </div>
      </Section>

      <Section title="Monitoring company">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInput name="monitoring_company_name" label="Monitoring company name" defaultValue={initial.monitoring_company_name as string | undefined} error={err("monitoring_company_name")} />
          <TextInput name="monitoring_company_phone" label="Monitoring company phone" defaultValue={initial.monitoring_company_phone as string | undefined} error={err("monitoring_company_phone")} />
        </div>
      </Section>

      <Section title="Sensors">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--color-text-tertiary)" }}>
              Window/door sensors or chimes?
            </p>
            <RadioGroup
              name="has_sensors"
              options={["Yes", "No"]}
              defaultValue={initial.has_sensors as string | undefined}
              error={err("has_sensors")}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextInput name="sensor_battery_type" label="Sensor battery type" defaultValue={initial.sensor_battery_type as string | undefined} placeholder="e.g. CR123A, AA" error={err("sensor_battery_type")} />
            <TextInput name="sensor_battery_amazon_link" label="Amazon purchase link for batteries" defaultValue={initial.sensor_battery_amazon_link as string | undefined} placeholder="https://..." error={err("sensor_battery_amazon_link")} />
            <TextInput name="battery_storage_location" label="Battery storage location" defaultValue={initial.battery_storage_location as string | undefined} placeholder="e.g. Junk drawer in kitchen" error={err("battery_storage_location")} />
          </div>
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
