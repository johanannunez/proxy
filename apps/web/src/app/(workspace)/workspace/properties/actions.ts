"use server";

import { getWorkspaceContext } from "@/lib/workspace-context";
import { createServiceClient } from "@/lib/supabase/service";
import { revalidatePath } from "next/cache";

export type ImageSource = "aerial" | "street" | "photo";

/**
 * Updates the image_source field on a property.
 * Uses getWorkspaceContext() so it works correctly both when an owner
 * is viewing their own portal and when an admin is impersonating an owner.
 */
export async function updatePropertyImageSource(
  propertyId: string,
  source: ImageSource,
): Promise<{ ok: boolean; error?: string }> {
  const { userId, client } = await getWorkspaceContext();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client as any)
    .from("properties")
    .update({ image_source: source })
    .eq("id", propertyId)
    .eq("owner_id", userId);

  if (error) return { ok: false, error: error.message };

  // Log activity (fire-and-forget)
  const svc = createServiceClient();
  svc.from("activity_log").insert({
    action: "property_updated",
    entity_type: "property",
    entity_id: propertyId,
    actor_id: userId,
    metadata: {
      field_name: "image_source",
      new_value: source,
      description: `Property image source changed to ${source}`,
    },
  }).then(() => {}, () => {});

  revalidatePath("/workspace/properties");
  return { ok: true };
}

/**
 * Saves an uploaded cover photo URL and sets image_source to "photo".
 */
export async function updatePropertyCoverPhoto(
  propertyId: string,
  coverPhotoUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  const { userId, client } = await getWorkspaceContext();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client as any)
    .from("properties")
    .update({ cover_photo_url: coverPhotoUrl, image_source: "photo" })
    .eq("id", propertyId)
    .eq("owner_id", userId);

  if (error) return { ok: false, error: error.message };

  // Log activity (fire-and-forget)
  const svcPhoto = createServiceClient();
  svcPhoto.from("activity_log").insert({
    action: "property_updated",
    entity_type: "property",
    entity_id: propertyId,
    actor_id: userId,
    metadata: {
      field_name: "cover_photo",
      description: "Cover photo uploaded",
    },
  }).then(() => {}, () => {});

  revalidatePath("/workspace/properties");
  return { ok: true };
}
