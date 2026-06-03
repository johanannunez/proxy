"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logTimelineEvent } from "@/lib/timeline";
import { recordVersion } from "@/lib/wizard/version-history";

const schema = z.object({
  property_id: z.string().uuid("Property ID is required."),
  photos: z.string().optional().default("[]"),
});

export type SavePhotosState = {
  error?: string;
};

export async function savePhotos(
  _prev: SavePhotosState,
  formData: FormData,
): Promise<SavePhotosState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = schema.safeParse(raw);

  if (!parsed.success) {
    return { error: "Something went wrong. Please try again." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const v = parsed.data;

  let photosList: { url: string; isPrimary: boolean }[] = [];
  try {
    photosList = JSON.parse(v.photos);
  } catch {
    return { error: "Invalid photo data." };
  }

  const { error } = await supabase
    .from("properties")
    .update({ photos: photosList as unknown as import("@/types/supabase").Json })
    .eq("id", v.property_id)
    .eq("owner_id", user.id);

  if (error) return { error: error.message };

  // Log activity (fire-and-forget)
  const svc = createServiceClient();
  svc.from("activity_log").insert({
    action: "property_updated",
    entity_type: "property",
    entity_id: v.property_id,
    actor_id: user.id,
    metadata: {
      field_name: "photos",
      photo_count: photosList.length,
      description: `Photos updated (${photosList.length} photos)`,
    },
  }).then(() => {}, () => {});

  void logTimelineEvent({
    ownerId: user.id,
    eventType: "onboarding_step",
    category: "account",
    title: "Completed onboarding: Photos",
    propertyId: v.property_id,
    visibility: "admin_only",
    metadata: { step: "photos" },
  });

  await recordVersion(supabase, {
    userId: user.id,
    propertyId: v.property_id,
    stepKey: "photos",
    data: { photos: photosList },
  });

  revalidatePath("/workspace/setup");
  redirect(`/workspace/setup?just=photos&property=${v.property_id}`);
}
