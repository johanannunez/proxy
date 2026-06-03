"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const schema = z.object({
  property_id: z.string().uuid("Property ID is required."),
  has_pool: z.string().trim().max(500).optional().default(""),
  pool_heating_type: z.string().trim().max(500).optional().default(""),
  pool_chemical_service_company: z.string().trim().max(500).optional().default(""),
  pool_chemical_service_phone: z.string().trim().max(500).optional().default(""),
  pool_chemical_schedule: z.string().trim().max(500).optional().default(""),
  pool_cover_type: z.string().trim().max(500).optional().default(""),
  has_hot_tub: z.string().trim().max(500).optional().default(""),
  hot_tub_heating_type: z.string().trim().max(500).optional().default(""),
  hot_tub_chemical_service_company: z.string().trim().max(500).optional().default(""),
  hot_tub_chemical_service_phone: z.string().trim().max(500).optional().default(""),
  bbq_type: z.string().trim().max(500).optional().default(""),
  bbq_propane_note: z.string().trim().max(500).optional().default(""),
  has_fire_pit: z.string().trim().max(500).optional().default(""),
  fire_pit_type: z.string().trim().max(500).optional().default(""),
  has_outdoor_shower: z.string().trim().max(500).optional().default(""),
  has_sauna: z.string().trim().max(500).optional().default(""),
  other_amenities: z.string().trim().max(2000).optional().default(""),
});

export type SaveSetupAmenitiesState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function saveSetupAmenities(
  _prev: SaveSetupAmenitiesState,
  formData: FormData,
): Promise<SaveSetupAmenitiesState> {
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
  const { property_id: propertyId, ...fields } = v;
  const data = Object.fromEntries(
    Object.entries(fields).map(([k, val]) => [k, val || null]),
  );

  const { error } = await (supabase as any)
    .from("property_forms")
    .upsert(
      {
        property_id: propertyId,
        form_key: "setup_amenities",
        data,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "property_id,form_key" },
    );

  if (error) return { error: error.message };

  const svc = createServiceClient();
  svc
    .from("activity_log" as any)
    .insert({
      action: "property_updated",
      entity_type: "property",
      entity_id: propertyId,
      actor_id: user.id,
      metadata: { field_name: "setup_amenities", description: "Setup: outdoor amenities saved" },
    })
    .then(
      () => {},
      () => {},
    );

  revalidatePath("/workspace/setup");
  redirect(`/workspace/setup/setup-listing?property=${propertyId}`);
}
