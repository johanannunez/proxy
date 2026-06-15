"use server";

/**
 * Send-to-many for the unified Templates tab. Admin-gated: importable by any
 * authenticated client, so the caller's role is re-checked before any send.
 * Each selected recipient gets one tracked document instance on the spine.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendTemplateToOwner } from "@/lib/documents/signing";

export type SendTemplateResult = {
  ok: boolean;
  sent: number;
  error?: string;
};

async function requireAdmin(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "You must be signed in.";
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile as { role: string } | null)?.role !== "admin") {
    return "Admin access required.";
  }
  return null;
}

export async function sendTemplateToOwners(
  templateRecordId: string,
  ownerProfileIds: string[],
): Promise<SendTemplateResult> {
  const authError = await requireAdmin();
  if (authError) return { ok: false, sent: 0, error: authError };
  if (ownerProfileIds.length === 0) {
    return { ok: false, sent: 0, error: "Select at least one recipient." };
  }

  let sent = 0;
  let firstError: string | null = null;

  for (const ownerProfileId of ownerProfileIds) {
    const res = await sendTemplateToOwner({ templateRecordId, ownerProfileId });
    if (res.ok) sent++;
    else if (!firstError) firstError = res.error;
  }

  revalidatePath("/admin/paperwork");
  revalidatePath("/admin/paperwork/signatures");

  if (sent === 0) {
    return { ok: false, sent: 0, error: firstError ?? "Nothing was sent." };
  }
  return { ok: true, sent, error: firstError ?? undefined };
}
