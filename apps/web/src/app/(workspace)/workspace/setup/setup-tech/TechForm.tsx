"use client";

import { useActionState, useId } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { StepSaveBar } from "@/components/workspace/setup/StepShell";
import { saveSetupTech, type SaveSetupTechState } from "./actions";

const initialState: SaveSetupTechState = {};

export function TechForm({
  propertyId,
  initial,
  isEditing,
}: {
  propertyId: string;
  initial: Record<string, unknown>;
  isEditing: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveSetupTech, initialState);
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

      <Section title="Wi-Fi">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInput
            name="wifi_ssid"
            label="Network name (SSID)"
            placeholder="MyHomeNetwork"
            defaultValue={initial.wifi_ssid as string | undefined}
            error={err("wifi_ssid")}
          />
          <TextInput
            name="wifi_password"
            label="Wi-Fi password"
            defaultValue={initial.wifi_password as string | undefined}
            error={err("wifi_password")}
          />
          <TextInput
            name="wifi_router_location"
            label="Router location"
            placeholder="e.g. Living room closet"
            defaultValue={initial.wifi_router_location as string | undefined}
            error={err("wifi_router_location")}
          />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInput
            name="guest_network_ssid"
            label="Guest network SSID (optional)"
            defaultValue={initial.guest_network_ssid as string | undefined}
            error={err("guest_network_ssid")}
          />
          <TextInput
            name="guest_network_password"
            label="Guest network password"
            defaultValue={initial.guest_network_password as string | undefined}
            error={err("guest_network_password")}
          />
        </div>
      </Section>

      <Section title="Smart devices">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--color-text-tertiary)" }}>
              Doorbell camera
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextInput
                name="doorbell_brand"
                label="Doorbell camera brand"
                placeholder="e.g. Ring, Nest"
                defaultValue={initial.doorbell_brand as string | undefined}
                error={err("doorbell_brand")}
              />
            </div>
            <RadioGroup
              name="doorbell_admin_access"
              label="Admin access shared with hello@myproxyhost.com"
              options={[
                { value: "Yes", label: "Yes" },
                { value: "No", label: "No" },
              ]}
              defaultValue={initial.doorbell_admin_access as string | undefined}
            />
          </div>

          <div className="flex flex-col gap-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--color-text-tertiary)" }}>
              Thermostat
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextInput
                name="thermostat_brand"
                label="Thermostat brand"
                placeholder="e.g. Nest, Ecobee, Honeywell"
                defaultValue={initial.thermostat_brand as string | undefined}
                error={err("thermostat_brand")}
              />
            </div>
            <RadioGroup
              name="thermostat_admin_access"
              label="Admin access shared with hello@myproxyhost.com"
              options={[
                { value: "Yes", label: "Yes" },
                { value: "No", label: "No" },
              ]}
              defaultValue={initial.thermostat_admin_access as string | undefined}
            />
          </div>

          <div className="flex flex-col gap-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--color-text-tertiary)" }}>
              Noise monitor
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextInput
                name="noise_monitor_brand"
                label="Noise monitor brand"
                placeholder="e.g. Minut, Noiseaware"
                defaultValue={initial.noise_monitor_brand as string | undefined}
                error={err("noise_monitor_brand")}
              />
              <TextInput
                name="noise_monitor_location"
                label="Noise monitor location"
                defaultValue={initial.noise_monitor_location as string | undefined}
                error={err("noise_monitor_location")}
              />
            </div>
            <RadioGroup
              name="noise_monitor_admin_access"
              label="Admin access shared with hello@myproxyhost.com"
              options={[
                { value: "Yes", label: "Yes" },
                { value: "No", label: "No" },
              ]}
              defaultValue={initial.noise_monitor_admin_access as string | undefined}
            />
          </div>
        </div>
      </Section>

      <Section title="TVs">
        <TextArea
          name="tvs"
          label="TVs by room"
          placeholder={`e.g. Living room: 65" Samsung QLED, Master bedroom: 43" LG, Guest room: 32" TCL`}
          defaultValue={initial.tvs as string | undefined}
          rows={4}
          helpText="List each TV's room, size in inches, and brand."
        />
      </Section>

      <Section title="Other">
        <TextArea
          name="other_devices"
          label="Other connected devices"
          placeholder="e.g. Amazon Echo in kitchen, Blink cameras on exterior (admin access shared)"
          defaultValue={initial.other_devices as string | undefined}
          rows={3}
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
          <label
            key={opt.value}
            className="relative cursor-pointer"
          >
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
