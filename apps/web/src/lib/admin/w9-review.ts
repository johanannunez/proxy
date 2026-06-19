import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { generateW9SignedUrl } from "@/lib/tax/w9-storage";

export type AdminActorContext = {
  /** The authenticated admin or compliance profile id. */
  profileId: string;
  /** The admin's role; restricts what they can do. */
  role: "admin" | "compliance";
};

async function requireReviewer(): Promise<AdminActorContext | null> {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;

  const { data: profile } = await client
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (!profile) return null;
  // The `compliance` value was added in the tax_data_foundation
  // migration but is not yet in the generated Supabase types. Cast
  // to a wider string union for comparison.
  const role = profile.role as "admin" | "owner" | "compliance";
  if (role !== "admin" && role !== "compliance") return null;
  return { profileId: profile.id, role };
}

export type W9SignedUrlForReviewInput = {
  /** Either of these. The storage path takes priority. */
  storagePath?: string;
  signedDocumentId?: string;
  /** Audit-log context. */
  userAgent?: string | null;
  ipAddress?: string | null;
  reason?: string;
};

/**
 * Admin / compliance entry point for opening a W-9. Resolves the
 * reviewer's identity, then delegates to generateW9SignedUrl so
 * every review-time read is captured in w9_access_log.
 */
export async function getW9SignedUrlForReview(
  input: W9SignedUrlForReviewInput,
): Promise<{ ok: true; url: string; expiresAt: string } | { ok: false; error: string }> {
  const actor = await requireReviewer();
  if (!actor) {
    return { ok: false, error: "Not authorized." };
  }

  // Reviewers need to see other owners' files. The service-role
  // client bypasses RLS; the storage RLS on `documents` would block
  // the user-bound client outside the reviewer's own folder.
  const service = createServiceClient();

  const target = input.storagePath
    ? { storagePath: input.storagePath }
    : input.signedDocumentId
      ? { signedDocumentId: input.signedDocumentId }
      : null;

  if (!target) {
    return { ok: false, error: "storagePath or signedDocumentId is required." };
  }

  // Resolve the document's owner_id so we can compare org membership
  // before minting a signed URL. The `documents` table carries owner_id
  // directly; storage paths are prefixed with {ownerProfileId}/ per
  // uploadW9Pdf in w9-storage.ts.
  let documentOwnerId: string | null = null;
  if (input.signedDocumentId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: docRow } = await (service as any)
      .from("documents")
      .select("owner_id")
      .eq("id", input.signedDocumentId)
      .maybeSingle();
    documentOwnerId = (docRow as { owner_id: string } | null)?.owner_id ?? null;
  } else if (input.storagePath) {
    // Storage path format: {ownerProfileId}/w9-{timestamp}-{entropy}-{filename}
    documentOwnerId = input.storagePath.split("/")[0] ?? null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: meProfile } = await (service as any)
    .from("profiles")
    .select("agency_id")
    .eq("id", actor.profileId)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: ownerProfile } = documentOwnerId
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? await (service as any)
        .from("profiles")
        .select("agency_id")
        .eq("id", documentOwnerId)
        .maybeSingle()
    : { data: null };

  const meOrgId = (meProfile as { agency_id: string | null } | null)?.agency_id;
  const ownerOrgId = (ownerProfile as { agency_id: string | null } | null)?.agency_id;

  if (!ownerProfile || !meOrgId || !ownerOrgId || ownerOrgId !== meOrgId) {
    throw new Error("Not authorized to access this document.");
  }

  const result = await generateW9SignedUrl(service, {
    access: {
      accessorProfileId: actor.profileId,
      reason: input.reason ?? `compliance review (${actor.role})`,
      userAgent: input.userAgent ?? null,
      ipAddress: input.ipAddress ?? null,
    },
    target,
  });

  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, url: result.url, expiresAt: result.expiresAt };
}

export type VerifyW9Result = { ok: true } | { ok: false; error: string };

/**
 * Mark an owner's W-9 as verified. Caller must be admin or compliance.
 */
export async function verifyW9(ownerId: string): Promise<VerifyW9Result> {
  const actor = await requireReviewer();
  if (!actor) return { ok: false, error: "Not authorized." };

  const service = createServiceClient();
  try {
    // Single upsert — all tax_profile columns set atomically.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: profileError } = await (service as any)
      .from("tax_profiles")
      .upsert(
        {
          owner_id: ownerId,
          status: "verified",
          reviewed_by: actor.profileId,
          reviewed_at: new Date().toISOString(),
          rejection_reason: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "owner_id" },
      );
    if (profileError) throw new Error(profileError.message);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any)
      .from("documents")
      .update({ status: "verified" })
      .eq("owner_id", ownerId)
      .eq("doc_type", "w9");
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Verify failed." };
  }

  revalidatePath("/admin/paperwork");
  revalidatePath("/workspace/setup/w9");
  return { ok: true };
}

/**
 * Reject an owner's W-9 with a reason that the owner will see on
 * /portal/setup/w9. Caller must be admin or compliance.
 */
export async function rejectW9(
  ownerId: string,
  reason: string,
): Promise<VerifyW9Result> {
  const actor = await requireReviewer();
  if (!actor) return { ok: false, error: "Not authorized." };

  const trimmed = reason.trim();
  if (!trimmed) {
    return { ok: false, error: "Rejection reason is required so the owner knows what to fix." };
  }

  const service = createServiceClient();
  try {
    // Single upsert — all tax_profile columns set atomically.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: profileError } = await (service as any)
      .from("tax_profiles")
      .upsert(
        {
          owner_id: ownerId,
          status: "rejected",
          reviewed_by: actor.profileId,
          reviewed_at: new Date().toISOString(),
          rejection_reason: trimmed,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "owner_id" },
      );
    if (profileError) throw new Error(profileError.message);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any)
      .from("documents")
      .update({ status: "rejected" })
      .eq("owner_id", ownerId)
      .eq("doc_type", "w9");
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Reject failed." };
  }

  revalidatePath("/admin/paperwork");
  revalidatePath("/workspace/setup/w9");
  return { ok: true };
}
