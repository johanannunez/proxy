"use client";

import { useActionState, useEffect, useState } from "react";
import {
  initialTotpVerifyState,
  type TotpVerifyState,
} from "@/components/auth/TotpEnrollment";
import styles from "@/components/auth/AuthCodeForm.module.css";
import { verifyLoginTotp } from "./actions";

interface VerifyTotpFormProps {
  factorId: string;
  redirectTo: string;
}

export function VerifyTotpForm({ factorId, redirectTo }: VerifyTotpFormProps) {
  const [state, formAction, isPending] = useActionState<
    TotpVerifyState,
    FormData
  >(verifyLoginTotp, initialTotpVerifyState);

  const [now, setNow] = useState(() => Date.now());
  const isLocked = state.lockedUntil != null && state.lockedUntil > now;

  useEffect(() => {
    if (!isLocked) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isLocked]);

  const disabled = isPending || isLocked;

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="factorId" value={factorId} />
      <input type="hidden" name="redirect" value={redirectTo} />

      <div className={styles.field}>
        <label htmlFor="login-totp-code" className={styles.label}>
          Authenticator code
        </label>
        <input
          id="login-totp-code"
          name="code"
          type="text"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          autoComplete="one-time-code"
          autoFocus
          required
          disabled={disabled}
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
        {isPending ? "Verifying..." : "Verify and continue"}
      </button>

      <p className={styles.helperRow}>
        Lost your device?{" "}
        <a href="/recover-2fa" className={styles.helperLink}>
          Use a backup code
        </a>
      </p>
    </form>
  );
}
