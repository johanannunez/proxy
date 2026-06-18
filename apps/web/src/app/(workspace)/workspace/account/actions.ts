"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logTimelineEvent } from "@/lib/timeline";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/* -------------------------------------------------------------------------- */
/*  updateProfile                                                             */
/* -------------------------------------------------------------------------- */

export async function updateProfile(
  _prevState: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, message: "You must be signed in to update your profile." };
  }

  const firstName = formData.get("first_name")?.toString().trim();
  const middleInitial = formData.get("middle_initial")?.toString().trim().charAt(0).toUpperCase() || "";
  const lastName = formData.get("last_name")?.toString().trim();
  const preferredName = formData.get("preferred_name")?.toString().trim() || null;
  const phone = formData.get("phone")?.toString().trim() || null;
  const contactMethod = formData.get("contact_method")?.toString().trim() || null;

  if (!firstName || !lastName) {
    return { ok: false, message: "First name and last name are required." };
  }

  // Combine into "First M. Last" or "First Last"
  const fullName = middleInitial
    ? `${firstName} ${middleInitial}. ${lastName}`
    : `${firstName} ${lastName}`;

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      preferred_name: preferredName,
      phone,
      contact_method: contactMethod,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return { ok: false, message: error.message };
  }

  // Log activity (fire-and-forget)
  const svc = createServiceClient();
  svc.from("activity_log").insert({
    action: "profile_updated",
    entity_type: "profile",
    entity_id: user.id,
    actor_id: user.id,
    metadata: {
      field_name: "profile",
      description: "Profile information updated",
    },
  }).then(() => {}, () => {});

  void logTimelineEvent({
    ownerId: user.id,
    eventType: "profile_updated",
    category: "account",
    title: "Profile updated",
    visibility: "admin_only",
    metadata: { fields_changed: ["full_name", "preferred_name", "phone", "contact_method"] },
  });

  revalidatePath("/workspace/account");
  return { ok: true, message: "Profile updated." };
}

/* -------------------------------------------------------------------------- */
/*  updateEmail                                                               */
/* -------------------------------------------------------------------------- */

export async function updateEmail(
  _prevState: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, message: "You must be signed in to update your email." };
  }

  const newEmail = formData.get("new_email")?.toString().trim();

  if (!newEmail) {
    return { ok: false, message: "Email address is required." };
  }

  const { error } = await supabase.auth.updateUser({ email: newEmail });

  if (error) {
    return { ok: false, message: error.message };
  }

  return {
    ok: true,
    message: "A confirmation link has been sent to your new email address. Please check your inbox.",
  };
}

/* -------------------------------------------------------------------------- */
/*  updatePassword                                                            */
/* -------------------------------------------------------------------------- */

export async function updatePassword(
  _prevState: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, message: "You must be signed in to change your password." };
  }

  const currentPassword = formData.get("current_password")?.toString();
  const newPassword = formData.get("new_password")?.toString();
  const confirmPassword = formData.get("confirm_password")?.toString();

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { ok: false, message: "All password fields are required." };
  }

  if (newPassword.length < 8) {
    return { ok: false, message: "New password must be at least 8 characters." };
  }

  if (newPassword !== confirmPassword) {
    return { ok: false, message: "New password and confirmation do not match." };
  }

  // Verify the current password is correct
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: currentPassword,
  });

  if (signInError) {
    return { ok: false, message: "Current password is incorrect." };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    return { ok: false, message: error.message };
  }

  // Log activity (fire-and-forget)
  const svcPw = createServiceClient();
  svcPw.from("activity_log").insert({
    action: "password_changed",
    entity_type: "profile",
    entity_id: user.id,
    actor_id: user.id,
    metadata: {
      description: "Password changed",
    },
  }).then(() => {}, () => {});

  return { ok: true, message: "Password updated successfully." };
}

/* -------------------------------------------------------------------------- */
/*  signOutOtherSessions                                                      */
/* -------------------------------------------------------------------------- */

export async function signOutOtherSessions(): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, message: "You must be signed in." };
  }

  const { error } = await supabase.auth.signOut({ scope: "others" });

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true, message: "All other sessions have been signed out." };
}

/* -------------------------------------------------------------------------- */
/*  getSessionLog                                                             */
/* -------------------------------------------------------------------------- */

