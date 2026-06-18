"use client";

import { useActionState, useId } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { StepSaveBar } from "@/components/workspace/setup/StepShell";
import { savePlatformAuthorization, type SavePlatformAuthorizationState } from "./actions";

const initialState: SavePlatformAuthorizationState = {};

export function PlatformAuthorizationForm({
  propertyId,
  initial,
  isEditing,
}: {
  propertyId: string;
  initial: Record<string, unknown>;
  isEditing: boolean;
}) {
  const [state, formAction, pending] = useActionState(savePlatformAuthorization, initialState);
  const err = (key: string) => state.fieldErrors?.[key];

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <input type="hidden" name="property_id" value={propertyId} />

      <p
        className="text-sm"
        style={{ color: "var(--color-text-secondary)" }}
      >
        Add the details for your primary listing platform. If you are listed on multiple platforms,
        we will collect the others during onboarding.
      </p>

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

      <Section title="Platform">
        <RadioGroup
          name="platform"
          options={["Airbnb", "VRBO", "Booking.com", "Furnished Finder", "Direct", "Other"]}
          defaultValue={initial.platform as string | undefined}
          error={err("platform")}
        />
      </Section>

      <Section title="Account access">
        <div className="flex flex-col gap-4">
          <TextInput
            name="account_email"
            label="Account email"
            placeholder="e.g. owner@email.com"
            defaultValue={initial.account_email as string | undefined}
            error={err("account_email")}
          />
          <div>
            <p
              className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em]"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              Access type
            </p>
            <RadioGroup
              name="access_type"
              options={["Co-host invitation", "Shared login", "Proxy-owned listing"]}
              defaultValue={initial.access_type as string | undefined}
              error={err("access_type")}
            />
          </div>
          <div>
            <p
              className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em]"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              Co-host invitation sent?
            </p>
            <RadioGroup
              name="invitation_sent"
              options={["Yes", "No"]}
              defaultValue={initial.invitation_sent as string | undefined}
              error={err("invitation_sent")}
            />
          </div>
        </div>
      </Section>

      <Section title="Invitation details">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextInput
              name="date_invited"
              label="Date invited"
              placeholder="e.g. Apr 2024"
              defaultValue={initial.date_invited as string | undefined}
              error={err("date_invited")}
            />
            <TextInput
              name="access_level"
              label="Access level granted"
              placeholder="e.g. Full co-host access"
              defaultValue={initial.access_level as string | undefined}
              error={err("access_level")}
            />
          </div>
          <TextAreaInput
            name="notes"
            label="Notes"
            placeholder="Any additional context about this platform's setup"
            defaultValue={initial.notes as string | undefined}
            error={err("notes")}
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
      <h2
        className="mb-4 text-base font-semibold tracking-tight"
        style={{ color: "var(--color-text-primary)" }}
      >
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
              className="inline-flex items-center rounded-full border px-3.5 py-1.5 text-sm font-medium"
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
