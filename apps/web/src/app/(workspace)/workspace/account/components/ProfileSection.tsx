"use client"

import { useActionState, useState, useRef, useCallback } from "react"
import { CalendarBlank, Camera, Trash, PencilSimple, UploadSimple } from "@phosphor-icons/react"
import { updateProfile } from "../actions"
import { uploadAvatar, removeAvatar, getOriginalAvatar } from "../avatar-actions"
import { AvatarCropModal } from "@/components/workspace/AvatarCropModal"
import { CustomSelect } from "@/components/workspace/CustomSelect"

type Props = {
  profile: {
    full_name: string | null
    preferred_name: string | null
    email: string
    phone: string | null
    contact_method: string | null
    avatar_url: string | null
    created_at: string
  }
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    return parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("")
  }
  return email[0]?.toUpperCase() ?? "?"
}

/**
 * Parse "First M. Last" or "First Last" into parts.
 * Handles: "Johan A Nunez", "Johan A. Nunez", "Johan Nunez", "Johan"
 */
function parseName(fullName: string | null): { first: string; middle: string; last: string } {
  if (!fullName) return { first: "", middle: "", last: "" }
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return { first: parts[0], middle: "", last: "" }
  if (parts.length === 2) return { first: parts[0], middle: "", last: parts[1] }
  // 3+ parts: check if middle is a single letter (with or without period)
  const middlePart = parts[1].replace(".", "")
  if (middlePart.length === 1) {
    return { first: parts[0], middle: middlePart.toUpperCase(), last: parts.slice(2).join(" ") }
  }
  // Otherwise treat everything between first and last as middle
  return { first: parts[0], middle: "", last: parts.slice(1).join(" ") }
}

function formatMemberSince(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

export function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2
        className="text-xl font-semibold tracking-tight"
        style={{ color: "var(--color-text-primary)" }}
      >
        {title}
      </h2>
      <p
        className="mt-1 text-sm"
        style={{ color: "var(--color-text-secondary)" }}
      >
        {description}
      </p>
    </div>
  );
}