export async function getSessionLog(): Promise<{
  ok: boolean;
  sessions: Array<{
    id: string;
    ip_address: string | null;
    browser: string | null;
    os: string | null;
    device_type: string | null;
    country: string | null;
    city: string | null;
    logged_in_at: string;
  }>;
  message?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, sessions: [], message: "You must be signed in." };
  }

  const { data, error } = await supabase
    .from("session_log")
    .select("id, ip_address, browser, os, device_type, country, city, logged_in_at")
    .eq("user_id", user.id)
    .order("logged_in_at", { ascending: false })
    .limit(20);

  if (error) {
    return { ok: false, sessions: [], message: error.message };
  }

  return { ok: true, sessions: data ?? [] };
}

/* -------------------------------------------------------------------------- */
/*  exportUserData                                                            */
/* -------------------------------------------------------------------------- */

export type ExportDataset = "properties" | "blocks";

export type ExportOptions = {
  datasets: ExportDataset[];
  range: {
    // ISO date (YYYY-MM-DD). null = no bound on that side.
    start: string | null;
    end: string | null;
    // Human label for the SUMMARY header, e.g. "Last 12 months" or "All time".
    label: string;
  };
};

export async function exportUserData(options: ExportOptions): Promise<{
  ok: boolean;
  data?: string;
  message?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, message: "You must be signed in to export your data." };
  }

  const wantsProperties = options.datasets.includes("properties");
  const wantsBlocks = options.datasets.includes("blocks");

  if (!wantsProperties && !wantsBlocks) {
    return { ok: false, message: "Pick at least one dataset to export." };
  }

  // Always fetch both queries in parallel. Both are single-user scoped, small,
  // and RLS-filtered, so there's no meaningful cost to running them both and
  // dropping the unwanted result on the floor below. Keeps types clean.
  let blocksQuery = supabase
    .from("block_requests")
    .select("id, start_date, end_date, status, created_at")
    .eq("owner_id", user.id);
  if (wantsBlocks && options.range.start) {
    // Overlap-style date filter so blocks that straddle the window edge still
    // get included, which matches what owners actually expect.
    blocksQuery = blocksQuery.gte("end_date", options.range.start);
  }
  if (wantsBlocks && options.range.end) {
    blocksQuery = blocksQuery.lte("start_date", options.range.end);
  }

  const [profileResult, propertiesResult, blockRequestsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, email, phone, preferred_name, contact_method, created_at")
      .eq("id", user.id)
      .single(),
    supabase
      .from("properties")
      .select(
        "name, property_type, address_line1, address_line2, city, state, postal_code, bedrooms, bathrooms, guest_capacity, active, created_at",
      ),
    blocksQuery,
  ]);

  const blocks = blockRequestsResult.data ?? [];

  const exportData = {
    exported_at: new Date().toISOString(),
    range_label: options.range.label,
    range_start: options.range.start,
    range_end: options.range.end,
    datasets: options.datasets,
    profile: profileResult.data,
    properties: wantsProperties ? propertiesResult.data ?? [] : null,
    calendar_blocks: wantsBlocks
      ? {
          total_count: blocks.length,
          approved: blocks.filter((b) => b.status === "approved").length,
          pending: blocks.filter((b) => b.status === "pending").length,
          denied: blocks.filter((b) => b.status === "denied").length,
          entries: blocks.map((b) => ({
            start_date: b.start_date,
            end_date: b.end_date,
            status: b.status,
            created_at: b.created_at,
          })),
        }
      : null,
  };

  return { ok: true, data: JSON.stringify(exportData, null, 2) };
}

/* -------------------------------------------------------------------------- */
/*  requestAccountDeletion                                                    */
/* -------------------------------------------------------------------------- */

export async function requestAccountDeletion(
  _prevState: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, message: "You must be signed in to request account deletion." };
  }

  const confirmation = formData.get("confirmation")?.toString().trim();

  if (confirmation !== "DELETE") {
    return { ok: false, message: 'Please type "DELETE" to confirm.' };
  }

  // Soft delete: set deleted_at timestamp. Account enters 30-day grace period.
  // Data is preserved. If user logs back in within 30 days, deleted_at is cleared.
  const { error } = await supabase
    .from("profiles")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) {
    return { ok: false, message: error.message };
  }

  // Log activity (fire-and-forget)
  const svcDel = createServiceClient();
  svcDel.from("activity_log").insert({
    action: "account_deletion_requested",
    entity_type: "profile",
    entity_id: user.id,
    actor_id: user.id,
    metadata: {
      description: "Account deletion requested (30-day grace period)",
    },
  }).then(() => {}, () => {});

  await supabase.auth.signOut();
  redirect("/login");
}
