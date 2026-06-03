"use server";

import { getWorkspaceContext } from "@/lib/workspace-context";
import { ensureSignatureSubmission } from "@/lib/documents/signing";

export type StartSignatureResponse = {
  ok: boolean;
  embedUrl: string | null;
  status: "ready" | "preparing";
  error?: string;
};

/**
 * Start (or resume) an embedded signature for a spine document and return the
 * current user's embedded signing URL. Authorized via the RLS client: the caller
 * can only act on a document they can see (their own / their workspace's).
 */
export async function startSignature(documentId: string): Promise<StartSignatureResponse> {
  const { userId, client } = await getWorkspaceContext();

  // RLS + ownership: confirm the caller can see this document and is the owner.
  const { data: doc } = await client.from("documents").select("id, owner_id").eq("id", documentId).maybeSingle();
  if (!doc) return { ok: false, embedUrl: null, status: "preparing", error: "Document not found." };
  if ((doc as { id: string; owner_id: string }).owner_id !== userId) {
    return { ok: false, embedUrl: null, status: "preparing", error: "Not authorized." };
  }

  const result = await ensureSignatureSubmission({ documentId, signerProfileId: userId });
  if (!result.ok) return { ok: false, embedUrl: null, status: "preparing", error: result.error };
  return { ok: true, embedUrl: result.embedUrl, status: result.status };
}
