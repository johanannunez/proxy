"use client";

import { useActionState, useId, useState } from "react";
import { WarningCircle, Plus, Minus } from "@phosphor-icons/react";
import { CustomSelect } from "@/components/workspace/CustomSelect";
import { StepSaveBar } from "@/components/workspace/setup/StepShell";
import { saveSpace, type SaveSpaceState } from "./actions";

type SpaceInitial = {
  property_id: string;
  bedrooms: string;
  bathrooms: string;
  guest_capacity: string;
  square_feet: string;
  bed_arrangements: unknown;
};

type BedArrangement = {
  bedroom: number;
  beds: { type: string; count: number }[];
};

const BED_TYPES = ["King", "Queen", "Twin", "Bunk", "Sofa bed"];
const initialState: SaveSpaceState = {};

export function SpaceForm({
  initial,
  isEditing,
}: {
  initial: SpaceInitial;
  isEditing: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveSpace, initialState);
  const [bedrooms, setBedrooms] = useState(parseInt(initial.bedrooms) || 1);
  const [arrangements, setArrangements] = useState<BedArrangement[]>(() => {
    // Hydrate from saved data if it exists
    if (initial.bed_arrangements && Array.isArray(initial.bed_arrangements)) {
      const saved = initial.bed_arrangements as BedArrangement[];
      if (saved.length > 0 && saved[0].beds) return saved;
    }
    const count = parseInt(initial.bedrooms) || 1;
    return Array.from({ length: count }, (_, i) => ({
      bedroom: i + 1,
      beds: [{ type: "Queen", count: 1 }],
    }));
  });

  const err = (key: string) => state.fieldErrors?.[key];

  function updateBedroomCount(n: number) {
    const clamped = Math.max(1, Math.min(10, n));
    setBedrooms(clamped);
    setArrangements((prev) => {
      if (clamped > prev.length) {
        return [
          ...prev,
          ...Array.from({ length: clamped - prev.length }, (_, i) => ({
            bedroom: prev.length + i + 1,
            beds: [{ type: "Queen", count: 1 }],
          })),
        ];
      }
      return prev.slice(0, clamped);
    });
  }

  function updateBed(bedroomIdx: number, bedIdx: number, field: "type" | "count", value: string | number) {
    setArrangements((prev) =>
      prev.map((arr, i) =>
        i === bedroomIdx
          ? {
              ...arr,
              beds: arr.beds.map((b, j) =>
                j === bedIdx
                  ? { ...b, [field]: field === "count" ? Math.max(1, Number(value)) : value }
                  : b,
              ),
            }
          : arr,
      ),
    );
  }

  function addBed(bedroomIdx: number) {
    setArrangements((prev) =>
      prev.map((arr, i) =>
        i === bedroomIdx
          ? { ...arr, beds: [...arr.beds, { type: "Twin", count: 1 }] }
          : arr,
      ),
    );
  }

  function removeBed(bedroomIdx: number, bedIdx: number) {
    setArrangements((prev) =>
      prev.map((arr, i) =>
        i === bedroomIdx && arr.beds.length > 1
          ? { ...arr, beds: arr.beds.filter((_, j) => j !== bedIdx) }
          : arr,
      ),
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <input type="hidden" name="property_id" value={initial.property_id} />
      <input type="hidden" name="bed_arrangements" value={JSON.stringify(arrangements)} />

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

      <Section title="The numbers">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <NumberPicker
            name="bedrooms"
            label="Bedrooms"
            value={bedrooms}
            onChange={updateBedroomCount}
            min={1}
            max={10}
            error={err("bedrooms")}
          />
          <NumberInput
            name="bathrooms"
            label="Bathrooms"
            defaultValue={initial.bathrooms}
            step="0.5"
            min="0.5"
            max="10"
            required
            error={err("bathrooms")}
          />
          <NumberInput
            name="guest_capacity"
            label="Max guests"
            defaultValue={initial.guest_capacity}
            min="1"
            max="60"
            required
            error={err("guest_capacity")}
          />
          <NumberInput
            name="square_feet"
            label="Square feet"
            defaultValue={initial.square_feet}
            min="0"
            max="100000"
            error={err("square_feet")}
          />
        </div>
      </Section>

      <Section title="Bed arrangements">
        <p
          className="mb-4 text-sm"
          style={{ color: "var(--color-text-secondary)" }}
        >
          For each bedroom, list the bed types and how many of each.
        </p>
        <div className="flex flex-col gap-4">
          {arrangements.map((arr, bedroomIdx) => (
            <div
              key={bedroomIdx}
              className="rounded-xl border p-4"
              style={{ borderColor: "var(--color-warm-gray-200)" }}
            >
              <p
                className="mb-3 text-sm font-semibold"
                style={{ color: "var(--color-text-primary)" }}
              >
                Bedroom {arr.bedroom}
              </p>
              <div className="flex flex-col gap-2">
                {arr.beds.map((bed, bedIdx) => (
                  <div key={bedIdx} className="flex items-center gap-3">
                    <CustomSelect
                      value={bed.type}
                      onChange={(v) => updateBed(bedroomIdx, bedIdx, "type", v)}
                      options={BED_TYPES.map((t) => ({ value: t, label: t }))}
                    />
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => updateBed(bedroomIdx, bedIdx, "count", bed.count - 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:bg-[var(--color-warm-gray-50)]"
                        style={{ borderColor: "var(--color-warm-gray-200)" }}
                      >
                        <Minus size={12} weight="bold" style={{ color: "var(--color-text-tertiary)" }} />
                      </button>
                      <span
                        className="w-8 text-center text-sm font-medium tabular-nums"
                        style={{ color: "var(--color-text-primary)" }}
                      >
                        {bed.count}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateBed(bedroomIdx, bedIdx, "count", bed.count + 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:bg-[var(--color-warm-gray-50)]"
                        style={{ borderColor: "var(--color-warm-gray-200)" }}
                      >
                        <Plus size={12} weight="bold" style={{ color: "var(--color-text-tertiary)" }} />
                      </button>
                    </div>
                    {arr.beds.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeBed(bedroomIdx, bedIdx)}
                        className="text-xs font-medium transition-colors"
                        style={{ color: "var(--color-error)" }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => addBed(bedroomIdx)}
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium transition-colors"
                style={{ color: "var(--color-brand)" }}
              >
                <Plus size={12} weight="bold" />
                Add another bed
              </button>
            </div>
          ))}
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

function NumberPicker({
  name,
  label,
  value,
  onChange,
  min,
  max,
  error,
}: {
  name: string;
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        className="text-[12px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        {label} <span style={{ color: "var(--color-brand)" }}>*</span>
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(value - 1)}
          disabled={value <= min}
          className="flex h-10 w-10 items-center justify-center rounded-lg border transition-colors hover:bg-[var(--color-warm-gray-50)] disabled:opacity-40"
          style={{ borderColor: "var(--color-warm-gray-200)" }}
        >
          <Minus size={14} weight="bold" style={{ color: "var(--color-text-tertiary)" }} />
        </button>
        <input
          type="hidden"
          name={name}
          value={value}
        />
        <span
          className="w-8 text-center text-lg font-semibold tabular-nums"
          style={{ color: "var(--color-text-primary)" }}
        >
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          disabled={value >= max}
          className="flex h-10 w-10 items-center justify-center rounded-lg border transition-colors hover:bg-[var(--color-warm-gray-50)] disabled:opacity-40"
          style={{ borderColor: "var(--color-warm-gray-200)" }}
        >
          <Plus size={14} weight="bold" style={{ color: "var(--color-text-tertiary)" }} />
        </button>
      </div>
      {error ? (
        <p className="flex items-center gap-1 text-[12px] font-medium" style={{ color: "#c0372a" }}>
          <WarningCircle size={12} weight="fill" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

function NumberInput({
  name,
  label,
  defaultValue,
  step,
  min,
  max,
  required,
  error,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  step?: string;
  min?: string;
  max?: string;
  required?: boolean;
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
        {required ? <span className="ml-1" style={{ color: "var(--color-brand)" }}>*</span> : null}
      </label>
      <input
        id={id}
        name={name}
        type="number"
        step={step}
        min={min}
        max={max}
        defaultValue={defaultValue}
        required={required}
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
