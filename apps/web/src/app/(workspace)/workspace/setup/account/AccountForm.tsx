"use client";

import { useActionState, useEffect, useId, useRef, useState, useCallback } from "react";
import {
  Camera,
  ChatCircle,
  Envelope,
  Phone,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { saveAccount, type SaveAccountState } from "./actions";
import { StepSaveBar } from "@/components/workspace/setup/StepShell";
import { CustomSelect } from "@/components/workspace/CustomSelect";

type MailingAddress = {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  emergency_contact?: { name?: string; phone?: string } | null;
};

export type AccountInitial = {
  first_name: string;
  last_name: string;
  preferred_name: string;
  phone: string;
  avatar_url: string;
  contact_method: string;
  timezone: string;
  referral_source: string;
  mailing_address: MailingAddress | null;
};

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID",
  "IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS",
  "MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK",
  "OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV",
  "WI","WY",
];

const US_TIMEZONES: { value: string; label: string }[] = [
  { value: "America/New_York", label: "Eastern (ET)" },
  { value: "America/Chicago", label: "Central (CT)" },
  { value: "America/Denver", label: "Mountain (MT)" },
  { value: "America/Los_Angeles", label: "Pacific (PT)" },
  { value: "America/Anchorage", label: "Alaska (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii (HT)" },
];

const CONTACT_METHODS: { value: string; label: string; icon: React.ReactNode }[] = [
  { value: "text", label: "Text message", icon: <Phone size={18} weight="duotone" /> },
  { value: "email", label: "Email", icon: <Envelope size={18} weight="duotone" /> },
  { value: "workspace", label: "Workspace message", icon: <ChatCircle size={18} weight="duotone" /> },
];

const initialState: SaveAccountState = {};

function detectTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (US_TIMEZONES.some((t) => t.value === tz)) return tz;
  } catch { /* ignore */ }
  return "";
}

/** Resize an image file to fit within maxSize, returning a new File. */
async function resizeImage(file: File, maxSize: number): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width <= maxSize && height <= maxSize) {
        resolve(file);
        return;
      }
      // Scale down to fit
      const scale = maxSize / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          resolve(new File([blob], file.name, { type: file.type }));
        },
        file.type,
        0.9,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

