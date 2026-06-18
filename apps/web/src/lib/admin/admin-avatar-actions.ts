"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { untypedDatabase } from "@/lib/supabase/untyped";

// Verify the caller is an admin. Returns an error string or null.
async function checkAdmin(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "Not authenticated";

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return profile?.role === "admin" ? null : "Admin access required.";
}

/**
 * Upload and crop an avatar for any owner profile.
 * Storage layout mirrors the portal pattern:
 *   avatars/{targetProfileId}/original.{ext}
 *   avatars/{targetProfileId}/cropped.{ext}
 *
 * Uses the service client for all storage and DB writes so the admin
 * can write to any user's storage path (the user-facing RLS policy
 * restricts writes to auth.uid() == folder prefix, which would block
 * admins writing to someone else's folder).
 *
 * Also syncs to contacts.avatar_url for the linked contact.
 */
export async function uploadAdminAvatar(args: {
  targetProfileId: string;
  originalBase64: string;
  croppedBase64: string;
}): Promise<{ success?: boolean; avatarUrl?: string; error?: string }> {
  const authError = await checkAdmin();
  if (authError) return { error: authError };

  const croppedMatch = args.croppedBase64.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!croppedMatch) return { error: "Invalid cropped image data" };

  const origMatch = args.originalBase64.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!origMatch) return { error: "Invalid original image data" };

  const croppedExt = croppedMatch[1] === "jpeg" ? "jpg" : croppedMatch[1];
  const origExt = origMatch[1] === "jpeg" ? "jpg" : origMatch[1];
  const pid = args.targetProfileId;

  // Service client bypasses storage RLS so the admin can write to any user's folder.
  const svc = createServiceClient();

  const [croppedResult] = await Promise.all([
    svc.storage
      .from("avatars")
      .upload(`${pid}/cropped.${croppedExt}`, Buffer.from(croppedMatch[2], "base64"), {
        contentType: `image/${croppedMatch[1]}`,
        upsert: true,
      }),
    svc.storage
      .from("avatars")
      .upload(`${pid}/original.${origExt}`, Buffer.from(origMatch[2], "base64"), {
        contentType: `image/${origMatch[1]}`,
        upsert: true,
      }),
  ]);

  if (croppedResult.error) {
    if (croppedResult.error.message?.includes("Bucket") || croppedResult.error.message?.includes("not found")) {
      return { error: "Avatar storage bucket not configured. Create a bucket named 'avatars' in Supabase Storage." };
    }
    return { error: croppedResult.error.message };
  }

  const { data: urlData } = svc.storage
    .from("avatars")
    .getPublicUrl(`${pid}/cropped.${croppedExt}`);

  const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

  await svc.from("profiles").update({ avatar_url: publicUrl }).eq("id", pid);

  // Sync to the linked contact row so the header/sidebar also reflect the new photo.
  const db = untypedDatabase(svc);
  const { data: contactRow } = await db
    .from<{ id: string; workspace_id: string | null }>("contacts")
    .select("id, workspace_id")
    .eq("profile_id", pid)
    .maybeSingle();

  if (contactRow?.id) {
    await db
      .from("contacts")
      .update({ avatar_url: publicUrl })
      .eq("id", contactRow.id);
    revalidatePath(`/admin/workspaces/${contactRow.id}`);
    revalidatePath("/admin/workspaces");
  }

  if (contactRow?.workspace_id) {
    revalidatePath(`/admin/workspaces/${contactRow.workspace_id}`);
  }

  return { success: true, avatarUrl: publicUrl };
}

/**
 * Fetch the best available image URL for re-editing.
 * Checks {targetProfileId}/original.{ext} first, falls back to current avatar.
 */
export async function getAdminOriginalAvatar(
  targetProfileId: string,
  fallbackUrl?: string | null,
): Promise<{ url: string | null }> {
  const authError = await checkAdmin();
  if (authError) return { url: fallbackUrl ?? null };

  const svc = createServiceClient();

  for (const ext of ["jpg", "png", "webp"]) {
    const { data } = svc.storage
      .from("avatars")
      .getPublicUrl(`${targetProfileId}/original.${ext}`);
    if (data?.publicUrl) {
      try {
        const res = await fetch(data.publicUrl, { method: "HEAD" });
        if (res.ok) return { url: data.publicUrl };
      } catch { /* file doesn't exist at this path */ }
    }
  }

  return { url: fallbackUrl ?? null };
}

/**
 * Remove an owner's avatar (both storage files + DB rows).
 */
export async function removeAdminAvatar(
  targetProfileId: string,
): Promise<{ success?: boolean; error?: string }> {
  const authError = await checkAdmin();
  if (authError) return { error: authError };

  const svc = createServiceClient();

  await svc.from("profiles").update({ avatar_url: null }).eq("id", targetProfileId);

  const filesToDelete = ["jpg", "png", "webp"].flatMap((ext) => [
    `${targetProfileId}/cropped.${ext}`,
    `${targetProfileId}/original.${ext}`,
  ]);
  await svc.storage.from("avatars").remove(filesToDelete);

  // Sync to linked contact.
  const db = untypedDatabase(svc);
  const { data: contactRow } = await db
    .from<{ id: string; workspace_id: string | null }>("contacts")
    .select("id, workspace_id")
    .eq("profile_id", targetProfileId)
    .maybeSingle();

  if (contactRow?.id) {
    await db
      .from("contacts")
      .update({ avatar_url: null })
      .eq("id", contactRow.id);
    revalidatePath(`/admin/workspaces/${contactRow.id}`);
    revalidatePath("/admin/workspaces");
  }

  if (contactRow?.workspace_id) {
    revalidatePath(`/admin/workspaces/${contactRow.workspace_id}`);
  }

  return { success: true };
}
