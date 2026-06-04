"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { untypedDatabase } from "@/lib/supabase/untyped";

const schema = z.object({
  property_id: z.string().uuid("Property ID is required."),
  entry_method: z.string().trim().max(500).optional().default(""),
  smart_lock_brand: z.string().trim().max(500).optional().default(""),
  admin_access_shared: z.string().trim().max(500).optional().default(""),
  backup_key_location: z.string().trim().max(500).optional().default(""),
  gate_code: z.string().trim().max(500).optional().default(""),
  garage_code: z.string().trim().max(500).optional().default(""),
  parking_pass_details: z.string().trim().max(500).optional().default(""),
  secondary_entry_points: z.string().trim().max(500).optional().default(""),
  check_in_notes: z.string().trim().max(500).optional().default(""),
});

export type SaveSetupAccessState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function saveSetupAccess(
  _prev: SaveSetupAccessState,
  formData: FormData,
): Promise<SaveSetupAccessState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = schema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]?.toString();
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: "A few fields need your attention.", fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const v = parsed.data;

  const { error } = await untypedDatabase(supabase)
    .from("property_forms")
    .upsert(
      {
        property_id: v.property_id,
        form_key: "setup_access",
        data: {
          entry_method: v.entry_method,
          smart_lock_brand: v.smart_lock_brand,
          admin_access_shared: v.admin_access_shared,
          backup_key_location: v.backup_key_location,
          gate_code: v.gate_code,
          garage_code: v.garage_code,
          parking_pass_details: v.parking_pass_details,
          secondary_entry_points: v.secondary_entry_points,
          check_in_notes: v.check_in_notes,
        },
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "property_id,form_key" },
    );

  if (error) return { error: error.message };

  const svc = createServiceClient();
  untypedDatabase(svc)
    .from("activity_log")
    .insert({
      action: "property_updated",
      entity_type: "property",
      entity_id: v.property_id,
      actor_id: user.id,
      metadata: { field_name: "setup_access", description: "Setup: access and entry saved" },
    })
    .then(
      () => {},
      () => {},
    );

  revalidatePath("/workspace/setup");
  redirect(`/workspace/setup/setup-security?property=${v.property_id}`);
}
