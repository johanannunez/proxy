"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPortalContext } from "@/lib/portal-context";
import { uploadW9Pdf, upsertTaxProfile } from "@/lib/tax/w9-storage";

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export type UploadW9State =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; storagePath: string };

/**
 * Server action invoked from the W-9 upload form. Validates the file,
 * stores it under the owner's folder in the private `documents`
 * bucket, records a row in `public.documents`, and bumps the owner's
 * tax_profile.status to 'submitted'.
 */
export async function uploadW9Action(
  _prev: UploadW9State,
  formData: FormData,
): Promise<UploadW9State> {
  const { userId, client, isImpersonating } = await getPortalContext();
  if (isImpersonating) {
    return { status: "error", message: "Admins cannot upload on behalf of an owner." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Pick a PDF or photo of your completed W-9 to upload." };
  }
  if (file.size > MAX_BYTES) {
    return {
      status: "error",
      message: `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Limit is 20 MB.`,
    };
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return {
      status: "error",
      message: "Only PDF, PNG, JPEG, or WEBP files are accepted.",
    };
  }

  const legalName = (formData.get("legal_name") as string | null)?.trim() || null;

  const uploaded = await uploadW9Pdf(client, {
    ownerProfileId: userId,
    file,
    filename: file.name,
    contentType: file.type,
  });
  if (!uploaded.ok) {
    return { status: "error", message: `Upload failed: ${uploaded.error}` };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: docRow, error: docError } = await (client as any)
    .from("documents")
    .insert({
      owner_id: userId,
      title: legalName ? `W-9 (${legalName})` : "W-9",
      doc_type: "w9",
      file_url: `documents://${uploaded.storagePath}`,
      status: "pending",
      scope: "all",
      uploaded_by: userId,
    })
    .select("id")
    .single();
  if (docError) {
    await client.storage.from("documents").remove([uploaded.storagePath]);
    return {
      status: "error",
      message: `Storage succeeded but the document record could not be created: ${docError.message}`,
    };
  }

  try {
    await upsertTaxProfile(client, userId, {
      legalName,
      status: "submitted",
      signatureDate: new Date().toISOString().slice(0, 10),
    });
  } catch (err) {
    await client.storage.from("documents").remove([uploaded.storagePath]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client as any).from("documents").delete().eq("id", docRow.id);
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Tax profile update failed.",
    };
  }

  revalidatePath("/portal/setup/w9");
  revalidatePath("/portal/setup");
  redirect("/portal/setup/w9?uploaded=1");
}
