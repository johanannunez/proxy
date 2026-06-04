import "server-only";

import { createHash, randomBytes, randomInt, timingSafeEqual } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { untypedDatabase } from "@/lib/supabase/untyped";

/**
 * Account-level 2FA (TOTP) shared library.
 *
 * Supabase AAL is the single source of truth for whether a session is
 * elevated. This module wraps the Supabase MFA API (enroll, challenge,
 * verify, listFactors, getAuthenticatorAssuranceLevel) plus a backup-code
 * store kept in the `mfa_backup_codes` table (service-role access only).
 *
 * Backup codes are recovery actions, not a login shortcut: they prove
 * identity so a lost authenticator can be wiped and re-enrolled. They never
 * elevate a session to aal2 on their own.
 */

const BACKUP_CODE_COUNT = 8;
const BACKUP_CODE_GROUP_LENGTH = 4;
// Unambiguous lowercase alphabet: no 0/o, 1/l/i, to keep hand-typed codes clean.
const BACKUP_CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const BACKUP_CODES_TABLE = "mfa_backup_codes";

// Backup-code verification rate limiting, mirroring the Treasury pattern:
// 5 attempts then a 10-minute lockout, keyed by user id. Process-local Map.
const backupCodeRateLimit = new Map<
  string,
  { attempts: number; lockedUntil: number }
>();
const MAX_BACKUP_CODE_ATTEMPTS = 5;
const BACKUP_CODE_LOCKOUT_MS = 10 * 60 * 1000;

export type EnrollTotpResult = {
  factorId: string;
  qrCode: string;
  secret: string;
};

export type ChallengeVerifyResult = { ok: true } | { ok: false; error: string };

export type VerifiedTotpFactor = {
  id: string;
  friendlyName: string | null;
};

export type AssuranceLevel = "aal1" | "aal2" | null;

export type AssuranceResult = {
  current: AssuranceLevel;
  next: AssuranceLevel;
};

export type ConsumeBackupCodeResult = { ok: boolean; locked?: boolean };

export type ResetMfaResult = { ok: boolean; error?: string };

/** Shape of a single backup-code row we read back from the service client. */
type BackupCodeRow = {
  id: string;
  code_hash: string;
  salt: string;
};

/** sha-256 hex of (code + salt). Salt is per row. */
function hashBackupCode(code: string, salt: string): string {
  return createHash("sha256").update(`${code}${salt}`).digest("hex");
}

/** Normalize user input to the canonical stored form (lowercase, no spaces). */
function normalizeBackupCode(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "");
}

/** Constant-time hex string comparison. Returns false on any length mismatch. */
function hashesEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Start TOTP enrollment for the current user. Any stale UNVERIFIED totp
 * factors are unenrolled first so re-enrollment always starts clean.
 */
