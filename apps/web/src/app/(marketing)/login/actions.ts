"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { recordSessionLogin } from "@/lib/session-log";
import { logTimelineEvent } from "@/lib/timeline";
import { hasVerifiedTotp } from "@/lib/auth/mfa";

export type LoginState = {
  error?: string;
};

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirect") ?? "/workspace/home");

  if (!email || !password) {
    return { error: "Please enter your email and password." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  if (data.user) {
    // Fetch role + soft-delete status in one query
    const { data: profile } = await supabase
      .from("profiles")
      .select("deleted_at, role")
      .eq("id", data.user.id)
      .single();

    if (profile?.deleted_at) {
      const deletedAt = new Date(profile.deleted_at);
      const daysSinceDeleted = (Date.now() - deletedAt.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceDeleted <= 30) {
        // Restore the account: clear deleted_at
        await supabase
          .from("profiles")
          .update({ deleted_at: null })
          .eq("id", data.user.id);
      } else {
        // Past 30 days: account is permanently deleted, sign them out
        await supabase.auth.signOut();
        return { error: "This account has been permanently deleted. Please contact support if you believe this is an error." };
      }
    }

    // Record session login
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
    const ua = h.get("user-agent") ?? null;
    await recordSessionLogin({ userId: data.user.id, ipAddress: ip, userAgent: ua });

    void logTimelineEvent({
      ownerId: data.user.id,
      eventType: "login",
      category: "account",
      title: "Logged in",
      visibility: "admin_only",
      metadata: { ip: ip ?? undefined, device: ua?.slice(0, 100) ?? undefined },
    });

    // Validate redirect is internal to prevent open-redirect attacks.
    // A valid redirect starts with "/" but not "//" (which browsers treat as protocol-relative).
    const isInternalRedirect = redirectTo.startsWith("/") && !redirectTo.startsWith("//");
    const safeRedirect = isInternalRedirect ? redirectTo : "/workspace/home";

    // Admin access guard: if the user explicitly selected Admin but their profile is not admin,
    // deny immediately rather than silently bouncing them via middleware.
    if (safeRedirect === "/admin" && profile?.role !== "admin") {
      await supabase.auth.signOut();
      return { error: "This account doesn't have admin access." };
    }

    // If no specific destination was requested (still on the default), route by role.
    // If the user was sent here from a specific page (e.g., /workspace/settings), honor that.
    const destination =
      safeRedirect === "/workspace/home" && profile?.role === "admin"
        ? "/admin"
        : safeRedirect;

    // Second factor gate: a password sign-in always leaves the session at aal1,
    // so if the user has a verified authenticator factor they must clear the
    // login-time verify screen before we honor their destination. We check
    // factors authoritatively via listFactors (a /user fetch) rather than the
    // assurance level's nextLevel, which is not reliably populated in the
    // freshly stored session right after sign-in.
    if (await hasVerifiedTotp()) {
      const verifyUrl = `/verify-2fa?redirect=${encodeURIComponent(destination)}`;
      redirect(verifyUrl);
    }

    redirect(destination);
  }

  redirect(redirectTo);
}
