"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  House,
  BuildingOffice,
  Buildings,
  Calendar,
  HandCoins,
  WarningCircle,
} from "@phosphor-icons/react";
import { saveBasics, type SaveBasicsState } from "./actions";
import { homeTypeOptions } from "@/lib/labels";
import { CustomSelect } from "@/components/workspace/CustomSelect";

export type HomeType =
  | ""
  | "single_family"
  | "apartment"
  | "condo"
  | "townhouse"
  | "duplex"
  | "multi_family"
  | "adu"
  | "studio"
  | "loft"
  | "cabin"
  | "tiny_home"
  | "mobile_home"
  | "other";

export type BasicsInitial = {
  property_id: string;
  name: string;
  property_type: "" | "str" | "ltr" | "arbitrage" | "mtr" | "co-hosting";
  home_type: HomeType;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  bedrooms: string;
  bathrooms: string;
  square_feet: string;
  guest_capacity: string;
};

const PROPERTY_TYPES: {
  value: Exclude<BasicsInitial["property_type"], "">;
  label: string;
  hint: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "str",
    label: "Short term rental",
    hint: "Nightly stays, vacation style.",
    icon: <House size={18} weight="duotone" />,
  },
  {
    value: "mtr",
    label: "Mid term",
    hint: "Thirty plus nights, corporate, travel nurse.",
    icon: <Calendar size={18} weight="duotone" />,
  },
  {
    value: "ltr",
    label: "Long term",
    hint: "Traditional yearly lease.",
    icon: <Buildings size={18} weight="duotone" />,
  },
  {
    value: "arbitrage",
    label: "Arbitrage",
    hint: "You lease it, then re-rent it.",
    icon: <HandCoins size={18} weight="duotone" />,
  },
  {
    value: "co-hosting",
    label: "Managed by Proxy",
    hint: "We run everything on your behalf.",
    icon: <BuildingOffice size={18} weight="duotone" />,
  },
];

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID",
  "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS",
  "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK",
  "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV",
  "WI", "WY",
];

const initialState: SaveBasicsState = {};

export function BasicsForm({
  initial,
  isEditing,
}: {
  initial: BasicsInitial;
  isEditing: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    saveBasics,
    initialState,
  );
  const [type, setType] = useState<BasicsInitial["property_type"]>(
    initial.property_type,
  );

  const err = (key: string) => state.fieldErrors?.[key];

  return (
    <form action={formAction} className="flex flex-col gap-10">
      {initial.property_id ? (
        <input
          type="hidden"
          name="property_id"
          value={initial.property_id}
        />
      ) : null}
      <input type="hidden" name="property_type" value={type} />

      {state.error ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border px-4 py-3.5 text-sm"
          style={{
            borderColor: "#f1c4c4",
            backgroundColor: "#fdf4f4",
            color: "#8a1f1f",
          }}
        >
          <WarningCircle
            size={18}
            weight="fill"
            style={{ color: "#c0372a" }}
          />
          <span>{state.error}</span>
        </div>
      ) : null}

      {/* Property type picker */}
      <FormSection
        eyebrow="01"
        title="What kind of rental is this?"
        description="Pick the one that fits best. You can switch later if things change."
        errorId={err("property_type") ? "property_type-error" : undefined}
      >
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {PROPERTY_TYPES.map((t) => {
            const active = type === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                aria-pressed={active}
                className="group relative flex items-start gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{
                  borderColor: active
                    ? "var(--color-brand)"
                    : "var(--color-warm-gray-200)",
                  backgroundColor: active
                    ? "rgba(2, 170, 235, 0.04)"
                    : "var(--color-white)",
                  boxShadow: active
                    ? "0 0 0 1px var(--color-brand) inset"
                    : "none",
                }}
              >
                <span
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    backgroundColor: active
                      ? "rgba(2, 170, 235, 0.12)"
                      : "var(--color-warm-gray-50)",
                    color: active
                      ? "var(--color-brand)"
                      : "var(--color-text-tertiary)",
                  }}
                >
                  {t.icon}
                </span>
                <span className="flex-1">
                  <span
                    className="block text-sm font-semibold"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {t.label}
                  </span>
                  <span
                    className="mt-0.5 block text-[13px] leading-snug"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    {t.hint}
                  </span>
                </span>
                {active ? (
                  <span
                    aria-hidden
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white"
                    style={{ backgroundColor: "var(--color-brand)" }}
                  >
                    <Check size={12} weight="bold" />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        {err("property_type") ? (
          <FieldError id="property_type-error">
            {err("property_type")}
          </FieldError>
        ) : null}
      </FormSection>

      {/* Home type */}
      <FormSection
        eyebrow="02"
        title="What kind of home is it?"
        description="The building type. We use this to group your portfolio and tailor listing details."
      >
        <SelectInput
          name="home_type"
          label="Home type"
          defaultValue={initial.home_type}
          required
          error={err("home_type")}
          options={[{ value: "", label: "Select home type" }, ...homeTypeOptions]}
        />
      </FormSection>

      {/* Nickname */}
      <FormSection
        eyebrow="03"
        title="Give it a nickname"
        description="Optional. Used in your dashboard and guest messages. Something like “Downing Drive” or “Lake Cabin”."
      >
        <TextInput
          name="name"
          label="Property nickname"
          defaultValue={initial.name}
          placeholder="e.g. 34 Downing"
          error={err("name")}
        />
      </FormSection>

      {/* Address */}
      <FormSection
        eyebrow="04"
        title="Where is it?"
        description="The actual street address. Guests never see this until their reservation is confirmed."
      >
        <div className="grid grid-cols-1 gap-4">
          <TextInput
            name="address_line1"
            label="Street address"
            defaultValue={initial.address_line1}
            placeholder="1234 Example Street"
            required
            error={err("address_line1")}
          />
          <TextInput
            name="address_line2"
            label="Unit or apartment"
            defaultValue={initial.address_line2}
            placeholder="Apt 2B (optional)"
            error={err("address_line2")}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_140px_160px]">
            <TextInput
              name="city"
              label="City"
              defaultValue={initial.city}
              required
              error={err("city")}
            />
            <SelectInput
              name="state"
              label="State"
              defaultValue={initial.state}
              required
              error={err("state")}
              options={[{ value: "", label: "Select" }, ...US_STATES.map((s) => ({ value: s, label: s }))]}
            />
            <TextInput
              name="postal_code"
              label="ZIP"
              defaultValue={initial.postal_code}
              required
              inputMode="numeric"
              error={err("postal_code")}
            />
          </div>
          <input
            type="hidden"
            name="country"
            value={initial.country || "US"}
          />
        </div>
      </FormSection>

      {/* Specs */}
      <FormSection
        eyebrow="05"
        title="The space"
        description="The numbers that show up on every listing."
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <TextInput
            name="bedrooms"
            label="Bedrooms"
            defaultValue={initial.bedrooms}
            type="number"
            min="0"
            max="30"
            required
            error={err("bedrooms")}
          />
          <TextInput
            name="bathrooms"
            label="Bathrooms"
            defaultValue={initial.bathrooms}
            type="number"
            step="0.5"
            min="0"
            max="30"
            required
            error={err("bathrooms")}
          />
          <TextInput
            name="guest_capacity"
            label="Sleeps"
            defaultValue={initial.guest_capacity}
            type="number"
            min="1"
            max="60"
            required
            error={err("guest_capacity")}
          />
          <TextInput
            name="square_feet"
            label="Square feet"
            defaultValue={initial.square_feet}
            type="number"
            min="1"
            max="100000"
            required
            error={err("square_feet")}
          />
        </div>
      </FormSection>

      {/* Sticky save bar */}
      <div
        className="sticky bottom-4 z-10 mt-2 flex items-center justify-between gap-4 rounded-2xl border px-5 py-4 shadow-[0_14px_40px_-18px_rgba(15,40,75,0.28)]"
        style={{
          borderColor: "var(--color-warm-gray-200)",
          backgroundColor: "var(--color-white)",
        }}
      >
        <p
          className="hidden text-[13px] sm:block"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {isEditing
            ? "Updating an existing property."
            : "Saving will create your property."}
        </p>
        <div className="flex items-center gap-3">
          <Link
            href="/workspace/setup"
            className="rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: "var(--color-brand)" }}
          >
            {pending ? "Saving..." : "Save and continue"}
            <ArrowRight size={14} weight="bold" />
          </button>
        </div>
      </div>
    </form>
  );
}

