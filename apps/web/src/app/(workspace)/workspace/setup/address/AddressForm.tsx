"use client";

import { useActionState, useId, useState } from "react";
import { WarningCircle, MapPin, Crosshair } from "@phosphor-icons/react";
import { CustomSelect } from "@/components/workspace/CustomSelect";
import { StepSaveBar } from "@/components/workspace/setup/StepShell";
import { saveAddress, type SaveAddressState } from "./actions";

type AddressInitial = {
  property_id: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
};

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID",
  "IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS",
  "MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK",
  "OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV",
  "WI","WY",
];

const initialState: SaveAddressState = {};

export function AddressForm({
  initial,
  isEditing,
}: {
  initial: AddressInitial;
  isEditing: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveAddress, initialState);
  const [locating, setLocating] = useState(false);
  const [fields, setFields] = useState(initial);

  const err = (key: string) => state.fieldErrors?.[key];

  async function handleUseLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&addressdetails=1`,
            { headers: { "User-Agent": "ProxyWorkspace/1.0" } },
          );
          if (res.ok) {
            const data = await res.json();
            const addr = data.address ?? {};
            setFields((prev) => ({
              ...prev,
              address_line1: [addr.house_number, addr.road].filter(Boolean).join(" "),
              city: addr.city || addr.town || addr.village || prev.city,
              state: (addr.state_code || addr.state || prev.state).slice(0, 2).toUpperCase(),
              postal_code: addr.postcode || prev.postal_code,
            }));
          }
        } catch {
          // Silently fail
        }
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true },
    );
  }

  const fullAddress = [fields.address_line1, fields.city, fields.state, fields.postal_code]
    .filter(Boolean)
    .join(", ");
  const showMap = fields.address_line1 && fields.city && fields.state;

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <input type="hidden" name="property_id" value={fields.property_id} />

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

      <section
        className="rounded-2xl border p-6"
        style={{ borderColor: "var(--color-warm-gray-200)", backgroundColor: "var(--color-white)" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2
            className="text-base font-semibold tracking-tight"
            style={{ color: "var(--color-text-primary)" }}
          >
            Rental address
          </h2>
          <button
            type="button"
            onClick={handleUseLocation}
            disabled={locating}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--color-warm-gray-50)] disabled:opacity-60"
            style={{ borderColor: "var(--color-warm-gray-200)", color: "var(--color-text-secondary)" }}
          >
            <Crosshair size={13} weight="bold" />
            {locating ? "Locating..." : "Use my current location"}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <TextInput
            name="address_line1"
            label="Street address"
            value={fields.address_line1}
            onChange={(v) => setFields((p) => ({ ...p, address_line1: v }))}
            placeholder="1234 Example Street"
            required
            error={err("address_line1")}
          />
          <TextInput
            name="address_line2"
            label="Unit or apartment"
            value={fields.address_line2}
            onChange={(v) => setFields((p) => ({ ...p, address_line2: v }))}
            placeholder="Apt 2B (optional)"
            error={err("address_line2")}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_140px_160px]">
            <TextInput
              name="city"
              label="City"
              value={fields.city}
              onChange={(v) => setFields((p) => ({ ...p, city: v }))}
              required
              error={err("city")}
            />
            <div className="flex flex-col gap-1.5">
              <label
                className="text-[12px] font-semibold uppercase tracking-[0.08em]"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                State <span style={{ color: "var(--color-brand)" }}>*</span>
              </label>
              <CustomSelect
                name="state"
                value={fields.state}
                onChange={(v) => setFields((p) => ({ ...p, state: v }))}
                required
                hasError={Boolean(err("state"))}
                aria-invalid={Boolean(err("state"))}
                options={[{ value: "", label: "Select" }, ...US_STATES.map((s) => ({ value: s, label: s }))]}
              />
            </div>
            <TextInput
              name="postal_code"
              label="ZIP"
              value={fields.postal_code}
              onChange={(v) => setFields((p) => ({ ...p, postal_code: v }))}
              required
              inputMode="numeric"
              error={err("postal_code")}
            />
          </div>
        </div>
      </section>

      {/* Map preview */}
      {showMap && (
        <section
          className="overflow-hidden rounded-2xl border"
          style={{ borderColor: "var(--color-warm-gray-200)" }}
        >
          <div
            className="flex items-center gap-2 border-b px-4 py-2.5"
            style={{ borderColor: "var(--color-warm-gray-200)", backgroundColor: "var(--color-white)" }}
          >
            <MapPin size={14} weight="fill" style={{ color: "var(--color-brand)" }} />
            <span className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
              {fullAddress}
            </span>
          </div>
          <iframe
            title="Map preview"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(fullAddress)}&layer=mapnik`}
            className="h-48 w-full border-0"
            style={{ backgroundColor: "var(--color-warm-gray-50)" }}
          />
        </section>
      )}

      <StepSaveBar pending={pending} isEditing={isEditing} />
    </form>
  );
}

function TextInput({
  name,
  label,
  value,
  onChange,
  placeholder,
  required,
  error,
  inputMode,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  inputMode?: "numeric" | "text";
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode={inputMode}
        placeholder={placeholder}
        required={required}
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
