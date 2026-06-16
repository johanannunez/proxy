"use server";

import { createClient } from "@/lib/supabase/server";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/**
 * Uploads a document image to the public-read `document-assets` bucket and
 * returns its public URL. Public read is required so DocuSeal's renderer can
 * fetch the image when it builds the signed PDF. Admin-only (the bucket policy
 * also enforces this).
 */
export async function uploadDocumentAsset(
  templateId: string,
  formData: FormData,
): Promise<{ url: string } | { error: string }> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "No file provided." };
  if (!ALLOWED.includes(file.type)) {
    return { error: "Only PNG, JPEG, WebP, or GIF images are allowed." };
  }
  if (file.size > MAX_BYTES) return { error: "Image must be under 5 MB." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile as { role: string } | null)?.role !== "admin") {
    return { error: "Admin access required." };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${templateId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("document-assets")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { error: `Upload failed: ${error.message}` };

  const { data } = supabase.storage.from("document-assets").getPublicUrl(path);
  return { url: data.publicUrl };
}