function FormSection({
  eyebrow,
  title,
  description,
  children,
  errorId,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  errorId?: string;
}) {
  return (
    <section
      aria-describedby={errorId}
      className="grid grid-cols-1 gap-6 rounded-2xl border p-6 md:grid-cols-[220px_1fr] md:gap-10 md:p-8"
      style={{
        borderColor: "var(--color-warm-gray-200)",
        backgroundColor: "var(--color-white)",
      }}
    >
      <header>
        <p
          className="text-[10px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          Step {eyebrow}
        </p>
        <h2
          className="mt-1 text-lg font-semibold leading-snug tracking-tight"
          style={{ color: "var(--color-text-primary)" }}
        >
          {title}
        </h2>
        {description ? (
          <p
            className="mt-1.5 text-[13px] leading-relaxed"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {description}
          </p>
        ) : null}
      </header>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function TextInput({
  name,
  label,
  defaultValue,
  placeholder,
  required,
  error,
  type = "text",
  inputMode,
  min,
  max,
  step,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
  type?: string;
  inputMode?: "numeric" | "text" | "decimal";
  min?: string;
  max?: string;
  step?: string;
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
        {required ? (
          <span
            aria-hidden
            className="ml-1"
            style={{ color: "var(--color-brand)" }}
          >
            *
          </span>
        ) : null}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        inputMode={inputMode}
        min={min}
        max={max}
        step={step}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className="rounded-lg border px-3.5 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2"
        style={{
          borderColor: error
            ? "#e3867a"
            : "var(--color-warm-gray-200)",
          backgroundColor: "var(--color-white)",
          color: "var(--color-text-primary)",
        }}
      />
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </div>
  );
}

function SelectInput({
  name,
  label,
  defaultValue,
  required,
  error,
  options,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
  error?: string;
  options: { value: string; label: string }[];
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
        {required ? (
          <span
            aria-hidden
            className="ml-1"
            style={{ color: "var(--color-brand)" }}
          >
            *
          </span>
        ) : null}
      </label>
      <CustomSelect
        id={id}
        name={name}
        defaultValue={defaultValue}
        required={required}
        hasError={Boolean(error)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        options={options}
      />
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </div>
  );
}

function FieldError({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <p
      id={id}
      className="flex items-center gap-1 text-[12px] font-medium"
      style={{ color: "#c0372a" }}
    >
      <WarningCircle size={12} weight="fill" />
      {children}
    </p>
  );
}
