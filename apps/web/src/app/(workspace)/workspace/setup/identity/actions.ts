"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logTimelineEvent } from "@/lib/timeline";
import { recordVersion } from "@/lib/wizard/version-history";
import { syncSpineForOwner } from "@/lib/documents/spine";

const schema = z.object({
  legal_name: z.string().trim().min(1, "Full legal name is required."),
  license_number: z.string().trim().min(1, "License number is required."),
  issuing_state: z.string().trim().min(2, "Issuing state is required."),
  expiration_date: z.string().min(1, "Expiration date is required."),
  consent: z.literal("true", {
    message: "You must consent to identity verification.",
  }),
});

export type SaveIdentityState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function saveIdentity(
  _prev: SaveIdentityState,
  formData: FormData,
): Promise<SaveIdentityState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = schema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]?.toString();
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: "A few fields need your attention.", fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const v = parsed.data;
  const now = new Date().toISOString();

  // Upload front and back photos if provided
  let frontPhotoUrl: string | null = null;
  let backPhotoUrl: string | null = null;

  const frontPhoto = formData.get("front_photo") as File | null;
  const backPhoto = formData.get("back_photo") as File | null;

  if (frontPhoto && frontPhoto.size > 0) {
    const ext = frontPhoto.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/kyc/front.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("property-photos")
      .upload(path, frontPhoto, { upsert: true, contentType: frontPhoto.type });
    if (!uploadErr) {
      const { data: urlData } = supabase.storage
        .from("property-photos")
        .getPublicUrl(path);
      frontPhotoUrl = urlData.publicUrl;
    }
  }

  if (backPhoto && backPhoto.size > 0) {
    const ext = backPhoto.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/kyc/back.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("property-photos")
      .upload(path, backPhoto, { upsert: true, contentType: backPhoto.type });
    if (!uploadErr) {
      const { data: urlData } = supabase.storage
        .from("property-photos")
        .getPublicUrl(path);
      backPhotoUrl = urlData.publicUrl;
    }
  }

  // Upsert into owner_kyc table
  const kycPayload = {
    user_id: user.id,
    legal_name: v.legal_name,
    license_number: v.license_number,
    issuing_state: v.issuing_state.toUpperCase(),
    expiration_date: v.expiration_date,
    consent_given: true,
    consent_at: now,
    ...(frontPhotoUrl ? { front_photo_url: frontPhotoUrl } : {}),
    ...(backPhotoUrl ? { back_photo_url: backPhotoUrl } : {}),
  };

  // Try upsert (insert or update on conflict)
  const { data: existing } = await supabase
    .from("owner_kyc")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("owner_kyc")
      .update(kycPayload)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("owner_kyc")
      .insert(kycPayload);
    if (error) return { error: error.message };
  }

  // Log activity (fire-and-forget)
  const svc = createServiceClient();
  svc.from("activity_log").insert({
    action: "identity_verified",
    entity_type: "profile",
    entity_id: user.id,
    actor_id: user.id,
    metadata: {
      issuing_state: v.issuing_state,
      description: "Identity verification submitted",
    },
  }).then(() => {}, () => {});

  void logTimelineEvent({
    ownerId: user.id,
    eventType: "onboarding_step",
    category: "account",
    title: "Completed onboarding: Identity verification",
    visibility: "admin_only",
    metadata: { step: "identity" },
  });

  await recordVersion(supabase, {
    userId: user.id,
    stepKey: "identity",
    data: {
      legal_name: v.legal_name,
      license_number: v.license_number,
      issuing_state: v.issuing_state,
      expiration_date: v.expiration_date,
      consent_given: true,
    },
  });

  // Keep the documents spine in sync with the new identity record.
  await syncSpineForOwner(user.id);

  revalidatePath("/workspace/setup");
  redirect("/workspace/setup?just=identity");
}
