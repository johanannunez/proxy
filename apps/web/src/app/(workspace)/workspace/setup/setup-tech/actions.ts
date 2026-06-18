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
  wifi_ssid: z.string().trim().max(500).optional().default(""),
  wifi_password: z.string().trim().max(500).optional().default(""),
  wifi_router_location: z.string().trim().max(500).optional().default(""),
  guest_network_ssid: z.string().trim().max(500).optional().default(""),
  guest_network_password: z.string().trim().max(500).optional().default(""),
  doorbell_brand: z.string().trim().max(500).optional().default(""),
  doorbell_admin_access: z.string().trim().max(500).optional().default(""),
  thermostat_brand: z.string().trim().max(500).optional().default(""),
  thermostat_admin_access: z.string().trim().max(500).optional().default(""),
  noise_monitor_brand: z.string().trim().max(500).optional().default(""),
  noise_monitor_location: z.string().trim().max(500).optional().default(""),
  noise_monitor_admin_access: z.string().trim().max(500).optional().default(""),
  tvs: z.string().trim().max(2000).optional().default(""),
  other_devices: z.string().trim().max(2000).optional().default(""),
});

export type SaveSetupTechState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function saveSetupTech(
  _prev: SaveSetupTechState,
  formData: FormData,
): Promise<SaveSetupTechState> {
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

  const saveError = await upsertPropertyForm(propertyId, "setup_tech", data);

  if (saveError) return { error: saveError };

  const svc = createServiceClient();
  untypedDatabase(svc)
    .from("activity_log")
    .insert({
      action: "property_updated",
      entity_type: "property",
      entity_id: propertyId,
      actor_id: user.id,
      metadata: { field_name: "setup_tech", description: "Setup: tech and connectivity saved" },
    })
    .then(
      () => {},
      () => {},
    );

  revalidatePath("/workspace/setup");
  redirect(`/workspace/setup/setup-house-rules?property=${propertyId}`);
}
