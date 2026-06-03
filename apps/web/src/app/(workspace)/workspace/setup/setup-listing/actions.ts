"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const schema = z.object({
  property_id: z.string().uuid("Property ID is required."),
  personal_items_areas: z.string().trim().max(2000).optional().default(""),
  items_to_secure: z.string().trim().max(2000).optional().default(""),
  photography_scheduling_notes: z.string().trim().max(2000).optional().default(""),
  staging_notes: z.string().trim().max(2000).optional().default(""),
});

export type SaveSetupListingState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function saveSetupListing(
  _prev: SaveSetupListingState,
  formData: FormData,
): Promise<SaveSetupListingState> {
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
        form_key: "setup_listing",
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
      metadata: { field_name: "setup_listing", description: "Setup: listing setup saved" },
    })
    .then(
      () => {},
      () => {},
    );

  revalidatePath("/workspace/setup");
  redirect(`/workspace/setup/setup-communication?property=${propertyId}`);
}
