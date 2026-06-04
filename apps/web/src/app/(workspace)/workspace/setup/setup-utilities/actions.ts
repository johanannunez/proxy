"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { untypedDatabase } from "@/lib/supabase/untyped";

const schema = z.object({
  property_id: z.string().uuid("Property ID is required."),
  electric_provider: z.string().trim().max(500).optional().default(""),
  electric_account_number: z.string().trim().max(500).optional().default(""),
  gas_provider: z.string().trim().max(500).optional().default(""),
  gas_account_number: z.string().trim().max(500).optional().default(""),
  water_provider: z.string().trim().max(500).optional().default(""),
  water_account_number: z.string().trim().max(500).optional().default(""),
  trash_pickup_days: z.string().trim().max(500).optional().default(""),
  bin_location: z.string().trim().max(500).optional().default(""),
  breaker_panel_location: z.string().trim().max(500).optional().default(""),
  hvac_brand: z.string().trim().max(500).optional().default(""),
  hvac_filter_size: z.string().trim().max(500).optional().default(""),
  hvac_filter_interval: z.string().trim().max(500).optional().default(""),
  hvac_service_company: z.string().trim().max(500).optional().default(""),
  hvac_service_phone: z.string().trim().max(500).optional().default(""),
  water_heater_type: z.string().trim().max(500).optional().default(""),
  water_heater_location: z.string().trim().max(500).optional().default(""),
  smoke_detector_locations: z.string().trim().max(500).optional().default(""),
  co_detector_locations: z.string().trim().max(500).optional().default(""),
  first_aid_kit_location: z.string().trim().max(500).optional().default(""),
  fire_extinguisher_location: z.string().trim().max(500).optional().default(""),
  fire_extinguisher_last_inspection: z.string().trim().max(500).optional().default(""),
});

export type SaveSetupUtilitiesState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function saveSetupUtilities(
  _prev: SaveSetupUtilitiesState,
  formData: FormData,
): Promise<SaveSetupUtilitiesState> {
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
        form_key: "setup_utilities",
        data: {
          electric_provider: v.electric_provider,
          electric_account_number: v.electric_account_number,
          gas_provider: v.gas_provider,
          gas_account_number: v.gas_account_number,
          water_provider: v.water_provider,
          water_account_number: v.water_account_number,
          trash_pickup_days: v.trash_pickup_days,
          bin_location: v.bin_location,
          breaker_panel_location: v.breaker_panel_location,
          hvac_brand: v.hvac_brand,
          hvac_filter_size: v.hvac_filter_size,
          hvac_filter_interval: v.hvac_filter_interval,
          hvac_service_company: v.hvac_service_company,
          hvac_service_phone: v.hvac_service_phone,
          water_heater_type: v.water_heater_type,
          water_heater_location: v.water_heater_location,
          smoke_detector_locations: v.smoke_detector_locations,
          co_detector_locations: v.co_detector_locations,
          first_aid_kit_location: v.first_aid_kit_location,
          fire_extinguisher_location: v.fire_extinguisher_location,
          fire_extinguisher_last_inspection: v.fire_extinguisher_last_inspection,
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
      metadata: { field_name: "setup_utilities", description: "Setup: utilities and systems saved" },
    })
    .then(
      () => {},
      () => {},
    );

  revalidatePath("/workspace/setup");
  redirect(`/workspace/setup/setup-appliances?property=${v.property_id}`);
}
