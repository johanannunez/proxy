"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdminUser } from "@/lib/admin/auth";
import { resetUserMfa } from "@/lib/auth/mfa";
import { logTimelineEvent } from "@/lib/timeline";

/**
 * Admin-side two-factor helpers for the workspace settings surface.
 *
 * An admin views another user's account here, so factor status is read through
 * the service-role admin MFA API (not the per-session client). Reset clears the
 * target user's factors and backup codes via resetUserMfa.
 */

type ResetResult = { ok: boolean; error?: string };

/**
 * Whether the target user has a verified TOTP factor. Service-role read, so it
 * works for any user the admin is inspecting. Returns false on any error rather
 * than throwing, so the settings page always renders.
 */
export async function getMemberTwoFactorEnabled(
  userId: string,
): Promise<boolean> {
  if (!userId) return false;
  try {
    const service = createServiceClient();
    const { data, error } = await service.auth.admin.mfa.listFactors({ userId });
    if (error || !data) return false;
    return data.factors.some(
      (factor) => factor.factor_type === "totp" && factor.status === "verified",
    );
  } catch {
    return false;
  }
}

/**
 * Admin reset of a member's two-factor: deletes their factors and backup codes.
 * Guarded so only an authenticated admin can run it.
 */
export async function resetMemberTwoFactor(
  targetUserId: string,
  workspaceId: string,
): Promise<ResetResult> {
  try {
    const { user: adminUser } = await requireAdminUser();

    if (!targetUserId) {
      return { ok: false, error: "Missing the member to reset." };
    }

    const result = await resetUserMfa(targetUserId);
    if (!result.ok) {
      return { ok: false, error: result.error ?? "Could not reset two-factor." };
    }

    void logTimelineEvent({
      ownerId: targetUserId,
      eventType: "2fa_admin_reset",
      category: "account",
      title: "Two-factor authentication reset by admin",
      visibility: "admin_only",
      createdBy: adminUser.id,
    });

    if (workspaceId) {
      revalidatePath(`/admin/workspaces/${workspaceId}`);
    }

    return { ok: true };
  } catch (err) {
    // requireAdminUser throws on a non-admin or unauthenticated caller.
    const message =
      err instanceof Error && err.message.startsWith("forbidden")
        ? "You do not have permission to do that."
        : "Could not reset two-factor.";
    return { ok: false, error: message };
  }
}
