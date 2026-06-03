"use client";

import { useActionState, useId, useState } from "react";
import { WarningCircle, Phone, EnvelopeSimple, ChatCircleText } from "@phosphor-icons/react";
import { StepSaveBar } from "@/components/workspace/setup/StepShell";
import { saveSetupCommunication, type SaveSetupCommunicationState } from "./actions";

const initialState: SaveSetupCommunicationState = {};

export function CommunicationForm({
  propertyId,
  initial,
  isEditing,
}: {
  propertyId: string;
  initial: Record<string, unknown>;
  isEditing: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveSetupCommunication, initialState);
  const err = (key: string) => state.fieldErrors?.[key];

  const savedMethods = ((initial.preferred_contact_methods as string) ?? "").split(",").filter(Boolean);
  const [contactText, setContactText] = useState(savedMethods.includes("text"));
  const [contactCall, setContactCall] = useState(savedMethods.includes("call"));
  const [contactEmail, setContactEmail] = useState(savedMethods.includes("email"));

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <input type="hidden" name="property_id" value={propertyId} />
      <input type="hidden" name="contact_text" value={contactText ? "yes" : ""} />
      <input type="hidden" name="contact_call" value={contactCall ? "yes" : ""} />
      <input type="hidden" name="contact_email" value={contactEmail ? "yes" : ""} />

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

      <Section title="How we reach you">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <p
              className="text-[12px] font-semibold uppercase tracking-[0.08em]"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              Preferred contact methods
            </p>
            <div className="flex flex-wrap gap-2">
              <CheckboxPill
                label="Text"
                icon={<ChatCircleText size={14} weight="bold" />}
                checked={contactText}
                onChange={setContactText}
              />
              <CheckboxPill
                label="Call"
                icon={<Phone size={14} weight="bold" />}
                checked={contactCall}
                onChange={setContactCall}
              />
              <CheckboxPill
                label="Email"
                icon={<EnvelopeSimple size={14} weight="bold" />}
                checked={contactEmail}
                onChange={setContactEmail}
              />
            </div>
          </div>
          <TextInput
            name="best_times"
            label="Best times to reach you"
            placeholder="e.g. Weekday mornings 8-10am, or anytime by text"
            defaultValue={initial.best_times as string | undefined}
            error={err("best_times")}
          />
        </div>
      </Section>

      <Section title="Booking notifications">
        <RadioGroup
          name="booking_notification_preference"
          label="Booking notification preference"
          options={[
            { value: "Every booking", label: "Every booking" },
            { value: "Weekly summary", label: "Weekly summary" },
            { value: "Monthly only", label: "Monthly only" },
          ]}
          defaultValue={initial.booking_notification_preference as string | undefined}
        />
      </Section>

      <Section title="Proxy contact info">
        <div
          className="rounded-xl border px-5 py-4 flex flex-col gap-2"
          style={{
            borderColor: "var(--color-warm-gray-200)",
            backgroundColor: "var(--color-warm-gray-50)",
          }}
        >
          <div className="flex items-center gap-2 text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
            <Phone size={15} weight="duotone" />
            <span>605-800-7033</span>
          </div>
          <div className="flex items-center gap-2 text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
            <EnvelopeSimple size={15} weight="duotone" />
            <span>hello@myproxyhost.com</span>
          </div>
          <p className="mt-1 text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
            Hours: 7am to 7pm. For non-emergency questions, use the portal messaging system.
          </p>
        </div>
      </Section>

      <StepSaveBar pending={pending} isEditing={isEditing} />
    </form>
  );
}

function CheckboxPill({
  label,
  icon,
  checked,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors"
      style={{
        borderColor: checked ? "var(--color-text-primary)" : "var(--color-warm-gray-200)",
        backgroundColor: checked ? "var(--color-text-primary)" : "transparent",
        color: checked ? "var(--color-white)" : "var(--color-text-secondary)",
      }}
      aria-pressed={checked}
    >
      {icon}
      {label}
    </button>
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
