"use client";

import { useActionState, useId } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { CustomSelect } from "@/components/workspace/CustomSelect";
import { StepSaveBar } from "@/components/workspace/setup/StepShell";
import { saveFinancial, type SaveFinancialState } from "./actions";

type FinancialInitial = {
  red_line_income?: number | null;
  desired_income?: number | null;
  target_launch_date?: string | null;
  furnishing_needs?: string | null;
  furnishing_budget?: number | null;
  financially_ready?: string | null;
};

const FURNISHING_OPTIONS = [
  { value: "furnished", label: "Already furnished" },
  { value: "partial", label: "Needs partial furnishing" },
  { value: "full", label: "Needs full furnishing" },
  { value: "unsure", label: "Not sure yet" },
];

const READINESS_OPTIONS = [
  { value: "ready", label: "Yes, ready now" },
  { value: "1-2months", label: "Need 1 to 2 months" },
  { value: "3+months", label: "Need 3+ months" },
  { value: "unsure", label: "Not sure" },
];

const initialState: SaveFinancialState = {};

export function FinancialForm({
  propertyId,
  initial,
  isEditing,
}: {
  propertyId: string;
  initial: FinancialInitial;
  isEditing: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveFinancial, initialState);

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

      <Section title="Income goals">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CurrencyInput
            name="red_line_income"
            label="What is your red line?"
            hint="The minimum monthly income you need to break even."
            defaultValue={initial.red_line_income?.toString() ?? ""}
            required
          />
          <CurrencyInput
            name="desired_income"
            label="What is your desired monthly income?"
            hint="Your ideal target after expenses."
            defaultValue={initial.desired_income?.toString() ?? ""}
          />
        </div>
      </Section>

      <Section title="Timeline">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DateInput
            name="target_launch_date"
            label="When would you like to go live?"
            defaultValue={initial.target_launch_date ?? ""}
          />
          <SelectInput
            name="financially_ready"
            label="Are you financially ready to begin?"
            options={READINESS_OPTIONS}
            defaultValue={initial.financially_ready ?? ""}
          />
        </div>
      </Section>

      <Section title="Furnishing">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectInput
            name="furnishing_needs"
            label="What are your furnishing needs?"
            options={FURNISHING_OPTIONS}
            defaultValue={initial.furnishing_needs ?? ""}
          />
          <CurrencyInput
            name="furnishing_budget"
            label="Furnishing budget"
            hint="A typical full furnish runs $15,000 to $40,000 depending on size."
            defaultValue={initial.furnishing_budget?.toString() ?? ""}
          />
        </div>
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

function CurrencyInput({ name, label, hint, required, defaultValue }: { name: string; label: string; hint?: string; required?: boolean; defaultValue?: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--color-text-tertiary)" }}>
        {label}{required ? <span className="ml-1" style={{ color: "var(--color-brand)" }}>*</span> : null}
      </label>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm" style={{ color: "var(--color-text-tertiary)" }}>$</span>
        <input id={id} name={name} type="number" min="0" step="100" placeholder="0" defaultValue={defaultValue}
          className="w-full rounded-lg border py-2.5 pl-8 pr-3.5 text-sm focus:outline-none focus:ring-2"
          style={{ borderColor: "var(--color-warm-gray-200)", backgroundColor: "var(--color-white)", color: "var(--color-text-primary)" }}
        />
      </div>
      {hint ? <p className="text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>{hint}</p> : null}
    </div>
  );
}

function DateInput({ name, label, defaultValue }: { name: string; label: string; defaultValue?: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--color-text-tertiary)" }}>{label}</label>
      <input id={id} name={name} type="date" defaultValue={defaultValue}
        className="rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2"
        style={{ borderColor: "var(--color-warm-gray-200)", backgroundColor: "var(--color-white)", color: "var(--color-text-primary)" }}
      />
    </div>
  );
}

function SelectInput({ name, label, options, defaultValue }: { name: string; label: string; options: { value: string; label: string }[]; defaultValue?: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--color-text-tertiary)" }}>{label}</label>
      <CustomSelect
        id={id}
        name={name}
        defaultValue={defaultValue}
        options={[{ value: "", label: "Select" }, ...options]}
      />
    </div>
  );
}
