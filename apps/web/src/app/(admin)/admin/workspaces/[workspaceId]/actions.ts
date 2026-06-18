"use server";

import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logTimelineEvent } from "@/lib/timeline";

export async function inviteOwner(
  ownerId: string,
  realEmail: string,
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "You must be signed in." };
  }

  // Verify caller is admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { ok: false, message: "Admin access required." };
  }

  // Verify the owner exists and has a pending email
  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", ownerId)
    .single();

  if (!ownerProfile) {
    return { ok: false, message: "Owner not found." };
  }

  if (!ownerProfile.email.endsWith("@pending.myproxyhost.com")) {
    return { ok: false, message: "This owner has already been invited." };
  }

  // Use service client to update the auth user's email
  const serviceClient = createServiceClient();

  const { error: updateError } = await serviceClient.auth.admin.updateUserById(
    ownerId,
    { email: realEmail, email_confirm: true },
  );

  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  // Update the profile email
  await serviceClient
    .from("profiles")
    .update({ email: realEmail, updated_at: new Date().toISOString() })
    .eq("id", ownerId);

  // Generate a magic link the owner can use to set their password
  const { data: linkData, error: linkError } =
    await serviceClient.auth.admin.generateLink({
      type: "invite",
      email: realEmail,
    });

  if (linkError) {
    return {
      ok: true,
      message: `Email updated to ${realEmail}. Could not generate invite link: ${linkError.message}. The owner can use "Forgot password" to get in.`,
    };
  }

  const inviteLink = linkData?.properties?.action_link ?? null;

  // Log activity (fire-and-forget)
  serviceClient.from("activity_log").insert({
    action: "owner_invited",
    entity_type: "profile",
    entity_id: ownerId,
    actor_id: user.id,
    metadata: {
      invited_email: realEmail,
      description: `Owner invited with email ${realEmail}`,
    },
  }).then(() => {}, () => {});

  void logTimelineEvent({
    ownerId,
    eventType: "welcome",
    category: "account",
    title: "Welcome to Proxy",
    body: `Invited as ${realEmail}`,
    visibility: "owner",
    isPinned: true,
    createdBy: user.id,
  });

  revalidatePath("/admin/workspaces");

  return {
    ok: true,
    message: inviteLink
      ? `Invite ready. Share this link with the owner:\n${inviteLink}`
      : `Email updated to ${realEmail}. The owner can use "Forgot password" to sign in.`,
  };
}
