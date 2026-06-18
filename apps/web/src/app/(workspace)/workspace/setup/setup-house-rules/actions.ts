"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { untypedDatabase } from "@/lib/supabase/untyped";
import { upsertPropertyForm } from "@/lib/workspace/property-forms";

const schema = z.object({
  property_id: z.string().uuid("Property ID is required."),
  pets_policy: z.string().trim().max(500).optional().default(""),
  pets_notes: z.string().trim().max(500).optional().default(""),
  events_allowed: z.string().trim().max(500).optional().default(""),
  smoking_policy: z.string().trim().max(500).optional().default(""),
  noise_curfew: z.string().trim().max(500).optional().default(""),
  max_occupancy: z.string().trim().max(500).optional().default(""),
  min_guest_age: z.string().trim().max(500).optional().default(""),
  min_night_stay: z.string().trim().max(500).optional().default(""),
  parking_car_count: z.string().trim().max(500).optional().default(""),
  parking_locations: z.string().trim().max(500).optional().default(""),
  pool_hours: z.string().trim().max(500).optional().default(""),
  hot_tub_hours: z.string().trim().max(500).optional().default(""),
  custom_rules: z.string().trim().max(5000).optional().default(""),
});

export type SaveSetupHouseRulesState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function saveSetupHouseRules(
  _prev: SaveSetupHouseRulesState,
  formData: FormData,
): Promise<SaveSetupHouseRulesState> {
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

  const saveError = await upsertPropertyForm(propertyId, "setup_house_rules", data);

  if (saveError) return { error: saveError };

  const svc = createServiceClient();
  untypedDatabase(svc)
    .from("activity_log")
    .insert({
      action: "property_updated",
      entity_type: "property",
      entity_id: propertyId,
      actor_id: user.id,
      metadata: { field_name: "setup_house_rules", description: "Setup: house rules saved" },
    })
    .then(
      () => {},
      () => {},
    );

  revalidatePath("/workspace/setup");
  redirect(`/workspace/setup/setup-amenities?property=${propertyId}`);
}
