"use client";

import { useMemo, useState, useEffect, useTransition, useRef, useCallback } from "react";
import { useWorkspaceName } from "@/app/(admin)/admin/workspaces/[workspaceId]/WorkspaceNameContext";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { z } from "zod";
import {
  updatePersonalInfo,
  type PersonalInfoInput,
} from "@/lib/admin/personal-info-actions";
import { saveInternalNote } from "@/lib/admin/owner-facts-actions";
import {
  uploadAdminAvatar,
  removeAdminAvatar,
  getAdminOriginalAvatar,
} from "@/lib/admin/admin-avatar-actions";
import { AvatarCropModal } from "@/components/workspace/AvatarCropModal";
import styles from "./PersonalInfoSection.module.css";

type ContactMethod = "email" | "sms" | "either";
type StoredContactMethod = "email" | "sms" | "phone" | "whatsapp" | null;

export type PersonalInfoSectionProps = {
  profile: {
    id: string;
    fullName: string;
    preferredName: string | null;
    email: string;
    phone: string | null;
    contactMethod: StoredContactMethod;
    avatarUrl: string | null;
  };
  internalNote: {
    text: string;
    updatedAt: string;
    createdByName: string | null;
  } | null;
  gradient: string;
};

/** Split "Johan Nunez" into { first: "Johan", last: "Nunez" }. */
function splitName(full: string): { first: string; last: string } {
  const trimmed = (full ?? "").trim();
  if (trimmed === "") return { first: "", last: "" };
  const idx = trimmed.indexOf(" ");
  if (idx === -1) return { first: trimmed, last: "" };
  return {
    first: trimmed.slice(0, idx),
    last: trimmed.slice(idx + 1).trim(),
  };
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function storedToUi(stored: StoredContactMethod): ContactMethod {
  if (stored === "sms") return "sms";
  if (stored === "email") return "email";
  return "either";
}

function uiToStored(ui: ContactMethod): "email" | "sms" | "phone" {
  if (ui === "email") return "email";
  if (ui === "sms") return "sms";
  return "phone";
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const FormSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim(),
  preferredName: z.string().trim(),
  phone: z.string().trim(),
});

