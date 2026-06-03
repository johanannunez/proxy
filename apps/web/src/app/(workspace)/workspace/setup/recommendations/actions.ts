"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const schema = z.object({
  property_id: z.string().uuid("Property ID is required."),
  restaurants: z.string().trim().max(5000).optional().default(""),
  coffee_shops: z.string().trim().max(5000).optional().default(""),
  grocery_stores: z.string().trim().max(5000).optional().default(""),
  activities: z.string().trim().max(5000).optional().default(""),
  beaches_parks: z.string().trim().max(5000).optional().default(""),
  local_tips: z.string().trim().max(5000).optional().default(""),
  emergency_services: z.string().trim().max(5000).optional().default(""),
});

export type SaveRecommendationsState = { error?: string; };

export async function saveRecommendations(
  _prev: SaveRecommendationsState,
  formData: FormData,
): Promise<SaveRecommendationsState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { error: "Something went wrong. Please try again." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const v = parsed.data;

  const { error } = await (supabase as any)
    .from("property_forms")
    .upsert(
      {
        property_id: v.property_id,
        form_key: "guidebook",
        data: {
          restaurants: v.restaurants,
          coffee_shops: v.coffee_shops,
          grocery_stores: v.grocery_stores,
          activities: v.activities,
          beaches_parks: v.beaches_parks,
          local_tips: v.local_tips,
          emergency_services: v.emergency_services,
        },
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "property_id,form_key" },
    );

  if (error) return { error: error.message };

  const svc = createServiceClient();
  svc.from("activity_log" as any).insert({
    action: "property_updated",
    entity_type: "property",
    entity_id: v.property_id,
    actor_id: user.id,
    metadata: { field_name: "guidebook", description: "Guidebook recommendations saved" },
  }).then(() => {}, () => {});

  revalidatePath("/workspace/setup");
  redirect(`/workspace/setup?just=recommendations&property=${v.property_id}`);
}
