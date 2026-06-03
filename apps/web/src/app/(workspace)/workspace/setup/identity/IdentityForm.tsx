"use client";

import { useActionState, useId, useState } from "react";
import { WarningCircle, UploadSimple } from "@phosphor-icons/react";
import { StepSaveBar } from "@/components/workspace/setup/StepShell";
import { saveIdentity, type SaveIdentityState } from "./actions";
import { CustomSelect } from "@/components/workspace/CustomSelect";

type IdentityInitial = {
  legal_name: string;
  license_number: string;
  issuing_state: string;
  expiration_date: string;
  front_photo_url: string;
  back_photo_url: string;
  consent_given: boolean;
};

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID",
  "IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS",
  "MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK",
  "OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV",
  "WI","WY",
];

const initialState: SaveIdentityState = {};

export function IdentityForm({
  initial,
  isEditing,
}: {
  initial: IdentityInitial;
  isEditing: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    saveIdentity,
    initialState,
  );
  const [consent, setConsent] = useState(initial.consent_given);
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);

  const err = (key: string) => state.fieldErrors?.[key];

  return (
    <form action={formAction} className="flex flex-col gap-8">
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
          <WarningCircle size={18} weight="fill" style={{ color: "#c0372a" }} />
          <span>{state.error}</span>
        </div>
      ) : null}

      <Section title="License details">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInput
            name="legal_name"
            label="Full legal name"
            defaultValue={initial.legal_name}
            placeholder="As it appears on your license"
            required
            error={err("legal_name")}
          />
          <TextInput
            name="license_number"
            label="License number"
            defaultValue={initial.license_number}
            required
            error={err("license_number")}
          />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label
              className="text-[12px] font-semibold uppercase tracking-[0.08em]"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              Issuing state <span style={{ color: "var(--color-brand)" }}>*</span>
            </label>
            <CustomSelect
              name="issuing_state"
              defaultValue={initial.issuing_state}
              required
              hasError={Boolean(err("issuing_state"))}
              aria-invalid={Boolean(err("issuing_state"))}
              options={[{ value: "", label: "Select" }, ...US_STATES.map((s) => ({ value: s, label: s }))]}
            />
          </div>
          <TextInput
            name="expiration_date"
            label="Expiration date"
            defaultValue={initial.expiration_date}
            type="date"
            required
            error={err("expiration_date")}
          />
        </div>
      </Section>

      <Section title="Upload photos of your license">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FileUploadBox
            name="front_photo"
            label="Front of license"
            file={frontFile}
            onFileChange={setFrontFile}
            existingUrl={initial.front_photo_url}
          />
          <FileUploadBox
            name="back_photo"
            label="Back of license"
            file={backFile}
            onFileChange={setBackFile}
            existingUrl={initial.back_photo_url}
          />
        </div>
      </Section>

      <Section title="Consent">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="consent"
            value="true"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border"
            style={{ borderColor: "var(--color-warm-gray-200)" }}
          />
          <span
            className="text-sm leading-relaxed"
            style={{ color: "var(--color-text-secondary)" }}
          >
            I confirm that the information provided is accurate and I consent
            to Proxy verifying my identity for compliance
            purposes. This data is stored securely and only used as required
            by applicable regulations.
          </span>
        </label>
        {err("consent") ? (
          <p
            className="mt-2 flex items-center gap-1 text-[12px] font-medium"
            style={{ color: "#c0372a" }}
          >
            <WarningCircle size={12} weight="fill" />
            {err("consent")}
          </p>
        ) : null}
      </Section>

      <StepSaveBar pending={pending} isEditing={isEditing} />
    </form>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-2xl border p-6"
      style={{
        borderColor: "var(--color-warm-gray-200)",
        backgroundColor: "var(--color-white)",
      }}
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
  required,
  error,
  type = "text",
  defaultValue,
}: {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
  type?: string;
  defaultValue?: string;
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
          <span className="ml-1" style={{ color: "var(--color-brand)" }}>*</span>
        ) : null}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue}
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

function FileUploadBox({
  name,
  label,
  file,
  onFileChange,
  existingUrl,
}: {
  name: string;
  label: string;
  file: File | null;
  onFileChange: (f: File | null) => void;
  existingUrl?: string;
}) {
  const id = useId();
  const hasExisting = existingUrl && !file;

  return (
    <div>
      <label
        htmlFor={id}
        className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 transition-colors hover:bg-[var(--color-warm-gray-50)]"
        style={{ borderColor: hasExisting ? "var(--color-brand)" : "var(--color-warm-gray-200)" }}
      >
        {hasExisting ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={existingUrl} alt={label} className="h-16 w-auto rounded object-contain" />
            <span className="text-xs font-medium" style={{ color: "var(--color-brand)" }}>
              Uploaded. Click to replace.
            </span>
          </>
        ) : (
          <>
            <UploadSimple
              size={24}
              weight="duotone"
              style={{ color: "var(--color-text-tertiary)" }}
            />
            <span
              className="text-sm font-medium"
              style={{ color: "var(--color-text-primary)" }}
            >
              {file ? file.name : label}
            </span>
            <span
              className="text-xs"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              {file ? `${(file.size / 1024).toFixed(0)} KB` : "Click or drag to upload"}
            </span>
          </>
        )}
      </label>
      <input
        id={id}
        name={name}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
