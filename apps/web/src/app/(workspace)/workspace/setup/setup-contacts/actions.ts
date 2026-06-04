"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { untypedDatabase } from "@/lib/supabase/untyped";

const schema = z.object({
  property_id: z.string().uuid("Property ID is required."),
  owner_emergency_name: z.string().trim().max(500).optional().default(""),
  owner_emergency_phone: z.string().trim().max(500).optional().default(""),
  plumber_name: z.string().trim().max(500).optional().default(""),
  plumber_phone: z.string().trim().max(500).optional().default(""),
  hvac_name: z.string().trim().max(500).optional().default(""),
  hvac_phone: z.string().trim().max(500).optional().default(""),
  electrician_name: z.string().trim().max(500).optional().default(""),
  electrician_phone: z.string().trim().max(500).optional().default(""),
  handyman_name: z.string().trim().max(500).optional().default(""),
  handyman_phone: z.string().trim().max(500).optional().default(""),
  hoa_emergency_phone: z.string().trim().max(500).optional().default(""),
  pest_control_name: z.string().trim().max(500).optional().default(""),
  pest_control_phone: z.string().trim().max(500).optional().default(""),
  nearest_hospital_name: z.string().trim().max(500).optional().default(""),
  nearest_hospital_address: z.string().trim().max(500).optional().default(""),
});

export type SaveSetupContactsState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function saveSetupContacts(
  _prev: SaveSetupContactsState,
  formData: FormData,
): Promise<SaveSetupContactsState> {
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
        form_key: "setup_contacts",
        data: {
          owner_emergency_name: v.owner_emergency_name,
          owner_emergency_phone: v.owner_emergency_phone,
          plumber_name: v.plumber_name,
          plumber_phone: v.plumber_phone,
          hvac_name: v.hvac_name,
          hvac_phone: v.hvac_phone,
          electrician_name: v.electrician_name,
          electrician_phone: v.electrician_phone,
          handyman_name: v.handyman_name,
          handyman_phone: v.handyman_phone,
          hoa_emergency_phone: v.hoa_emergency_phone,
          pest_control_name: v.pest_control_name,
          pest_control_phone: v.pest_control_phone,
          nearest_hospital_name: v.nearest_hospital_name,
          nearest_hospital_address: v.nearest_hospital_address,
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
      metadata: { field_name: "setup_contacts", description: "Setup: emergency contacts saved" },
    })
    .then(
      () => {},
      () => {},
    );

  revalidatePath("/workspace/setup");
  redirect(`/workspace/setup/setup-tech?property=${v.property_id}`);
}
