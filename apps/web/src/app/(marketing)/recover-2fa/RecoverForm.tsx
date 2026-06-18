"use client";

import { useActionState } from "react";
import styles from "@/components/auth/AuthCodeForm.module.css";
import { recoverWithBackupCode, type RecoverState } from "./actions";

const initialRecoverState: RecoverState = {
  error: null,
  locked: false,
};

export function RecoverForm() {
  const [state, formAction, isPending] = useActionState<RecoverState, FormData>(
    recoverWithBackupCode,
    initialRecoverState,
  );

  const disabled = isPending || state.locked;

  return (
    <form action={formAction} className={styles.form}>
      <div className={styles.field}>
        <label htmlFor="recover-code" className={styles.label}>
          Backup code
        </label>
        <input
          id="recover-code"
          name="code"
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          required
          disabled={disabled}
          placeholder="xxxx-xxxx"
          className={`${styles.codeInput} ${styles.recoveryInput} ${
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
        {isPending ? "Verifying..." : "Verify backup code"}
      </button>

      <p className={styles.helperRow}>
        Have your authenticator?{" "}
        <a href="/verify-2fa" className={styles.helperLink}>
          Enter a code instead
        </a>
      </p>
    </form>
  );
}
