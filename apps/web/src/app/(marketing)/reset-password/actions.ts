"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logTimelineEvent } from "@/lib/timeline";

export type ResetPasswordState = {
  error?: string;
};

export async function updatePassword(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { error: "Passwords do not match." };
  }

  const supabase = await createClient();

  // The user must already have an active session, established by the
  // /auth/callback handler after they clicked the reset link.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error:
        "This reset link is no longer valid. Please request a new one.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: error.message };
  }

  void logTimelineEvent({
    ownerId: user.id,
    eventType: "password_reset",
    category: "account",
    title: "Password was reset",
    visibility: "admin_only",
  });

  redirect("/workspace/home");
}