export function PersonalInfoSection({
  profile,
  internalNote,
  gradient,
}: PersonalInfoSectionProps) {
  const seeded = useMemo(() => splitName(profile.fullName), [profile.fullName]);
  const workspaceName = useWorkspaceName();

  const [firstName, setFirstName] = useState(workspaceName?.firstName ?? seeded.first);
  const [lastName, setLastName] = useState(workspaceName?.lastName ?? seeded.last);

  // Live sync from the sidebar when inside the workspace detail shell.
  const contextFirst = workspaceName?.firstName;
  const contextLast = workspaceName?.lastName;
  useEffect(() => {
    if (contextFirst !== undefined) setFirstName(contextFirst);
    if (contextLast !== undefined) setLastName(contextLast);
  }, [contextFirst, contextLast]);
  const [preferredName, setPreferredName] = useState(
    profile.preferredName ?? "",
  );
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [contact, setContact] = useState<ContactMethod>(
    storedToUi(profile.contactMethod),
  );

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  // Avatar upload state
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingOriginalRef = useRef<string | null>(null);

  // Downscale to max 2048px on the longest side before opening the crop modal.
  // This keeps the server action payload well under any size limit regardless of
  // what the user picks (phone RAW, DSLR, etc.).
  const resizeToMax = (dataUrl: string, maxSide = 2048): Promise<string> =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const { naturalWidth: w, naturalHeight: h } = img;
        if (w <= maxSide && h <= maxSide) { resolve(dataUrl); return; }
        const scale = maxSide / Math.max(w, h);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.92));
      };
      img.src = dataUrl;
    });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = await resizeToMax(reader.result as string);
      pendingOriginalRef.current = dataUrl;
      setCropSrc(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleEditExisting = useCallback(async () => {
    if (avatarUploading) return;
    setAvatarError(null);
    setAvatarUploading(true);
    try {
      const result = await getAdminOriginalAvatar(profile.id, avatarUrl);
      if (!result.url) { fileInputRef.current?.click(); return; }
      pendingOriginalRef.current = null;
      setCropSrc(result.url);
    } catch {
      setAvatarError("Could not load the photo. Try uploading a new one.");
    } finally {
      setAvatarUploading(false);
    }
  }, [avatarUploading, avatarUrl, profile.id]);

  const handleCrop = async (croppedDataUrl: string) => {
    const originalBase64 = pendingOriginalRef.current ?? croppedDataUrl;
    setCropSrc(null);
    setAvatarError(null);
    setAvatarUploading(true);
    try {
      const result = await uploadAdminAvatar({
        targetProfileId: profile.id,
        originalBase64,
        croppedBase64: croppedDataUrl,
      });
      if (result.error) {
        setAvatarError(result.error);
      } else if (result.avatarUrl) {
        setAvatarUrl(result.avatarUrl);
        workspaceName?.setAvatarUrl(result.avatarUrl);
      }
    } catch {
      setAvatarError("Upload failed. Please try again.");
    } finally {
      setAvatarUploading(false);
      pendingOriginalRef.current = null;
    }
  };

  const handleRemoveAvatar = async () => {
    setAvatarError(null);
    setAvatarUploading(true);
    try {
      const result = await removeAdminAvatar(profile.id);
      if (result.error) {
        setAvatarError(result.error);
      } else {
        setAvatarUrl(null);
        workspaceName?.setAvatarUrl(null);
      }
    } catch {
      setAvatarError("Could not remove the photo. Please try again.");
    } finally {
      setAvatarUploading(false);
    }
  };

  const [noteText, setNoteText] = useState(internalNote?.text ?? "");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteSuccess, setNoteSuccess] = useState(false);
  const [notePending, startNoteTransition] = useTransition();

  const initialSnapshot = useMemo(
    () => ({
      firstName: seeded.first,
      lastName: seeded.last,
      preferredName: profile.preferredName ?? "",
      phone: profile.phone ?? "",
      contact: storedToUi(profile.contactMethod),
    }),
    [profile, seeded.first, seeded.last],
  );

  function resetForm() {
    setFirstName(initialSnapshot.firstName);
    setLastName(initialSnapshot.lastName);
    setPreferredName(initialSnapshot.preferredName);
    setPhone(initialSnapshot.phone);
    setContact(initialSnapshot.contact);
    setFormError(null);
    setFormSuccess(false);
  }

  function onSave() {
    setFormError(null);
    setFormSuccess(false);

    const parsed = FormSchema.safeParse({
      firstName,
      lastName,
      preferredName,
      phone,
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Check the fields.");
      return;
    }

    const payload: PersonalInfoInput = {
      profileId: profile.id,
      firstName: capitalize(parsed.data.firstName),
      lastName: capitalize(parsed.data.lastName),
      preferredName: parsed.data.preferredName,
      phone: parsed.data.phone,
      contactMethod: uiToStored(contact),
    };

    startTransition(async () => {
      const result = await updatePersonalInfo(payload);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      setFormSuccess(true);
    });
  }

  function onSaveNote() {
    setNoteError(null);
    setNoteSuccess(false);

    startNoteTransition(async () => {
      const result = await saveInternalNote(profile.id, noteText);
      if (!result.ok) {
        setNoteError(result.error);
        return;
      }
      setNoteSuccess(true);
    });
  }

  return (
    <div>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Personal info</h2>
        <p className={styles.sectionSubtitle}>
          Name, photo, and how we reach the owner.
        </p>
      </div>

      {/* --- Main info card --- */}
      <div className={styles.card}>
        <div className={styles.cardBody}>
          {formError ? (
            <div className={styles.inlineError} role="alert">
              {formError}
            </div>
          ) : null}
          {formSuccess ? (
            <div className={styles.inlineSuccess} role="status">
              Personal info saved.
            </div>
          ) : null}

          {/* Avatar row */}
          <div className={styles.row}>
            <div className={styles.labelCell}>
              <span className={styles.label}>Profile photo</span>
              <span className={styles.labelHint}>
                Shown to the team and on the owner workspace.
              </span>
            </div>
            <div className={styles.fieldCell}>
              <div className={styles.avatarRow}>
                <div
                  className={styles.avatar}
                  style={{ background: avatarUrl ? "transparent" : gradient }}
                  aria-hidden
                >
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                  ) : (
                    initials(profile.fullName || profile.email)
                  )}
                  {avatarUploading && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.45)", borderRadius: "50%" }}>
                      <div style={{ width: 20, height: 20, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                    </div>
                  )}
                </div>
                <div className={styles.avatarActions}>
                  {avatarUrl ? (
                    <>
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        onClick={handleEditExisting}
                        disabled={avatarUploading}
                      >
                        Edit photo
                      </button>
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        onClick={() => fileInputRef.current?.click()}
                        disabled={avatarUploading}
                      >
                        Upload new
                      </button>
                      <button
                        type="button"
                        className={styles.btnGhost}
                        onClick={handleRemoveAvatar}
                        disabled={avatarUploading}
                      >
                        Remove
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      onClick={() => fileInputRef.current?.click()}
                      disabled={avatarUploading}
                    >
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
                style={{ display: "none" }}
                onChange={handleFileSelect}
              />

              {/* Inline error */}
              {avatarError && (
                <p style={{ marginTop: 8, fontSize: 12, color: "var(--color-error, #c0392b)" }}>
                  {avatarError}
                </p>
              )}

              {/* Crop modal */}
              {cropSrc && (
                <AvatarCropModal
                  imageSrc={cropSrc}
                  onCrop={handleCrop}
                  onCancel={() => { setCropSrc(null); pendingOriginalRef.current = null; }}
                />
              )}
            </div>
          </div>

          {/* Legal name */}
          <div className={styles.row}>
            <div className={styles.labelCell}>
              <span className={styles.label}>Legal name</span>
              <span className={styles.labelHint}>
                Must match the name on tax documents.
              </span>
            </div>
            <div className={styles.fieldCell}>
              <div className={styles.inputRow}>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="First name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                />
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                />
              </div>
            </div>
          </div>

          {/* Preferred name */}
          <div className={styles.row}>
            <div className={styles.labelCell}>
              <span className={styles.label}>Preferred name</span>
              <span className={styles.labelHint}>
                What to call them day to day. Optional.
              </span>
            </div>
            <div className={styles.fieldCell}>
              <input
                type="text"
                className={styles.input}
                placeholder="e.g. Jo"
                value={preferredName}
                onChange={(e) => setPreferredName(e.target.value)}
              />
            </div>
          </div>

          {/* Email */}
          <div className={styles.row}>
            <div className={styles.labelCell}>
              <span className={styles.label}>Email</span>
              <span className={styles.labelHint}>
                Read-only. Changing requires verification flow.
              </span>
            </div>
            <div className={styles.fieldCell}>
              <div className={styles.emailWrap}>
                <input
                  type="email"
                  className={styles.input}
                  value={profile.email}
                  readOnly
                  disabled
                />
                <span className={styles.verifiedPill} aria-label="Verified">
                  <CheckCircle size={12} weight="fill" />
                  Verified
                </span>
              </div>
            </div>
          </div>

          {/* Phone */}
          <div className={styles.row}>
            <div className={styles.labelCell}>
              <span className={styles.label}>Phone</span>
              <span className={styles.labelHint}>
                Used for SMS alerts and urgent calls.
              </span>
            </div>
            <div className={styles.fieldCell}>
              <input
                type="tel"
                className={styles.input}
                placeholder="(555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                autoComplete="tel"
              />
            </div>
          </div>

          {/* Preferred contact */}
          <div className={styles.row}>
            <div className={styles.labelCell}>
              <span className={styles.label}>Preferred contact</span>
              <span className={styles.labelHint}>
                How the owner wants to hear from us.
              </span>
            </div>
            <div className={styles.fieldCell}>
              <div
                className={styles.segmented}
                role="radiogroup"
                aria-label="Preferred contact method"
              >
                {(["email", "sms", "either"] as const).map((key) => {
                  const label =
                    key === "email" ? "Email" : key === "sms" ? "SMS" : "Either";
                  const isActive = contact === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      className={`${styles.segmentedBtn} ${
                        isActive ? styles.segmentedBtnActive : ""
                      }`}
                      onClick={() => setContact(key)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.cardFooter}>
          <span className={styles.cardFooterHint}>Last updated recently</span>
          <div className={styles.cardFooterActions}>
            <button
              type="button"
              className={styles.btnGhost}
              onClick={resetForm}
              disabled={pending}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={onSave}
              disabled={pending}
            >
              {pending ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      </div>

      {/* --- Internal notes card --- */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardHeaderTitle}>Internal notes</span>
          <span className={styles.adminPill}>Admin only</span>
        </div>
        <div className={styles.cardHeaderSub}>
          Private notes about this owner. Not visible in their portal.
        </div>
        <div className={styles.cardBody}>
          {noteError ? (
            <div className={styles.inlineError} role="alert">
              {noteError}
            </div>
          ) : null}
          {noteSuccess ? (
            <div className={styles.inlineSuccess} role="status">
              Note saved.
            </div>
          ) : null}
          <textarea
            className={styles.textarea}
            placeholder="Anything the team should know. Preferences, quirks, background, relationship history."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={5}
          />
        </div>
        <div className={styles.cardFooter}>
          <span className={styles.cardFooterHint}>
            Only admins can see this field.
            {internalNote?.createdByName
              ? ` Last saved by ${internalNote.createdByName}.`
              : ""}
          </span>
          <div className={styles.cardFooterActions}>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={onSaveNote}
              disabled={notePending}
            >
              {notePending ? "Saving..." : "Save note"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
