"use client";

import { useActionState, useState, useId } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { StepSaveBar } from "@/components/workspace/setup/StepShell";
import { saveCompliance, type SaveComplianceState } from "./actions";

type ComplianceInitial = {
  needs_permit?: string;
  permit_number?: string;
  has_hoa?: string;
  hoa_approval?: string;
};

const initialState: SaveComplianceState = {};

export function ComplianceForm({
  propertyId,
  initial,
  isEditing,
}: {
  propertyId: string;
  initial: ComplianceInitial;
  isEditing: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveCompliance, initialState);
  const [needsPermit, setNeedsPermit] = useState(initial.needs_permit ?? "");
  const [hasHoa, setHasHoa] = useState(initial.has_hoa ?? "");

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

      <Section title="STR permit">
        <fieldset className="mb-3">
          <legend className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--color-text-tertiary)" }}>
            Does your city require an STR permit?
          </legend>
          <div className="flex gap-3">
            {(["yes", "no", "unsure"] as const).map((opt) => (
              <label key={opt} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer hover:bg-[var(--color-warm-gray-50)]"
                style={{ borderColor: "var(--color-warm-gray-200)", color: "var(--color-text-primary)" }}>
                <input type="radio" name="needs_permit" value={opt} checked={needsPermit === opt}
                  onChange={() => setNeedsPermit(opt)} className="accent-[var(--color-brand)]" />
                {opt === "unsure" ? "Not sure" : opt === "yes" ? "Yes" : "No"}
              </label>
            ))}
          </div>
        </fieldset>
        {needsPermit === "yes" && (
          <TextInput name="permit_number" label="STR permit number" defaultValue={initial.permit_number} placeholder="e.g. STR-2024-001234" error={err("permit_number")} />
        )}
      </Section>

      <Section title="HOA">
        <fieldset className="mb-3">
          <legend className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--color-text-tertiary)" }}>
            Is there an HOA?
          </legend>
          <div className="flex gap-3">
            {(["yes", "no"] as const).map((opt) => (
              <label key={opt} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer hover:bg-[var(--color-warm-gray-50)]"
                style={{ borderColor: "var(--color-warm-gray-200)", color: "var(--color-text-primary)" }}>
                <input type="radio" name="has_hoa" value={opt} checked={hasHoa === opt}
                  onChange={() => setHasHoa(opt)} className="accent-[var(--color-brand)]" />
                {opt === "yes" ? "Yes" : "No"}
              </label>
            ))}
          </div>
        </fieldset>
        {hasHoa === "yes" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              Does your HOA allow short-term rentals?
            </p>
            <div className="flex gap-3">
              {(["yes", "no", "pending"] as const).map((opt) => (
                <label key={opt} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer hover:bg-[var(--color-warm-gray-50)]"
                  style={{ borderColor: "var(--color-warm-gray-200)", color: "var(--color-text-primary)" }}>
                  <input type="radio" name="hoa_approval" value={opt} defaultChecked={initial.hoa_approval === opt} className="accent-[var(--color-brand)]" />
                  {opt === "yes" ? "Yes, approved" : opt === "no" ? "No" : "Pending"}
                </label>
              ))}
            </div>
          </div>
        )}
      </Section>

      <StepSaveBar pending={pending} isEditing={isEditing} />
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border p-6" style={{ borderColor: "var(--color-warm-gray-200)", backgroundColor: "var(--color-white)" }}>
      <h2 className="mb-4 text-base font-semibold tracking-tight" style={{ color: "var(--color-text-primary)" }}>{title}</h2>
      {children}
    </section>
  );
}

function TextInput({ name, label, placeholder, defaultValue, error }: { name: string; label: string; placeholder?: string; defaultValue?: string; error?: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--color-text-tertiary)" }}>{label}</label>
      <input id={id} name={name} defaultValue={defaultValue} placeholder={placeholder}
        aria-invalid={Boolean(error)}
        className="rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2"
        style={{ borderColor: error ? "#e3867a" : "var(--color-warm-gray-200)", backgroundColor: "var(--color-white)", color: "var(--color-text-primary)" }}
      />
      {error ? (
        <p className="flex items-center gap-1 text-[12px] font-medium" style={{ color: "#c0372a" }}>
          <WarningCircle size={12} weight="fill" />{error}
        </p>
      ) : null}
    </div>
  );
}
