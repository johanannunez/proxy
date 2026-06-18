"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type ForgotPasswordState = {
  error?: string;
  success?: boolean;
};

export async function requestPasswordReset(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "Please enter your email address." };
  }

  const supabase = await createClient();

  // Build an absolute redirect URL from the current request so this
  // works in local dev, preview, and production without per-env config.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${proto}://${host}` : "https://www.myproxyhost.com";
  const redirectTo = `${origin}/auth/callback?next=/reset-password`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  // Intentionally return success even on error so we do not leak
  // which emails are registered. Log server-side if real.
  if (error) {
    console.error("[forgot-password] reset email failed:", error.message);
  }

  return { success: true };
}