export function AccountForm({
  initial,
  email,
  userId,
  isEditing,
}: {
  initial: AccountInitial;
  email: string;
  userId: string;
  isEditing: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveAccount, initialState);
  const err = (key: string) => state.fieldErrors?.[key];

  // Avatar state
  const [avatarUrl, setAvatarUrl] = useState(initial.avatar_url || "");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Contact methods (multi-select, stored as comma-separated)
  const [contactMethods, setContactMethods] = useState<Set<string>>(
    () => new Set(initial.contact_method ? initial.contact_method.split(",").filter(Boolean) : []),
  );
  const toggleContactMethod = (value: string) => {
    setContactMethods((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  // Timezone: auto-detect if not already set
  const [timezone, setTimezone] = useState(initial.timezone || "");
  useEffect(() => {
    if (!timezone) {
      const detected = detectTimezone();
      if (detected) setTimezone(detected);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Mailing address defaults
  const addr = initial.mailing_address;
  const emergency = addr?.emergency_contact;

  // Emergency contact opt-out
  const [hasEmergencyContact, setHasEmergencyContact] = useState(
    Boolean(emergency?.name || emergency?.phone),
  );

  // Initials for avatar fallback
  const fullName = [initial.first_name, initial.last_name].filter(Boolean).join(" ");
  const initials = buildInitials(fullName || email);

  const handleAvatarUpload = useCallback(async (file: File) => {
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) return;
    if (file.size > 5 * 1024 * 1024) return;

    setUploading(true);
    try {
      // Resize to 512px max dimension for avatars
      const resized = await resizeImage(file, 512);

      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${userId}/avatar/profile.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("property-photos")
        .upload(path, resized, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("property-photos")
        .getPublicUrl(path);

      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      setAvatarUrl(publicUrl);

      await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", userId);
    } catch {
      // Silently fail, user can retry
    } finally {
      setUploading(false);
    }
  }, [userId]);

  async function handleRemoveAvatar() {
    setAvatarUrl("");
    const supabase = createClient();
    await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", userId);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleAvatarUpload(file);
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.error ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border px-4 py-3 text-sm"
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

      {/* Hidden fields for non-input state */}
      <input type="hidden" name="avatar_url" value={avatarUrl} />
      <input type="hidden" name="contact_method" value={Array.from(contactMethods).join(",")} />
      <input type="hidden" name="timezone" value={timezone} />
      <input type="hidden" name="has_emergency_contact" value={hasEmergencyContact ? "yes" : "no"} />

      {/* 1. Profile photo */}
      <FormSection title="Profile photo">
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="group relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-dashed transition-colors hover:border-[var(--color-brand)]"
            style={{
              borderColor: avatarUrl ? "transparent" : "var(--color-warm-gray-200)",
              backgroundColor: avatarUrl ? "transparent" : "var(--color-warm-gray-50)",
            }}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt="Profile photo"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-0.5">
                <Camera
                  size={20}
                  weight="duotone"
                  className="transition-colors group-hover:text-[var(--color-brand)]"
                  style={{ color: "var(--color-text-tertiary)" }}
                />
                <span
                  className="text-lg font-semibold leading-none"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {initials}
                </span>
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-white/70">
                <div
                  className="h-5 w-5 animate-spin rounded-full border-2 border-transparent"
                  style={{ borderTopColor: "var(--color-brand)" }}
                />
              </div>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleAvatarUpload(f);
            }}
          />
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-sm font-medium transition-colors hover:opacity-80"
              style={{ color: "var(--color-brand)" }}
            >
              {avatarUrl ? "Change photo" : "Upload photo"}
            </button>
            {avatarUrl ? (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                className="flex items-center gap-1 text-xs transition-colors hover:opacity-80"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                <Trash size={12} weight="duotone" />
                Remove
              </button>
            ) : (
              <p
                className="text-xs"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                JPG, PNG, or WebP. Max 5 MB. Auto-resized to 512px.
              </p>
            )}
          </div>
        </div>
      </FormSection>

      {/* 2. Personal details + mailing address (merged) */}
      <FormSection title="Your details">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextInput
            name="first_name"
            label="First name"
            defaultValue={initial.first_name}
            placeholder="Robert"
            required
            error={err("first_name")}
          />
          <TextInput
            name="last_name"
            label="Last name"
            defaultValue={initial.last_name}
            placeholder="Kiyosaki"
            required
            error={err("last_name")}
          />
          <TextInput
            name="preferred_name"
            label="Preferred name"
            defaultValue={initial.preferred_name}
            placeholder="Robert"
            helper="What should we call you? This is what you will see in greetings."
            error={err("preferred_name")}
          />
          <TextInput
            name="phone"
            label="Phone"
            defaultValue={initial.phone}
            placeholder="+1 (808) 555-0147"
            type="tel"
            required
            error={err("phone")}
          />
          <ReadOnlyField label="Email" value={email} />
        </div>

        <div
          className="my-4 border-t"
          style={{ borderColor: "var(--color-warm-gray-100)" }}
        />

        <p
          className="mb-3 text-[12px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          Mailing address
        </p>
        <div className="grid grid-cols-1 gap-3">
          <TextInput
            name="street"
            label="Street address"
            defaultValue={addr?.street ?? ""}
            placeholder="110 E 87th Street"
            required
            error={err("street")}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px_120px]">
            <TextInput
              name="city"
              label="City"
              defaultValue={addr?.city ?? ""}
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
                defaultValue={addr?.state ?? ""}
                required
                hasError={Boolean(err("state"))}
                aria-invalid={Boolean(err("state"))}
                options={[{ value: "", label: "Select" }, ...US_STATES.map((s) => ({ value: s, label: s }))]}
              />
              {err("state") ? <FieldError>{err("state")}</FieldError> : null}
            </div>
            <TextInput
              name="zip"
              label="ZIP"
              defaultValue={addr?.zip ?? ""}
              required
              inputMode="numeric"
              error={err("zip")}
            />
          </div>
        </div>
      </FormSection>

      {/* 3. Emergency contact with opt-out */}
      <FormSection title="Emergency contact">
        <div className="flex items-start justify-between gap-4">
          <p
            className="text-sm"
            style={{ color: "var(--color-text-secondary)" }}
          >
            If something happens at the property and we cannot reach you, who should we call?
          </p>
          <button
            type="button"
            onClick={() => setHasEmergencyContact(!hasEmergencyContact)}
            className="flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              borderColor: "var(--color-warm-gray-200)",
              color: hasEmergencyContact
                ? "var(--color-text-secondary)"
                : "var(--color-brand)",
              backgroundColor: hasEmergencyContact
                ? "var(--color-white)"
                : "rgba(2, 170, 235, 0.06)",
            }}
          >
            {hasEmergencyContact ? "Skip this" : "Add a contact"}
          </button>
        </div>
        {hasEmergencyContact ? (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextInput
              name="emergency_name"
              label="Contact name"
              defaultValue={emergency?.name ?? ""}
              placeholder="Conrad Hilton"
            />
            <TextInput
              name="emergency_phone"
              label="Contact phone"
              defaultValue={emergency?.phone ?? ""}
              placeholder="+1 (808) 555-0199"
              type="tel"
            />
          </div>
        ) : (
          <p
            className="mt-2 text-xs"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            No emergency contact provided. You can add one anytime.
          </p>
        )}
      </FormSection>

      {/* 4. Communication preferences */}
      <FormSection title="Communication preferences">
        <div className="mb-4">
          <p
            className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            How should we reach you for urgent updates?
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {CONTACT_METHODS.map((method) => {
              const selected = contactMethods.has(method.value);
              return (
                <button
                  key={method.value}
                  type="button"
                  onClick={() => toggleContactMethod(method.value)}
                  className="flex items-center gap-2.5 rounded-lg border-2 px-3.5 py-2.5 text-left transition-colors"
                  style={{
                    borderColor: selected
                      ? "var(--color-brand)"
                      : "var(--color-warm-gray-200)",
                    backgroundColor: selected
                      ? "rgba(2, 170, 235, 0.04)"
                      : "var(--color-white)",
                  }}
                >
                  <span
                    style={{
                      color: selected
                        ? "var(--color-brand)"
                        : "var(--color-text-tertiary)",
                    }}
                  >
                    {method.icon}
                  </span>
                  <span
                    className="text-sm font-medium"
                    style={{
                      color: selected
                        ? "var(--color-brand)"
                        : "var(--color-text-primary)",
                    }}
                  >
                    {method.label}
                  </span>
                  <span
                    className="ml-auto flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors"
                    style={{
                      borderColor: selected
                        ? "var(--color-brand)"
                        : "var(--color-warm-gray-200)",
                      backgroundColor: selected ? "var(--color-brand)" : "transparent",
                    }}
                  >
                    {selected && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            className="text-[12px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Your time zone
          </label>
          <CustomSelect
            value={timezone}
            onChange={(v) => setTimezone(v)}
            options={[{ value: "", label: "Select time zone" }, ...US_TIMEZONES]}
          />
          <p
            className="text-xs"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            We use this for scheduling and notifications.
          </p>
        </div>
      </FormSection>

      <StepSaveBar pending={pending} isEditing={isEditing} />
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared sub-components                                             */
/* ------------------------------------------------------------------ */

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-2xl border p-5"
      style={{
        borderColor: "var(--color-warm-gray-200)",
        backgroundColor: "var(--color-white)",
      }}
    >
      <h2
        className="mb-3 text-base font-semibold tracking-tight"
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
  defaultValue,
  placeholder,
  required,
  error,
  helper,
  type = "text",
  inputMode,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
  helper?: string;
  type?: string;
  inputMode?: "numeric" | "text" | "tel";
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
        inputMode={inputMode}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        aria-invalid={Boolean(error)}
        className="rounded-lg border px-3.5 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2"
        style={{
          borderColor: error ? "#e3867a" : "var(--color-warm-gray-200)",
          backgroundColor: "var(--color-white)",
          color: "var(--color-text-primary)",
        }}
      />
      {helper && !error ? (
        <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
          {helper}
        </p>
      ) : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span
        className="text-[12px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        {label}
      </span>
      <div
        className="rounded-lg border px-3.5 py-2.5 text-sm"
        style={{
          borderColor: "var(--color-warm-gray-200)",
          backgroundColor: "var(--color-warm-gray-50)",
          color: "var(--color-text-secondary)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="flex items-center gap-1 text-[12px] font-medium"
      style={{ color: "#c0372a" }}
    >
      <WarningCircle size={12} weight="fill" />
      {children}
    </p>
  );
}

function buildInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "O";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