export default function ProfileSection({ profile }: Props) {
  const [state, formAction, isPending] = useActionState(updateProfile, null)
  const [phone, setPhone] = useState(profile.phone ? formatPhone(profile.phone) : "")
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Store the original image source in a ref so it survives across renders
  // without causing re-render loops
  const pendingOriginalRef = useRef<string | null>(null)

  const initials = getInitials(profile.full_name, profile.email)

  // New file selected from file picker
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      pendingOriginalRef.current = dataUrl
      setCropSrc(dataUrl)
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  // Re-edit existing avatar: fetch best available image and open cropper
  const handleEditExisting = useCallback(async () => {
    if (uploading) return
    setUploading(true)

    // Pass current avatar as fallback so we always get a URL back
    const result = await getOriginalAvatar(avatarUrl)
    setUploading(false)

    if (!result.url) {
      fileInputRef.current?.click()
      return
    }

    // Open the crop modal with the URL directly (no base64 conversion needed for display)
    // The AvatarCropModal accepts any image URL
    pendingOriginalRef.current = null // Will be fetched as base64 at crop time
    setCropSrc(result.url)
  }, [uploading, avatarUrl])

  // Click on the avatar circle
  const handleAvatarClick = () => {
    if (avatarUrl) {
      handleEditExisting()
    } else {
      fileInputRef.current?.click()
    }
  }

  // Crop completed: upload both original and cropped
  const handleCrop = async (croppedDataUrl: string) => {
    const originalBase64 = pendingOriginalRef.current ?? croppedDataUrl
    setCropSrc(null)
    setUploading(true)

    const result = await uploadAvatar({
      originalBase64,
      croppedBase64: croppedDataUrl,
    })

    setUploading(false)
    pendingOriginalRef.current = null

    if (result.success && result.avatarUrl) {
      setAvatarUrl(result.avatarUrl)
    }
  }

  const handleCropCancel = () => {
    setCropSrc(null)
    pendingOriginalRef.current = null
  }

  const handleRemove = async () => {
    setUploading(true)
    const result = await removeAvatar()
    setUploading(false)
    if (result.success) {
      setAvatarUrl(null)
    }
  }

  return (
    <section id="profile" className="scroll-mt-8">
      <h2
        className="text-xl font-semibold tracking-tight"
        style={{ color: "var(--color-text-primary)" }}
      >
        Profile
      </h2>
      <p
        className="mb-6 text-sm"
        style={{ color: "var(--color-text-secondary)" }}
      >
        Your personal details and contact preferences.
      </p>

      <div
        className="rounded-2xl border p-7"
        style={{
          backgroundColor: "var(--color-white)",
          borderColor: "var(--color-warm-gray-200)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <form action={formAction}>
          {/* Avatar + Member Since */}
          <div className="mb-6 flex items-center gap-4">
            <div className="group relative cursor-pointer">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={profile.full_name ?? "Avatar"}
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-full text-lg font-semibold text-white"
                  style={{ backgroundColor: "var(--color-brand)" }}
                >
                  {initials}
                </div>
              )}

              {/* Hover overlay */}
              <button
                type="button"
                onClick={handleAvatarClick}
                disabled={uploading}
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
              >
                {avatarUrl ? (
                  <PencilSimple size={18} weight="bold" className="text-white" />
                ) : (
                  <Camera size={20} weight="bold" className="text-white" />
                )}
              </button>

              {uploading ? (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <span
                className="text-sm font-medium"
                style={{ color: "var(--color-text-primary)" }}
              >
                {profile.full_name ?? profile.email}
              </span>
              <span
                className="inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{
                  backgroundColor: "var(--color-warm-gray-100)",
                  color: "var(--color-text-tertiary)",
                }}
              >
                <CalendarBlank size={12} weight="bold" />
                Member since {formatMemberSince(profile.created_at)}
              </span>
              <div className="flex items-center gap-3">
                {avatarUrl ? (
                  <>
                    <button
                      type="button"
                      onClick={handleEditExisting}
                      disabled={uploading}
                      className="flex items-center gap-1 text-xs font-medium transition-colors hover:underline"
                      style={{ color: "var(--color-brand)" }}
                    >
                      <PencilSimple size={11} weight="bold" />
                      Edit photo
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex items-center gap-1 text-xs font-medium transition-colors hover:underline"
                      style={{ color: "var(--color-text-tertiary)" }}
                    >
                      <UploadSimple size={11} weight="bold" />
                      Upload new
                    </button>
                    <button
                      type="button"
                      onClick={handleRemove}
                      disabled={uploading}
                      className="flex items-center gap-1 text-xs font-medium transition-colors hover:underline"
                      style={{ color: "var(--color-text-tertiary)" }}
                    >
                      <Trash size={11} />
                      Remove
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-1 text-xs font-medium transition-colors hover:underline"
                    style={{ color: "var(--color-brand)" }}
                  >
                    <UploadSimple size={11} weight="bold" />
                    Upload photo
                  </button>
                )}
              </div>
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {/* Crop Modal */}
          {cropSrc ? (
            <AvatarCropModal
              imageSrc={cropSrc}
              onCrop={handleCrop}
              onCancel={handleCropCancel}
            />
          ) : null}

          {/* Name Fields: First, Middle Initial, Last */}
          <div className="mb-5 grid grid-cols-[1fr_80px_1fr] gap-3">
            <div>
              <label
                htmlFor="first_name"
                className="mb-1.5 block text-sm font-medium"
                style={{ color: "var(--color-text-primary)" }}
              >
                First name <span style={{ color: "var(--color-error)" }}>*</span>
              </label>
              <input
                id="first_name"
                name="first_name"
                type="text"
                required
                defaultValue={parseName(profile.full_name).first}
                className="w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-[var(--color-brand)]"
                style={{
                  borderColor: "var(--color-warm-gray-200)",
                  color: "var(--color-text-primary)",
                  backgroundColor: "var(--color-white)",
                }}
              />
            </div>
            <div>
              <label
                htmlFor="middle_initial"
                className="mb-1.5 block text-sm font-medium"
                style={{ color: "var(--color-text-primary)" }}
              >
                M.I.
              </label>
              <input
                id="middle_initial"
                name="middle_initial"
                type="text"
                maxLength={1}
                defaultValue={parseName(profile.full_name).middle}
                placeholder=""
                className="w-full rounded-lg border px-3.5 py-2.5 text-center text-sm uppercase outline-none transition-colors focus:border-[var(--color-brand)]"
                style={{
                  borderColor: "var(--color-warm-gray-200)",
                  color: "var(--color-text-primary)",
                  backgroundColor: "var(--color-white)",
                }}
              />
            </div>
            <div>
              <label
                htmlFor="last_name"
                className="mb-1.5 block text-sm font-medium"
                style={{ color: "var(--color-text-primary)" }}
              >
                Last name <span style={{ color: "var(--color-error)" }}>*</span>
              </label>
              <input
                id="last_name"
                name="last_name"
                type="text"
                required
                defaultValue={parseName(profile.full_name).last}
                className="w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-[var(--color-brand)]"
                style={{
                  borderColor: "var(--color-warm-gray-200)",
                  color: "var(--color-text-primary)",
                  backgroundColor: "var(--color-white)",
                }}
              />
            </div>
          </div>

          {/* Preferred Name */}
          <div className="mb-5">
            <label
              htmlFor="preferred_name"
              className="mb-1.5 block text-sm font-medium"
              style={{ color: "var(--color-text-primary)" }}
            >
              Preferred name
            </label>
            <input
              id="preferred_name"
              name="preferred_name"
              type="text"
              defaultValue={profile.preferred_name ?? ""}
              placeholder="What should we call you?"
              className="w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-brand)]"
              style={{
                borderColor: "var(--color-warm-gray-200)",
                color: "var(--color-text-primary)",
                backgroundColor: "var(--color-white)",
              }}
            />
          </div>

          {/* Phone */}
          <div className="mb-5">
            <label
              htmlFor="phone"
              className="mb-1.5 block text-sm font-medium"
              style={{ color: "var(--color-text-primary)" }}
            >
              Phone
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="(555) 000-0000"
              className="w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-brand)]"
              style={{
                borderColor: "var(--color-warm-gray-200)",
                color: "var(--color-text-primary)",
                backgroundColor: "var(--color-white)",
              }}
            />
          </div>

          {/* Contact Method */}
          <div className="mb-6">
            <label
              htmlFor="contact_method"
              className="mb-1.5 block text-sm font-medium"
              style={{ color: "var(--color-text-primary)" }}
            >
              Preferred contact method
            </label>
            <CustomSelect
              id="contact_method"
              name="contact_method"
              defaultValue={profile.contact_method ?? "email"}
              options={[
                { value: "email", label: "Email" },
                { value: "phone", label: "Phone" },
                { value: "text", label: "Text" },
              ]}
            />
          </div>

          {/* Status Message */}
          {state && !state.ok && (
            <p
              className="mb-4 text-sm"
              style={{ color: "var(--color-error)" }}
            >
              {state.message}
            </p>
          )}
          {state?.ok && (
            <p
              className="mb-4 text-sm"
              style={{ color: "var(--color-success)" }}
            >
              {state.message}
            </p>
          )}

          {/* Save Button */}
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: "var(--color-brand)" }}
          >
            {isPending ? "Saving..." : "Save changes"}
          </button>
        </form>
      </div>
    </section>
  )
}
