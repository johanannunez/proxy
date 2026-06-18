"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Upload both the original and cropped avatar images.
 * The original is preserved so the user can re-edit (re-crop, re-zoom) later.
 *
 * Storage layout:
 *   avatars/{userId}/original.{ext}  -- full-size original
 *   avatars/{userId}/cropped.{ext}   -- 256x256 cropped version (displayed everywhere)
 */
export async function uploadAvatar(args: {
  originalBase64: string;
  croppedBase64: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Parse the cropped image
  const croppedMatch = args.croppedBase64.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!croppedMatch) return { error: "Invalid cropped image data" };

  const croppedExt = croppedMatch[1] === "jpeg" ? "jpg" : croppedMatch[1];
  const croppedBytes = Buffer.from(croppedMatch[2], "base64");

  // Parse the original image
  const origMatch = args.originalBase64.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!origMatch) return { error: "Invalid original image data" };

  const origExt = origMatch[1] === "jpeg" ? "jpg" : origMatch[1];
  const origBytes = Buffer.from(origMatch[2], "base64");

  // Upload both in parallel
  const [croppedResult] = await Promise.all([
    supabase.storage
      .from("avatars")
      .upload(`${user.id}/cropped.${croppedExt}`, croppedBytes, {
        contentType: `image/${croppedMatch[1]}`,
        upsert: true,
      }),
    supabase.storage
      .from("avatars")
      .upload(`${user.id}/original.${origExt}`, origBytes, {
        contentType: `image/${origMatch[1]}`,
        upsert: true,
      }),
  ]);

  if (croppedResult.error) {
    if (croppedResult.error.message?.includes("not found") || croppedResult.error.message?.includes("Bucket")) {
      return { error: "Avatar storage bucket not configured. Create a bucket named 'avatars' in Supabase Storage." };
    }
    return { error: croppedResult.error.message };
  }

  // Get the public URL for the cropped version
  const { data: urlData } = supabase.storage
    .from("avatars")
    .getPublicUrl(`${user.id}/cropped.${croppedExt}`);

  const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

  // Update profile
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", user.id);

  if (profileError) return { error: profileError.message };

  revalidatePath("/workspace/account");
  revalidatePath("/portal");
  return { success: true, avatarUrl: publicUrl };
}

/**
 * Get the best available avatar image URL for re-editing.
 * Tries the full-res original first, then falls back to the current
 * cropped avatar so the crop modal always has something to show.
 */
export async function getOriginalAvatar(fallbackAvatarUrl?: string | null): Promise<{ url: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { url: fallbackAvatarUrl ?? null };

  // Try the new nested path first (full-res original)
  for (const ext of ["jpg", "png", "webp"]) {
    const path = `${user.id}/original.${ext}`;
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    if (data?.publicUrl) {
      // Verify the file actually exists with a HEAD request
      try {
        const res = await fetch(data.publicUrl, { method: "HEAD" });
        if (res.ok) return { url: data.publicUrl };
      } catch {
        // File doesn't exist at this path, try next
      }
    }
  }

  // Try the old flat path (avatars/{userId}.{ext})
  for (const ext of ["jpg", "png", "webp"]) {
    const path = `avatars/${user.id}.${ext}`;
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    if (data?.publicUrl) {
      try {
        const res = await fetch(data.publicUrl, { method: "HEAD" });
        if (res.ok) return { url: data.publicUrl };
      } catch {
        // File doesn't exist at this path, try next
      }
    }
  }

  // Fall back to the current avatar URL (may be a cropped version)
  if (fallbackAvatarUrl) return { url: fallbackAvatarUrl };

  return { url: null };
}

/**
 * Remove the user's avatar photo (both original and cropped).
 */
export async function removeAvatar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", user.id);

  if (error) return { error: error.message };

  // Delete all avatar files for this user
  const filesToDelete = ["jpg", "png", "webp"].flatMap((ext) => [
    `${user.id}/cropped.${ext}`,
    `${user.id}/original.${ext}`,
    // Clean up old flat path format too
    `avatars/${user.id}.${ext}`,
  ]);
  await supabase.storage.from("avatars").remove(filesToDelete);

  revalidatePath("/workspace/account");
  revalidatePath("/portal");
  return { success: true };
}
