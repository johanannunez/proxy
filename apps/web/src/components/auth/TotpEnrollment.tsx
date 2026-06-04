"use client";

import { useActionState, useEffect, useState } from "react";
import { ShieldCheck, Copy, CheckCircle } from "@phosphor-icons/react";
import styles from "./TotpEnrollment.module.css";

/**
 * Result state returned by a TOTP verification server action. Designed so the
 * same component works for owner self-service and the forced admin wizard.
 */
export type TotpVerifyState = {
  error: string | null;
  lockedUntil: number | null;
};

export const initialTotpVerifyState: TotpVerifyState = {
  error: null,
  lockedUntil: null,
};

/** A server action compatible with useActionState for verifying the code. */
export type TotpVerifyAction = (
  prevState: TotpVerifyState,
  formData: FormData,
) => Promise<TotpVerifyState>;

export interface TotpEnrollmentProps {
  /** Enrollment values, started server-side by the caller. */
  factorId: string;
  qrCode: string;
  secret: string;
  /** Server action that challenges + verifies the entered code. */
  verifyAction: TotpVerifyAction;
  /** Optional heading override. */
  title?: string;
  /** Optional supporting copy override. */
  subtitle?: string;
  /** Optional label for the submit button. */
  submitLabel?: string;
}

export function TotpEnrollment({
  factorId,
  qrCode,
  secret,
  verifyAction,
  title = "Set up two-factor authentication",
  subtitle = "Scan the code with an authenticator app like 1Password, Google Authenticator, or Authy. Then enter the 6-digit code it shows.",
  submitLabel = "Verify and enable",
}: TotpEnrollmentProps) {
  const [copied, setCopied] = useState(false);
  const [state, formAction, isPending] = useActionState(
    verifyAction,
    initialTotpVerifyState,
  );

  const [now, setNow] = useState(() => Date.now());
  const isLocked = state.lockedUntil != null && state.lockedUntil > now;

  useEffect(() => {
    if (!isLocked) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isLocked]);

  const handleCopySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may be unavailable. The manual code is still visible.
    }
  };

  const disabled = isPending || isLocked;

  return (
    <div className={styles.shell}>
      <div className={styles.header}>
        <div className={styles.badge}>
          <ShieldCheck size={28} weight="duotone" />
        </div>
        <div className={styles.headingGroup}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>
      </div>

      <div className={styles.qrSection}>
        <p className={styles.sectionLabel}>
          Scan this QR code with your authenticator app
        </p>
        <div className={styles.qrFrame}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrCode}
            alt="Two-factor authentication QR code"
            width={180}
            height={180}
            className={styles.qrImage}
          />
        </div>
      </div>

      <div className={styles.secretSection}>
        <p className={styles.sectionLabel}>Or enter this code manually</p>
        <div className={styles.secretRow}>
          <code className={styles.secretCode}>{secret}</code>
          <button
            type="button"
            onClick={handleCopySecret}
            title="Copy setup code"
            aria-label="Copy setup code"
            className={`${styles.copyButton} ${
              copied ? styles.copyButtonDone : ""
            }`}
          >
            {copied ? (
              <CheckCircle size={18} weight="duotone" />
            ) : (
              <Copy size={18} weight="duotone" />
            )}
          </button>
        </div>
      </div>

      <form action={formAction} className={styles.form}>
        <input type="hidden" name="factorId" value={factorId} />

        <div className={styles.field}>
          <label htmlFor="totp-code" className={styles.label}>
            Verification code
          </label>
          <input
            id="totp-code"
            name="code"
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            autoComplete="one-time-code"
            autoFocus
            disabled={disabled}
            required
            placeholder="000000"
            className={`${styles.codeInput} ${
              state.error ? styles.codeInputError : ""
            }`}
          />
          {state.error && (
            <p role="alert" className={styles.errorText}>
              {state.error}
            </p>
          )}
        </div>

        <button type="submit" disabled={disabled} className={styles.submit}>
          {isPending ? "Verifying..." : submitLabel}
        </button>
      </form>
    </div>
  );
}
