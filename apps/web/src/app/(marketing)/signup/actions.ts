"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logTimelineEvent } from "@/lib/timeline";

export type SignupState = {
  error?: string;
  message?: string;
};

export async function signup(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();

  if (!email || !password) {
    return { error: "Please enter your email and password." };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const headerList = await headers();
  const origin = headerList.get("origin") ?? "https://www.myproxyhost.com";

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: {
        full_name: fullName || null,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  // If email confirmation is enabled on the project, the user needs
  // to click a link before they can log in. Surface a friendly message
  // instead of redirecting.
  if (data.user && !data.session) {
    void logTimelineEvent({
      ownerId: data.user.id,
      eventType: "welcome",
      category: "account",
      title: "Welcome to Proxy",
      body: "Your owner account has been created. Welcome aboard.",
      isPinned: true,
    });

    return {
      message:
        "Check your email to confirm your account. Once confirmed, sign in.",
    };
  }

  redirect("/workspace/home");
}
