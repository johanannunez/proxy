"use client";

import { useActionState, useId } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { StepSaveBar } from "@/components/workspace/setup/StepShell";
import { saveSetupContacts, type SaveSetupContactsState } from "./actions";

const initialState: SaveSetupContactsState = {};

export function ContactsForm({
  propertyId,
  initial,
  isEditing,
}: {
  propertyId: string;
  initial: Record<string, unknown>;
  isEditing: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveSetupContacts, initialState);
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

      <Section title="Owner emergency contact">
        <ContactRow
          nameField="owner_emergency_name"
          phoneField="owner_emergency_phone"
          nameValue={initial.owner_emergency_name as string | undefined}
          phoneValue={initial.owner_emergency_phone as string | undefined}
          nameError={err("owner_emergency_name")}
          phoneError={err("owner_emergency_phone")}
        />
      </Section>

      <Section title="Vendors">
        <div className="flex flex-col gap-6">
          <ContactRow
            label="Plumber"
            nameField="plumber_name"
            phoneField="plumber_phone"
            nameValue={initial.plumber_name as string | undefined}
            phoneValue={initial.plumber_phone as string | undefined}
            nameError={err("plumber_name")}
            phoneError={err("plumber_phone")}
          />
          <ContactRow
            label="HVAC technician"
            nameField="hvac_name"
            phoneField="hvac_phone"
            nameValue={initial.hvac_name as string | undefined}
            phoneValue={initial.hvac_phone as string | undefined}
            nameError={err("hvac_name")}
            phoneError={err("hvac_phone")}
          />
          <ContactRow
            label="Electrician"
            nameField="electrician_name"
            phoneField="electrician_phone"
            nameValue={initial.electrician_name as string | undefined}
            phoneValue={initial.electrician_phone as string | undefined}
            nameError={err("electrician_name")}
            phoneError={err("electrician_phone")}
          />
          <ContactRow
            label="Handyman"
            nameField="handyman_name"
            phoneField="handyman_phone"
            nameValue={initial.handyman_name as string | undefined}
            phoneValue={initial.handyman_phone as string | undefined}
            nameError={err("handyman_name")}
            phoneError={err("handyman_phone")}
          />
          <ContactRow
            label="Pest control"
            nameField="pest_control_name"
            phoneField="pest_control_phone"
            nameValue={initial.pest_control_name as string | undefined}
            phoneValue={initial.pest_control_phone as string | undefined}
            nameError={err("pest_control_name")}
            phoneError={err("pest_control_phone")}
          />
        </div>
      </Section>

      <Section title="Building and hospital">
        <div className="flex flex-col gap-6">
          <TextInput
            name="hoa_emergency_phone"
            label="HOA emergency line"
            defaultValue={initial.hoa_emergency_phone as string | undefined}
            error={err("hoa_emergency_phone")}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextInput
              name="nearest_hospital_name"
              label="Nearest hospital name"
              defaultValue={initial.nearest_hospital_name as string | undefined}
              error={err("nearest_hospital_name")}
            />
            <TextInput
              name="nearest_hospital_address"
              label="Nearest hospital address"
              defaultValue={initial.nearest_hospital_address as string | undefined}
              error={err("nearest_hospital_address")}
            />
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

function ContactRow({
  label,
  nameField,
  phoneField,
  nameValue,
  phoneValue,
  nameError,
  phoneError,
}: {
  label?: string;
  nameField: string;
  phoneField: string;
  nameValue?: string;
  phoneValue?: string;
  nameError?: string;
  phoneError?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {label ? (
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--color-text-tertiary)" }}>
          {label}
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput name={nameField} label="Name" defaultValue={nameValue} error={nameError} />
        <TextInput name={phoneField} label="Phone" defaultValue={phoneValue} error={phoneError} />
      </div>
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
