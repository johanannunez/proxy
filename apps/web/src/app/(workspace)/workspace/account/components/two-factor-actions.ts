"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  enrollTotp,
  challengeAndVerify,
  listVerifiedFactors,
  resetUserMfa,
} from "@/lib/auth/mfa";
import { logTimelineEvent } from "@/lib/timeline";
import type { TotpVerifyState } from "@/components/auth/TotpEnrollment";

/**
 * Server actions for owner self-service two-factor (TOTP).
 *
 * Status is read live from Supabase MFA (never a parallel flag). Backup-code
 * plaintext is always produced on a server render and shown exactly once, so it
 * is never carried through client state or a redirect URL. This mirrors the
 * forced enroll-2fa flow.
 *
 * Enrollment:
 *   1. startTwoFactorEnrollment() -> { factorId, qrCode, secret } for the modal
 *   2. verifyTwoFactorEnrollment() (useActionState) -> verify, then redirect to
 *      ?twofa=backup where the account page generates and shows backup codes.
 *
 * Regenerate routes to ?twofa=regen (page generates codes server-side).
 * Disable is blocked for admins, both here and in the UI.
 *
 * Process-local rate limiting on verify: 5 failed attempts, 10-minute lockout.
 */

const ACCOUNT_PATH = "/workspace/account";

const verifyRateLimit = new Map<
  string,
  { attempts: number; lockedUntil: number }
>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 10 * 60 * 1000;

type StartEnrollmentResult =
  | { ok: true; factorId: string; qrCode: string; secret: string }
  | { ok: false; error: string };

type SimpleResult = { ok: boolean; error?: string };

/** Resolve the signed-in user, or null when unauthenticated. */
async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** True if the given user is an admin. Admins may not disable 2FA. */
async function isAdmin(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return data?.role === "admin";
}

/**
 * Begin enrollment. Cleans up stale unverified factors, then returns the QR
 * code and manual secret for the client to render in TotpEnrollment.
 */
export async function startTwoFactorEnrollment(): Promise<StartEnrollmentResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "You must be signed in to enable two-factor." };
  }

  try {
    const { factorId, qrCode, secret } = await enrollTotp();
    return { ok: true, factorId, qrCode, secret };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Could not start two-factor enrollment.";
    return { ok: false, error: message };
  }
}

/**
 * Verify the 6-digit code entered during enrollment. On success the Supabase
 * session elevates to aal2 and the factor becomes verified, then we redirect to
 * the backup-codes step. Wired with useActionState, so the shape is
 * TotpVerifyState.
 */
export async function verifyTwoFactorEnrollment(
  _prevState: TotpVerifyState,
  formData: FormData,
): Promise<TotpVerifyState> {
  const factorId = formData.get("factorId")?.toString() ?? "";
  const code = formData.get("code")?.toString() ?? "";

  if (!factorId) {
    return {
      error: "Enrollment expired. Please start again.",
      lockedUntil: null,
    };
  }

  const user = await getCurrentUser();
  if (!user) {
    return {
      error: "You must be signed in to enable two-factor.",
      lockedUntil: null,
    };
  }

  const now = Date.now();
  const rateEntry = verifyRateLimit.get(user.id);

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
    verifyRateLimit.set(user.id, { attempts, lockedUntil });

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

  verifyRateLimit.delete(user.id);

  void logTimelineEvent({
    ownerId: user.id,
    eventType: "2fa_enrolled",
    category: "account",
    title: "Two-factor authentication enabled",
    visibility: "admin_only",
  });

  redirect(`${ACCOUNT_PATH}?twofa=backup`);
}

/**
 * Turn off two-factor for the signed-in user: unenroll every verified factor
 * and clear backup codes. Blocked for admins, where 2FA is required.
 */
export async function disableTwoFactor(): Promise<SimpleResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "You must be signed in." };
  }

  if (await isAdmin(user.id)) {
    return {
      ok: false,
      error: "Two-factor authentication is required for admin accounts.",
    };
  }

  const supabase = await createClient();
  const factors = await listVerifiedFactors();
  for (const factor of factors) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    if (error) {
      return { ok: false, error: error.message };
    }
  }

  // Clears any remaining factors plus all backup codes via service role.
  const reset = await resetUserMfa(user.id);
  if (!reset.ok) {
    return { ok: false, error: reset.error ?? "Could not turn off two-factor." };
  }

  void logTimelineEvent({
    ownerId: user.id,
    eventType: "2fa_disabled",
    category: "account",
    title: "Two-factor authentication turned off",
    visibility: "admin_only",
  });

  revalidatePath(ACCOUNT_PATH);
  return { ok: true };
}
