import "server-only";
/* eslint-disable @typescript-eslint/no-explicit-any */
// property_forms table is not in the generated Supabase types yet — cast through any.

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { syncSpineForProperty } from "@/lib/documents/spine";

export type PropertyFormRow = {
  id: string;
  property_id: string;
  form_key: string;
  data: Record<string, unknown>;
  completed_at: string | null;
  updated_at: string;
};

/**
 * Read a single form section for a property.
 * Ownership is enforced via RLS on the user client.
 */
export async function getPropertyForm(
  propertyId: string,
  formKey: string,
): Promise<PropertyFormRow | null> {
  const supabase = await createClient();
  const { data } = await (supabase as any)
    .from("property_forms")
    .select("id, property_id, form_key, data, completed_at, updated_at")
    .eq("property_id", propertyId)
    .eq("form_key", formKey)
    .maybeSingle();
  return (data as PropertyFormRow | null) ?? null;
}

/**
 * Read all form rows for a property (for progress display).
 * Returns a map of form_key → completed boolean.
 */
export async function getPropertyFormCompletionMap(
  propertyId: string,
): Promise<Map<string, boolean>> {
  const supabase = await createClient();
  const { data } = await (supabase as any)
    .from("property_forms")
    .select("form_key, completed_at")
    .eq("property_id", propertyId);

  const map = new Map<string, boolean>();
  for (const row of (data as { form_key: string; completed_at: string | null }[]) ?? []) {
    map.set(row.form_key, row.completed_at !== null);
  }
  return map;
}

/**
 * Admin-only: read form data bypassing RLS (service client).
 */
export async function getPropertyFormAdmin(
  propertyId: string,
  formKey: string,
): Promise<PropertyFormRow | null> {
  const svc = createServiceClient();
  const { data } = await (svc as any)
    .from("property_forms")
    .select("id, property_id, form_key, data, completed_at, updated_at")
    .eq("property_id", propertyId)
    .eq("form_key", formKey)
    .maybeSingle();
  return (data as PropertyFormRow | null) ?? null;
}

/**
 * Upsert a form section. Used directly from server actions.
 * Returns null on success, or an error string.
 */
export async function upsertPropertyForm(
  propertyId: string,
  formKey: string,
  data: Record<string, unknown>,
): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from("property_forms")
    .upsert(
      {
        property_id: propertyId,
        form_key: formKey,
        data,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "property_id,form_key" },
    );
  if (error) return error.message as string;
  // Keep the documents spine in sync with this form submission.
  await syncSpineForProperty(propertyId);
  return null;
}
