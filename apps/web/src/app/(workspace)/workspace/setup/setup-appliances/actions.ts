"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { untypedDatabase } from "@/lib/supabase/untyped";

const schema = z.object({
  property_id: z.string().uuid("Property ID is required."),
  washer_location: z.string().trim().max(500).optional().default(""),
  washer_brand: z.string().trim().max(500).optional().default(""),
  washer_instructions: z.string().trim().max(500).optional().default(""),
  dryer_location: z.string().trim().max(500).optional().default(""),
  dryer_brand: z.string().trim().max(500).optional().default(""),
  dryer_instructions: z.string().trim().max(500).optional().default(""),
  has_dishwasher: z.string().trim().max(500).optional().default(""),
  refrigerator_brand: z.string().trim().max(500).optional().default(""),
  has_coffee_maker: z.string().trim().max(500).optional().default(""),
  coffee_maker_type: z.string().trim().max(500).optional().default(""),
  other_appliances: z.string().trim().max(500).optional().default(""),
});

export type SaveSetupAppliancesState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function saveSetupAppliances(
  _prev: SaveSetupAppliancesState,
  formData: FormData,
): Promise<SaveSetupAppliancesState> {
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
        form_key: "setup_appliances",
        data: {
          washer_location: v.washer_location,
          washer_brand: v.washer_brand,
          washer_instructions: v.washer_instructions,
          dryer_location: v.dryer_location,
          dryer_brand: v.dryer_brand,
          dryer_instructions: v.dryer_instructions,
          has_dishwasher: v.has_dishwasher,
          refrigerator_brand: v.refrigerator_brand,
          has_coffee_maker: v.has_coffee_maker,
          coffee_maker_type: v.coffee_maker_type,
          other_appliances: v.other_appliances,
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
      metadata: { field_name: "setup_appliances", description: "Setup: appliances saved" },
    })
    .then(
      () => {},
      () => {},
    );

  revalidatePath("/workspace/setup");
  redirect(`/workspace/setup/setup-contacts?property=${v.property_id}`);
}
