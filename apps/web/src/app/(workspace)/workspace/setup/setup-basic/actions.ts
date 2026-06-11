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
  property_type: z.string().trim().max(500).optional().default(""),
  year_built: z.string().trim().max(500).optional().default(""),
  sqft: z.string().trim().max(500).optional().default(""),
  bedrooms: z.string().trim().max(500).optional().default(""),
  bathrooms: z.string().trim().max(500).optional().default(""),
  max_guests: z.string().trim().max(500).optional().default(""),
  bed_count: z.string().trim().max(500).optional().default(""),
  has_adu: z.string().trim().max(500).optional().default(""),
  arrangements: z.string().trim().max(500).optional().default(""),
});

export type SaveSetupBasicState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function saveSetupBasic(
  _prev: SaveSetupBasicState,
  formData: FormData,
): Promise<SaveSetupBasicState> {
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

  const saveError = await upsertPropertyForm(v.property_id, "setup_basic", {
          property_type: v.property_type,
          year_built: v.year_built,
          sqft: v.sqft,
          bedrooms: v.bedrooms,
          bathrooms: v.bathrooms,
          max_guests: v.max_guests,
          bed_count: v.bed_count,
          has_adu: v.has_adu,
          arrangements: v.arrangements,
        });

  if (saveError) return { error: saveError };

  const svc = createServiceClient();
  untypedDatabase(svc)
    .from("activity_log")
    .insert({
      action: "property_updated",
      entity_type: "property",
      entity_id: v.property_id,
      actor_id: user.id,
      metadata: { field_name: "setup_basic", description: "Setup: basic info saved" },
    })
    .then(
      () => {},
      () => {},
    );

  revalidatePath("/workspace/setup");
  redirect(`/workspace/setup/setup-access?property=${v.property_id}`);
}
