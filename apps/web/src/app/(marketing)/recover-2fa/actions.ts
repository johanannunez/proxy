"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  consumeBackupCode,
  resetUserMfa,
} from "@/lib/auth/mfa";
import { logTimelineEvent } from "@/lib/timeline";

export type RecoverState = {
  error: string | null;
  locked: boolean;
};

/**
 * Lost-device recovery. The user enters one backup code. A valid code proves
 * identity: we wipe the lost authenticator and remaining backup codes, then
 * send the user to the forced enrollment wizard to set up a fresh authenticator.
 *
 * A backup code never elevates the session to aal2 on its own (Supabase only
 * grants aal2 through a real TOTP verify), so recovery always re-enrolls.
 */
export async function recoverWithBackupCode(
  _prev: RecoverState,
  formData: FormData,
): Promise<RecoverState> {
  const code = String(formData.get("code") ?? "").trim();

  if (!code) {
    return { error: "Enter one of your backup codes.", locked: false };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: "Your session expired. Please sign in again.",
      locked: false,
    };
  }

  const result = await consumeBackupCode(user.id, code);

  if (result.locked) {
    return {
      error: "Too many attempts. Try again in 10 minutes.",
      locked: true,
    };
  }

  if (!result.ok) {
    return {
      error: "That backup code is not valid. Check it and try again.",
      locked: false,
    };
  }

  const reset = await resetUserMfa(user.id);
  if (!reset.ok) {
    return {
      error: reset.error ?? "We could not reset your authenticator. Try again.",
      locked: false,
    };
  }

  void logTimelineEvent({
    ownerId: user.id,
    eventType: "2fa_recovery_used",
    category: "account",
    title: "Two-factor recovery code used",
    visibility: "admin_only",
  });

  redirect("/enroll-2fa");
}