export async function enrollTotp(): Promise<EnrollTotpResult> {
  const supabase = await createClient();

  // Clean up stale unverified factors from abandoned enroll attempts.
  // `data.totp` is typed as verified-only, so read the full `all` list and
  // filter for unverified totp factors.
  const { data: factorList } = await supabase.auth.mfa.listFactors();
  const staleUnverified = (factorList?.all ?? []).filter(
    (factor) =>
      factor.factor_type === "totp" && factor.status === "unverified",
  );
  for (const factor of staleUnverified) {
    await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Proxy TOTP ${Date.now()}`,
  });

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to start two-factor enrollment.");
  }

  return {
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
  };
}

/**
 * Challenge a factor then verify a TOTP code against it. A successful verify
 * activates the factor and elevates the Supabase session to aal2.
 */
export async function challengeAndVerify(
  factorId: string,
  code: string,
): Promise<ChallengeVerifyResult> {
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, error: "Enter a 6-digit code." };
  }

  const supabase = await createClient();

  const { data: challenge, error: challengeError } =
    await supabase.auth.mfa.challenge({ factorId });

  if (challengeError || !challenge) {
    return {
      ok: false,
      error: challengeError?.message ?? "Failed to create a challenge.",
    };
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  });

  if (verifyError) {
    return { ok: false, error: verifyError.message };
  }

  return { ok: true };
}

/** Verified TOTP factors for the current user. */
export async function listVerifiedFactors(): Promise<VerifiedTotpFactor[]> {
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.listFactors();
  return (data?.totp ?? [])
    .filter((factor) => factor.status === "verified")
    .map((factor) => ({
      id: factor.id,
      friendlyName: factor.friendly_name ?? null,
    }));
}

/** True if the current user has at least one verified TOTP factor. */
export async function hasVerifiedTotp(): Promise<boolean> {
  const factors = await listVerifiedFactors();
  return factors.length > 0;
}

/** Current and next assurance levels for the session from Supabase. */
export async function getAssurance(): Promise<AssuranceResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return {
    current: data?.currentLevel ?? null,
    next: data?.nextLevel ?? null,
  };
}

/** Generate a single backup code formatted like `xxxx-xxxx`. */
function generateOneBackupCode(): string {
  const pick = () => BACKUP_CODE_ALPHABET[randomInt(BACKUP_CODE_ALPHABET.length)];
  const group = () =>
    Array.from({ length: BACKUP_CODE_GROUP_LENGTH }, pick).join("");
  return `${group()}-${group()}`;
}

/**
 * Generate 8 fresh backup codes for a user. Deletes any existing codes,
 * stores per-row salted sha-256 hashes via the service-role client, and
 * returns the plaintext codes to be shown exactly once. Plaintext is never
 * stored.
 */
export async function generateBackupCodes(userId: string): Promise<string[]> {
  const codes = Array.from({ length: BACKUP_CODE_COUNT }, generateOneBackupCode);
  const service = untypedDatabase(createServiceClient());

  // Wipe existing codes so a regenerate fully replaces the prior set.
  await service.from(BACKUP_CODES_TABLE).delete().eq("user_id", userId);

  const rows = codes.map((code) => {
    const salt = randomBytes(16).toString("hex");
    return {
      user_id: userId,
      code_hash: hashBackupCode(code, salt),
      salt,
    };
  });

  const { error } = await service.from(BACKUP_CODES_TABLE).insert(rows);
  if (error) {
    throw new Error(error.message);
  }

  return codes;
}

/**
 * Verify a backup code for a user and mark it used. Rate-limited (5 attempts,
 * 10-minute lockout). Returns { ok: false, locked: true } when locked out.
 */
export async function consumeBackupCode(
  userId: string,
  code: string,
): Promise<ConsumeBackupCodeResult> {
  const now = Date.now();
  const rateEntry = backupCodeRateLimit.get(userId);

  if (rateEntry && rateEntry.lockedUntil > now) {
    return { ok: false, locked: true };
  }

  const normalized = normalizeBackupCode(code);
  const service = untypedDatabase(createServiceClient());

  const { data } = await service
    .from<BackupCodeRow[]>(BACKUP_CODES_TABLE)
    .select("id, code_hash, salt")
    .eq("user_id", userId)
    .filter("used_at", "is", "null");

  const rows = data ?? [];
  const candidate = normalized.length > 0 ? normalized : null;

  let matched: BackupCodeRow | null = null;
  if (candidate) {
    for (const row of rows) {
      const computed = hashBackupCode(candidate, row.salt);
      if (hashesEqual(computed, row.code_hash)) {
        matched = row;
        break;
      }
    }
  }

  if (!matched) {
    const attempts = (rateEntry?.attempts ?? 0) + 1;
    const locked = attempts >= MAX_BACKUP_CODE_ATTEMPTS;
    backupCodeRateLimit.set(userId, {
      attempts,
      lockedUntil: locked ? now + BACKUP_CODE_LOCKOUT_MS : 0,
    });
    return { ok: false, locked };
  }

  const { error: stampError } = await service
    .from(BACKUP_CODES_TABLE)
    .update({ used_at: new Date().toISOString() })
    .eq("id", matched.id);

  if (stampError) {
    return { ok: false };
  }

  backupCodeRateLimit.delete(userId);
  return { ok: true };
}

/** Count of unused backup codes for a user (service-role read). */
export async function countRemainingBackupCodes(userId: string): Promise<number> {
  const service = untypedDatabase(createServiceClient());
  const { data } = await service
    .from<{ id: string }[]>(BACKUP_CODES_TABLE)
    .select("id")
    .eq("user_id", userId)
    .filter("used_at", "is", "null");
  return (data ?? []).length;
}

/**
 * Admin reset: unenroll ALL of a user's TOTP factors and delete all of their
 * backup codes. Uses the service-role admin MFA API
 * (supabase.auth.admin.mfa.listFactors / deleteFactor), available in
 * @supabase/supabase-js 2.102.1.
 */
export async function resetUserMfa(userId: string): Promise<ResetMfaResult> {
  try {
    const service = createServiceClient();

    const { data: factorData, error: listError } =
      await service.auth.admin.mfa.listFactors({ userId });

    if (listError) {
      return { ok: false, error: listError.message };
    }

    for (const factor of factorData?.factors ?? []) {
      const { error: deleteError } = await service.auth.admin.mfa.deleteFactor({
        id: factor.id,
        userId,
      });
      if (deleteError) {
        return { ok: false, error: deleteError.message };
      }
    }

    const { error: codesError } = await untypedDatabase(service)
      .from(BACKUP_CODES_TABLE)
      .delete()
      .eq("user_id", userId);

    if (codesError) {
      return { ok: false, error: codesError.message };
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reset 2FA.";
    return { ok: false, error: message };
  }
}
