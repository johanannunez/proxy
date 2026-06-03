"use client";

import { useActionState, useId } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { StepSaveBar } from "@/components/workspace/setup/StepShell";
import { saveRecommendations, type SaveRecommendationsState } from "./actions";

export type { SaveRecommendationsState };

const initialState: SaveRecommendationsState = {};

export function RecommendationsForm({
  propertyId,
  initial,
  isEditing,
}: {
  propertyId: string;
  initial: Record<string, unknown>;
  isEditing: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveRecommendations, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-6">
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

      <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
        Write one place per line. Include the name, address, and why you recommend it. Guests see this in their welcome guide.
      </p>

      <Section title="Restaurants">
        <TextAreaInput
          name="restaurants"
          label="Restaurants"
          defaultValue={initial.restaurants as string | undefined}
          placeholder={"Best Burger: 123 Main St — great burgers and local craft beers\nMaria's Kitchen: 456 Oak Ave — authentic Mexican, order the tacos al pastor"}
          rows={5}
        />
      </Section>

      <Section title="Coffee shops">
        <TextAreaInput
          name="coffee_shops"
          label="Coffee shops"
          defaultValue={initial.coffee_shops as string | undefined}
          placeholder="Morning Grind: 789 Pine St — best espresso in town, cozy vibe"
          rows={5}
        />
      </Section>

      <Section title="Grocery stores">
        <TextAreaInput
          name="grocery_stores"
          label="Grocery stores"
          defaultValue={initial.grocery_stores as string | undefined}
          placeholder={"Whole Foods: 321 Market Blvd — full selection, organic produce\nALDI: 654 Commerce Way — best prices for basics"}
          rows={5}
        />
      </Section>

      <Section title="Activities and attractions">
        <TextAreaInput
          name="activities"
          label="Activities and attractions"
          defaultValue={initial.activities as string | undefined}
          placeholder={"Columbia River Walk: free trail along the riverfront, great for sunsets\nRichland Waterfront Park: kayak rentals, picnic area"}
          rows={5}
        />
      </Section>

      <Section title="Beaches, parks, and nature">
        <TextAreaInput
          name="beaches_parks"
          label="Beaches, parks, and nature"
          defaultValue={initial.beaches_parks as string | undefined}
          placeholder="Howard Amon Park: 0.5 mi away, large grassy areas, river beach"
          rows={5}
        />
      </Section>

      <Section title="Local tips and hidden gems">
        <TextAreaInput
          name="local_tips"
          label="Local tips and hidden gems"
          defaultValue={initial.local_tips as string | undefined}
          placeholder="Park on the side streets — the main lot fills up fast on weekends"
          rows={5}
        />
      </Section>

      <Section title="Emergency services">
        <TextAreaInput
          name="emergency_services"
          label="Emergency services nearby"
          defaultValue={initial.emergency_services as string | undefined}
          placeholder={"Kadlec Regional Medical Center: 888 Swift Blvd (5 min away)\nUrgent Care: 123 Health Way (3 min away)\nWalgreens: 456 Medical Dr (2 min away)"}
          rows={5}
        />
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

function TextAreaInput({
  name,
  label,
  placeholder,
  defaultValue,
  rows = 4,
}: {
  name: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  rows?: number;
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
        rows={rows}
        className="resize-none rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2"
        style={{
          borderColor: "var(--color-warm-gray-200)",
          backgroundColor: "var(--color-white)",
          color: "var(--color-text-primary)",
        }}
      />
    </div>
  );
}
