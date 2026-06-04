"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { challengeAndVerify } from "@/lib/auth/mfa";
import { logTimelineEvent } from "@/lib/timeline";
import type { TotpVerifyState } from "@/components/auth/TotpEnrollment";

// Process-local rate limiting: 5 failed attempts then a 10-minute lockout.
const enrollRateLimit = new Map<
  string,
  { attempts: number; lockedUntil: number }
>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 10 * 60 * 1000;

/**
 * Verify the code shown by the authenticator app during forced enrollment. On
 * success the factor is activated (session elevates to aal2) and we advance to
 * the backup-codes step. Backup codes are generated on that server render so
 * they are never carried through a redirect URL.
 */
export async function verifyEnrollTotp(
  _prev: TotpVerifyState,
  formData: FormData,
): Promise<TotpVerifyState> {
  const factorId = String(formData.get("factorId") ?? "");
  const code = String(formData.get("code") ?? "");

  if (!factorId) {
    return {
      error: "Your session expired. Please sign in again.",
      lockedUntil: null,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: "Your session expired. Please sign in again.",
      lockedUntil: null,
    };
  }

  const now = Date.now();
  const rateEntry = enrollRateLimit.get(user.id);

  if (rateEntry && rateEntry.lockedUntil > now) {
    const minutesLeft = Math.ceil((rateEntry.lockedUntil - now) / 60000);
    return {
      error: `Too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? "s" : ""}.`,
      lockedUntil: rateEntry.lockedUntil,
    };
  }

  const result = await challengeAndVerify(factorId, code);

  if (!result.ok) {
    const attempts = (rateEntry?.attempts ?? 0) + 1;
    const lockedUntil = attempts >= MAX_ATTEMPTS ? now + LOCKOUT_MS : 0;
    enrollRateLimit.set(user.id, { attempts, lockedUntil });

    if (lockedUntil > 0) {
      return {
        error: "Too many failed attempts. Try again in 10 minutes.",
        lockedUntil,
      };
    }

    const remaining = MAX_ATTEMPTS - attempts;
    return {
      error: `${result.error} ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`,
      lockedUntil: null,
    };
  }

  enrollRateLimit.delete(user.id);

  void logTimelineEvent({
    ownerId: user.id,
    eventType: "2fa_enrolled",
    category: "account",
    title: "Two-factor authentication enabled",
    visibility: "admin_only",
  });

  redirect("/enroll-2fa?step=backup");
}
