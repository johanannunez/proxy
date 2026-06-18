"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { setTreasuryVerified } from "@/lib/treasury/auth";

// In-memory rate limiting: maps user ID to { attempts, lockedUntil }
// Single-admin system so a process-local Map is sufficient.
const rateLimitMap = new Map<string, { attempts: number; lockedUntil: number }>();
const mfaRateLimitMap = new Map<string, { attempts: number; lockedUntil: number }>();

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 10 * 60 * 1000; // 10 minutes

export type VerifyState = {
  error: string | null;
  lockedUntil: number | null;
  needsMfa?: boolean;
  factorId?: string;
};

/**
 * Server action for the treasury re-authentication gate.
 *
 * - Reads "password" and "redirectTo" from formData
 * - Rate-limits: 5 failed attempts triggers a 10-minute lockout
 * - Verifies via Supabase signInWithPassword (uses the user's own email)
 * - After password success, checks MFA enrollment:
 *   - No TOTP factors: redirects to /admin/treasury/mfa-setup
 *   - TOTP enrolled but not yet verified: returns { needsMfa: true, factorId }
 * - On failure: audit-logs the attempt and returns an error state
 */
export async function verifyTreasuryAccess(
  prevState: VerifyState,
  formData: FormData,
): Promise<VerifyState> {
  const password = formData.get("password");
  if (typeof password !== "string" || !password) {
    return { error: "Password is required.", lockedUntil: null };
  }

  // Get current user
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { error: "Session expired. Please sign in again.", lockedUntil: null };
  }

  // Check rate limit
  const now = Date.now();
  const rateEntry = rateLimitMap.get(user.id);

  if (rateEntry && rateEntry.lockedUntil > now) {
    const minutesLeft = Math.ceil((rateEntry.lockedUntil - now) / 60000);
    return {
      error: `Too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? "s" : ""}.`,
      lockedUntil: rateEntry.lockedUntil,
    };
  }

  // Verify password via Supabase Auth
  const svc = createServiceClient();
  const { error: authError } = await svc.auth.signInWithPassword({
    email: user.email,
    password,
  });

  if (authError) {
    // Increment attempt counter
    const attempts = (rateEntry?.attempts ?? 0) + 1;
    const lockedUntil = attempts >= MAX_ATTEMPTS ? now + LOCKOUT_MS : 0;
    rateLimitMap.set(user.id, { attempts, lockedUntil });

    // Audit log the failure (fire-and-forget)
    svc
      .from("treasury_audit_log")
      .insert({
        action: "reauth_failure",
        resource_type: "treasury",
        resource_id: null,
        user_id: user.id,
        metadata: {
          description: "Treasury re-authentication failed",
          attempts,
          locked: lockedUntil > 0,
        },
      })
      .then(() => {}, () => {});

    if (lockedUntil > 0) {
      return {
        error: `Too many failed attempts. Try again in 10 minutes.`,
        lockedUntil,
      };
    }

    const remaining = MAX_ATTEMPTS - attempts;
    return {
      error: `Incorrect password. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`,
      lockedUntil: null,
    };
  }

  // Password verified. Now check MFA enrollment.
  rateLimitMap.delete(user.id);

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verifiedTotpFactors = (factors?.totp ?? []).filter(
    (f) => f.status === "verified",
  );

  // No TOTP factors enrolled: redirect to MFA setup
  if (verifiedTotpFactors.length === 0) {
    redirect("/admin/treasury/mfa-setup");
  }

  // TOTP is enrolled: require MFA verification before setting cookie
  const factor = verifiedTotpFactors[0];
  return {
    error: null,
    lockedUntil: null,
    needsMfa: true,
    factorId: factor.id,
  };
}

/**
 * Server action to verify a TOTP code during the treasury re-auth flow.
 * Called after password has been verified and state has needsMfa: true.
 * On success: sets the treasury cookie and redirects.
 */
export async function verifyMfaCode(
  prevState: VerifyState,
  formData: FormData,
): Promise<VerifyState> {
  const code = formData.get("code") as string | null;
  const factorId = formData.get("factorId") as string | null;
  const rawRedirect = (formData.get("redirectTo") as string | null) ?? "/admin/treasury";
  const redirectTo = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
    ? rawRedirect
    : "/admin/treasury";

  if (!factorId) {
    // Missing factorId means state was lost (e.g. page refresh). Drop back to password step.
    return { error: "Session interrupted. Please enter your password again.", lockedUntil: null };
  }

  if (!code) {
    return {
      error: "Verification code is required.",
      lockedUntil: null,
      needsMfa: true,
      factorId,
    };
  }

  if (!/^\d{6}$/.test(code)) {
    return {
      error: "Enter a 6-digit code.",
      lockedUntil: null,
      needsMfa: true,
      factorId,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Session expired. Please sign in again.", lockedUntil: null };
  }

  // Check MFA rate limit
  const now = Date.now();
  const rateEntry = mfaRateLimitMap.get(user.id);

  if (rateEntry && rateEntry.lockedUntil > now) {
    const minutesLeft = Math.ceil((rateEntry.lockedUntil - now) / 60000);
    return {
      error: `Too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? "s" : ""}.`,
      lockedUntil: rateEntry.lockedUntil,
      needsMfa: true,
      factorId,
    };
  }

  // Challenge then verify
  const { data: challengeData, error: challengeError } =
    await supabase.auth.mfa.challenge({ factorId });

  if (challengeError || !challengeData) {
    return {
      error: challengeError?.message ?? "Failed to create MFA challenge.",
      lockedUntil: null,
      needsMfa: true,
      factorId,
    };
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challengeData.id,
    code,
  });

  const svc = createServiceClient();

  if (verifyError) {
    const attempts = (rateEntry?.attempts ?? 0) + 1;
    const lockedUntil = attempts >= MAX_ATTEMPTS ? now + LOCKOUT_MS : 0;
    mfaRateLimitMap.set(user.id, { attempts, lockedUntil });

    // Audit log MFA failure
    svc
      .from("treasury_audit_log")
      .insert({
        action: "mfa_verify",
        resource_type: "treasury",
        resource_id: null,
        user_id: user.id,
        metadata: {
          description: "Treasury MFA verification failed during re-auth",
          factor_id: factorId,
          attempts,
          locked: lockedUntil > 0,
          context: "reauth",
        },
      })
      .then(() => {}, () => {});

    if (lockedUntil > 0) {
      return {
        error: "Too many failed attempts. Try again in 10 minutes.",
        lockedUntil,
        needsMfa: true,
        factorId,
      };
    }

    const remaining = MAX_ATTEMPTS - attempts;
    return {
      error: `Invalid code. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`,
      lockedUntil: null,
      needsMfa: true,
      factorId,
    };
  }

  // MFA verified. Set cookie, audit log, redirect.
  mfaRateLimitMap.delete(user.id);

  await setTreasuryVerified();

  svc
    .from("treasury_audit_log")
    .insert({
      action: "reauth_success",
      resource_type: "treasury",
      resource_id: null,
      user_id: user.id,
      metadata: {
        description: "Treasury re-authentication succeeded (password + MFA)",
      },
    })
    .then(() => {}, () => {});

  // Also log the MFA verify success separately
  svc
    .from("treasury_audit_log")
    .insert({
      action: "mfa_verify",
      resource_type: "treasury",
      resource_id: null,
      user_id: user.id,
      metadata: {
        description: "Treasury MFA verification succeeded during re-auth",
        factor_id: factorId,
        context: "reauth",
      },
    })
    .then(() => {}, () => {});

  redirect(redirectTo);
}
