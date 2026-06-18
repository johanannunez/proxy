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
  has_security_system: z.string().trim().max(500).optional().default(""),
  system_brand: z.string().trim().max(500).optional().default(""),
  panel_location: z.string().trim().max(500).optional().default(""),
  arm_disarm_code: z.string().trim().max(500).optional().default(""),
  admin_access_shared: z.string().trim().max(500).optional().default(""),
  monitoring_company_name: z.string().trim().max(500).optional().default(""),
  monitoring_company_phone: z.string().trim().max(500).optional().default(""),
  has_sensors: z.string().trim().max(500).optional().default(""),
  sensor_battery_type: z.string().trim().max(500).optional().default(""),
  sensor_battery_amazon_link: z.string().trim().max(500).optional().default(""),
  battery_storage_location: z.string().trim().max(500).optional().default(""),
});

export type SaveSetupSecurityState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function saveSetupSecurity(
  _prev: SaveSetupSecurityState,
  formData: FormData,
): Promise<SaveSetupSecurityState> {
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

  const saveError = await upsertPropertyForm(v.property_id, "setup_security", {
          has_security_system: v.has_security_system,
          system_brand: v.system_brand,
          panel_location: v.panel_location,
          arm_disarm_code: v.arm_disarm_code,
          admin_access_shared: v.admin_access_shared,
          monitoring_company_name: v.monitoring_company_name,
          monitoring_company_phone: v.monitoring_company_phone,
          has_sensors: v.has_sensors,
          sensor_battery_type: v.sensor_battery_type,
          sensor_battery_amazon_link: v.sensor_battery_amazon_link,
          battery_storage_location: v.battery_storage_location,
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
      metadata: { field_name: "setup_security", description: "Setup: security system saved" },
    })
    .then(
      () => {},
      () => {},
    );

  revalidatePath("/workspace/setup");
  redirect(`/workspace/setup/setup-utilities?property=${v.property_id}`);
}
