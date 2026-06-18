"use client";

import { useActionState, useId } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { StepSaveBar } from "@/components/workspace/setup/StepShell";
import { saveSetupListing, type SaveSetupListingState } from "./actions";

const initialState: SaveSetupListingState = {};

export function ListingForm({
  propertyId,
  initial,
  isEditing,
}: {
  propertyId: string;
  initial: Record<string, unknown>;
  isEditing: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveSetupListing, initialState);

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

      <Section title="Personal items and access">
        <div className="flex flex-col gap-5">
          <TextArea
            name="personal_items_areas"
            label="Personal items or restricted areas"
            placeholder="e.g. Master closet (locked), garage back shelf (personal storage), primary bathroom cabinet"
            defaultValue={initial.personal_items_areas as string | undefined}
            rows={4}
            helpText="Which rooms or areas contain personal belongings that should not be accessed by guests?"
          />
          <TextArea
            name="items_to_secure"
            label="Items to remove or secure before photography"
            placeholder="e.g. Family photos in hallway, gun safe in master closet, personal toiletries in bathrooms"
            defaultValue={initial.items_to_secure as string | undefined}
            rows={4}
          />
        </div>
      </Section>

      <Section title="Photography">
        <TextArea
          name="photography_scheduling_notes"
          label="Photography scheduling preferences"
          placeholder="e.g. Weekday mornings preferred, not before 9am. Dog will be present — can crate."
          defaultValue={initial.photography_scheduling_notes as string | undefined}
          rows={4}
        />
      </Section>

      <Section title="Staging">
        <TextArea
          name="staging_notes"
          label="Staging and presentation notes"
          placeholder="e.g. Patio furniture should face the pool. Kitchen island is the hero shot. Remove the recliner from the living room before photos."
          defaultValue={initial.staging_notes as string | undefined}
          rows={4}
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
