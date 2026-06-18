"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/lib/workspace-context";
import { uploadW9Pdf, upsertTaxProfile } from "@/lib/tax/w9-storage";
import { createServiceClient } from "@/lib/supabase/service";
import { syncSpineForOwner } from "@/lib/documents/spine";

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
  const { userId, client, isImpersonating } = await getWorkspaceContext();
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

  // Record the submission on the owner's tax profile first.
  try {
    await upsertTaxProfile(client, userId, {
      legalName,
      status: "submitted",
      signatureDate: new Date().toISOString().slice(0, 10),
    });
  } catch (err) {
    await client.storage.from("documents").remove([uploaded.storagePath]);
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Tax profile update failed.",
    };
  }

  // Write the canonical W-9 spine row via the service client (spine is
  // system-managed; owners have no direct write policy on `documents`).
  const w9Title = legalName ? `W-9 (${legalName})` : "W-9";
  const fileRef = `documents://${uploaded.storagePath}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { data: existingDoc } = await service
    .from("documents")
    .select("id")
    .eq("owner_id", userId)
    .eq("document_key", "w9")
    .is("property_id", null)
    .maybeSingle();
  const now = new Date().toISOString();
  if (existingDoc) {
    await service.from("documents").update({
      title: w9Title, file_url: fileRef, status: "submitted", source: "upload",
      submitted_at: now, uploaded_by: userId,
    }).eq("id", existingDoc.id);
  } else {
    await service.from("documents").insert({
      owner_id: userId, document_key: "w9", doc_type: "w9", title: w9Title,
      file_url: fileRef, status: "submitted", scope: "all", scope_kind: "owner",
      visibility: "client", gate_group: "rest", sequence: 4, source: "upload",
      submitted_at: now, uploaded_by: userId,
    });
  }

  // Reconcile the rest of the owner's spine (status precedence + file_url preserved).
  await syncSpineForOwner(userId);

  revalidatePath("/workspace/setup/w9");
  revalidatePath("/workspace/setup");
  redirect("/workspace/setup/w9?uploaded=1");
}
