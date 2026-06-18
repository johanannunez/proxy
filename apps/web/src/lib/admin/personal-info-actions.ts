"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { untypedDatabase } from "@/lib/supabase/untyped";

/**
 * Update a profile's personal info from the admin Settings tab.
 *
 * Only admins can call this. Field semantics:
 *   - firstName + lastName compose back into profiles.full_name (space-joined)
 *   - preferredName writes to profiles.preferred_name
 *   - phone writes to profiles.phone (stored with whatever formatting is passed;
 *     the Personal info component already formats as "(123) 456-7890")
 *   - contactMethod writes to profiles.contact_method (enum-checked by DB)
 *
 * We deliberately do NOT change the auth email from this action, because that
 * requires the Supabase auth verification flow. Email stays read-only in the UI.
 */

const PersonalInfoSchema = z.object({
  profileId: z.string().uuid(),
  firstName: z.string().trim().min(1, "First name is required").max(60),
  lastName: z.string().trim().max(60).optional().default(""),
  preferredName: z
    .string()
    .trim()
    .max(60)
    .optional()
    .default("")
    .transform((v) => (v === "" ? null : v)),
  phone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .default("")
    .transform((v) => (v === "" ? null : v)),
  contactMethod: z
    .enum(["email", "sms", "phone", "whatsapp"])
    .nullable()
    .optional(),
});

export type PersonalInfoInput = z.input<typeof PersonalInfoSchema>;
export type PersonalInfoResult = { ok: true } | { ok: false; error: string };

export async function updatePersonalInfo(
  input: PersonalInfoInput,
): Promise<PersonalInfoResult> {
  const parsed = PersonalInfoSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ??
        "Please check the fields and try again.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const { data: actingProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (actingProfile?.role !== "admin") {
    return { ok: false, error: "Admin access required." };
  }

  const {
    profileId,
    firstName,
    lastName,
    preferredName,
    phone,
    contactMethod,
  } = parsed.data;

  // Compose full_name. Skip extra whitespace if last name is empty.
  const fullName = [firstName, lastName].filter((s) => s.trim() !== "").join(" ");

  const { data: targetProfile, error: fetchError } = await supabase
    .from("profiles")
    .select("id, workspace_id")
    .eq("id", profileId)
    .maybeSingle();

  if (fetchError || !targetProfile) {
    return { ok: false, error: "Owner profile not found." };
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      preferred_name: preferredName,
      phone,
      contact_method: contactMethod ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profileId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  // Fire-and-forget activity log entry so the owner's timeline shows the change.
  supabase
    .from("activity_log")
    .insert({
      action: "owner_profile_updated",
      entity_type: "profile",
      entity_id: profileId,
      actor_id: user.id,
      metadata: {
        description: "Personal info updated from admin settings",
        fields: ["full_name", "preferred_name", "phone", "contact_method"],
      },
    })
    .then(
      () => {},
      () => {},
    );

  if (targetProfile.workspace_id) {
    revalidatePath(`/admin/workspaces/${targetProfile.workspace_id}`);
  }

  // Sync name and phone back to the linked contact so the sidebar stays in sync.
  const db = untypedDatabase(supabase);
  const { data: contactRow } = await db
    .from<{ id: string }>("contacts")
    .select("id")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (contactRow?.id) {
    const contactUpdate: Record<string, unknown> = {
      full_name: fullName,
      first_name: firstName || null,
      last_name: lastName || null,
    };
    if (phone !== null) contactUpdate.phone = phone;

    await db
      .from("contacts")
      .update(contactUpdate)
      .eq("id", contactRow.id);

    revalidatePath(`/admin/workspaces/${contactRow.id}`);
    revalidatePath("/admin/workspaces");
  }

  return { ok: true };
}
