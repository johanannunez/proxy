"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { challengeAndVerify } from "@/lib/auth/mfa";
import { getRoleHome, safeInternalPath } from "@/lib/auth/role-home";
import type { TotpVerifyState } from "@/components/auth/TotpEnrollment";

// Process-local rate limiting, mirroring the Treasury verify pattern:
// 5 failed attempts then a 10-minute lockout, keyed by user id.
const verifyRateLimit = new Map<
  string,
  { attempts: number; lockedUntil: number }
>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 10 * 60 * 1000;

/**
 * Login-time second factor verification. Reads hidden `factorId`, `code`, and
 * `redirect` from the form. On a successful TOTP verify the Supabase session
 * elevates to aal2 and we redirect to the requested destination (or role home).
 */
export async function verifyLoginTotp(
  _prev: TotpVerifyState,
  formData: FormData,
): Promise<TotpVerifyState> {
  const factorId = String(formData.get("factorId") ?? "");
  const code = String(formData.get("code") ?? "");
  const rawRedirect = formData.get("redirect");
  const requested = safeInternalPath(
    typeof rawRedirect === "string" ? rawRedirect : null,
    "",
  );

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

  const destination = requested || (await getRoleHome()) || "/workspace/home";
  redirect(destination);
}
