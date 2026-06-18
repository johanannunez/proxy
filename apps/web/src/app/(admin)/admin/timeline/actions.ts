/* eslint-disable @typescript-eslint/no-explicit-any */
// owner_timeline table is not yet in the generated Supabase types.
// Remove this disable once types are regenerated.
"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase: null as never, userId: "" as never, error: "You must be signed in." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { supabase: null as never, userId: "" as never, error: "Admin access required." };
  }

  return { supabase, userId: user.id, error: null };
}

function revalidateTimeline() {
  revalidatePath("/admin/timeline");
  revalidatePath("/workspace/timeline");
}

// ---------------------------------------------------------------------------
// Toggle visibility (owner <-> admin_only)
// ---------------------------------------------------------------------------

export async function toggleTimelineVisibility(
  entryId: string,
): Promise<{ ok: boolean; message: string }> {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { ok: false, message: authError };

  const { data: entry, error: fetchError } = await (supabase as any)
    .from("owner_timeline")
    .select("visibility")
    .eq("id", entryId)
    .single();

  if (fetchError || !entry) {
    return { ok: false, message: "Entry not found." };
  }

  const newVisibility = entry.visibility === "owner" ? "admin_only" : "owner";

  const { error } = await (supabase as any)
    .from("owner_timeline")
    .update({ visibility: newVisibility })
    .eq("id", entryId);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidateTimeline();
  return {
    ok: true,
    message: newVisibility === "owner" ? "Now visible to owner." : "Now admin only.",
  };
}

// ---------------------------------------------------------------------------
// Toggle pin
// ---------------------------------------------------------------------------

export async function toggleTimelinePin(
  entryId: string,
): Promise<{ ok: boolean; message: string }> {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { ok: false, message: authError };

  const { data: entry, error: fetchError } = await (supabase as any)
    .from("owner_timeline")
    .select("is_pinned")
    .eq("id", entryId)
    .single();

  if (fetchError || !entry) {
    return { ok: false, message: "Entry not found." };
  }

  const { error } = await (supabase as any)
    .from("owner_timeline")
    .update({ is_pinned: !entry.is_pinned })
    .eq("id", entryId);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidateTimeline();
  return {
    ok: true,
    message: entry.is_pinned ? "Unpinned." : "Pinned.",
  };
}

// ---------------------------------------------------------------------------
// Soft delete
// ---------------------------------------------------------------------------

export async function softDeleteTimelineEntry(
  entryId: string,
): Promise<{ ok: boolean; message: string }> {
  const { supabase, userId, error: authError } = await requireAdmin();
  if (authError) return { ok: false, message: authError };

  const { error } = await (supabase as any)
    .from("owner_timeline")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: userId,
    })
    .eq("id", entryId);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidateTimeline();
  return { ok: true, message: "Entry deleted." };
}

// ---------------------------------------------------------------------------
// Create entry (uses service client to bypass RLS)
// ---------------------------------------------------------------------------

export async function createTimelineEntry(
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const { userId, error: authError } = await requireAdmin();
  if (authError) return { ok: false, message: authError };

  const ownerId = formData.get("owner_id") as string;
  const eventType = formData.get("event_type") as string;
  const category = formData.get("category") as string;
  const title = formData.get("title") as string;
  const body = (formData.get("body") as string) || null;
  const propertyId = (formData.get("property_id") as string) || null;
  const visibility = (formData.get("visibility") as string) || "owner";
  const icon = (formData.get("icon") as string) || null;

  if (!ownerId || !title?.trim()) {
    return { ok: false, message: "Owner and title are required." };
  }

  const service = createServiceClient();

  const { error } = await (service as any).from("owner_timeline").insert({
    owner_id: ownerId,
    event_type: eventType || "note",
    category: category || "account",
    title: title.trim(),
    body,
    property_id: propertyId,
    visibility,
    icon,
    created_by: userId,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidateTimeline();
  return { ok: true, message: "Entry created." };
}
