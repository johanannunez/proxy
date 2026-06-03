"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CHECKLIST_TEMPLATE, type ChecklistStatus } from "@/lib/checklist";

export type OwnerPickerItem = { id: string; label: string };

export async function fetchOwnersForPicker(): Promise<OwnerPickerItem[]> {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "")
    .maybeSingle();
  if (profile?.role !== "admin") return [];

  const svc = createServiceClient();
  const { data } = await svc
    .from("profiles")
    .select("id, full_name, email")
    .eq("role", "owner")
    .order("full_name", { ascending: true });

  return (data ?? []).map((p) => ({
    id: p.id,
    label: p.full_name || p.email || p.id,
  }));
}

const QuickPropertySchema = z.object({
  ownerId: z.string().uuid("Select an owner"),
  propertyType: z.enum(["str", "ltr", "mtr", "co-hosting", "arbitrage"]),
  addressLine1: z.string().trim().min(1, "Street address is required"),
  city: z.string().trim().min(1, "City is required"),
  state: z.string().trim().min(2, "State is required"),
  postalCode: z.string().trim().min(3, "Postal code is required"),
});

export type QuickCreatePropertyResult =
  | { ok: true; propertyId: string }
  | { ok: false; error: string };

export async function quickCreateAdminProperty(
  input: unknown,
): Promise<QuickCreatePropertyResult> {
  const parsed = QuickPropertySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") return { ok: false, error: "Admins only." };

  const svc = createServiceClient();
  const v = parsed.data;
  const { data: inserted, error } = await svc
    .from("properties")
    .insert({
      owner_id: v.ownerId,
      property_type: v.propertyType as "str" | "ltr" | "mtr" | "co-hosting" | "arbitrage",
      address_line1: v.addressLine1,
      city: v.city,
      state: v.state,
      postal_code: v.postalCode,
      active: true,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/properties");
  return { ok: true, propertyId: inserted.id };
}

const Schema = z.object({
  propertyId: z.string().uuid(),
  hospitableId: z.string().min(1).max(200).nullable(),
  icalUrl: z
    .string()
    .url()
    .max(1000)
    .nullable()
    .or(z.literal("").transform(() => null)),
});

export type SaveResult = { ok: true } | { ok: false; error: string };

export async function saveHospitableConnection(
  input: unknown,
): Promise<SaveResult> {
  const parsed = Schema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ??
        "Check the fields and try again.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") return { ok: false, error: "Admins only." };

  const { error } = await supabase
    .from("properties")
    .update({
      hospitable_property_id: parsed.data.hospitableId,
      ical_url: parsed.data.icalUrl,
    })
    .eq("id", parsed.data.propertyId);

  if (error) return { ok: false, error: error.message };

  // Log activity (fire-and-forget)
  const svc = createServiceClient();
  svc.from("activity_log").insert({
    action: "property_updated",
    entity_type: "property",
    entity_id: parsed.data.propertyId,
    actor_id: user.id,
    metadata: {
      field_name: "hospitable_connection",
      hospitable_id: parsed.data.hospitableId,
      ical_url: parsed.data.icalUrl,
      description: "Hospitable connection updated",
    },
  }).then(() => {}, () => {});

  revalidatePath("/admin/properties");
  revalidatePath("/workspace/reserve");
  return { ok: true };
}

/* ─── Checklist: seed all 33 items for a property ─── */

export async function seedChecklistForProperty(
  propertyId: string,
): Promise<SaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") return { ok: false, error: "Admins only." };

  const rows = CHECKLIST_TEMPLATE.map((t) => ({
    property_id: propertyId,
    category: t.category,
    item_key: t.item_key,
    label: t.label,
    sort_order: t.sort_order,
    status: "not_started" as const,
  }));

  // Use service client to bypass RLS for batch insert
  // Cast through any: table not in generated types yet
  const svc = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc as any)
    .from("property_checklist_items")
    .upsert(rows, { onConflict: "property_id,item_key" });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/properties");
  return { ok: true };
}

/* ─── Checklist: update a single item's status ─── */

const validStatuses: ChecklistStatus[] = ["not_started", "in_progress", "pending_owner", "stuck", "completed"];

export async function updateChecklistStatus(
  itemId: string,
  status: ChecklistStatus,
): Promise<SaveResult> {
  if (!validStatuses.includes(status)) {
    return { ok: false, error: "Invalid status." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") return { ok: false, error: "Admins only." };

  // Cast through any: table not in generated types yet
  const svc = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc as any)
    .from("property_checklist_items")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", itemId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/properties");
  return { ok: true };
}
