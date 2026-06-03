"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logTimelineEvent } from "@/lib/timeline";
import { recordVersion } from "@/lib/wizard/version-history";

const schema = z.object({
  property_id: z.string().uuid("Property ID is required."),
  pets: z.enum(["yes", "no", "conditional"]).optional().default("no"),
  pets_note: z.string().trim().max(500).optional().default(""),
  smoking: z.enum(["yes", "no"]).optional().default("no"),
  events: z.enum(["yes", "no"]).optional().default("no"),
  quiet_hours_start: z.string().optional().default("22:00"),
  quiet_hours_end: z.string().optional().default("08:00"),
  check_in_time: z.string().optional().default("15:00"),
  check_out_time: z.string().optional().default("11:00"),
  additional_rules: z.string().trim().max(2000).optional().default(""),
  backup_key_location: z.string().trim().max(300).optional().default(""),
  lockbox_code: z.string().trim().max(100).optional().default(""),
  gate_code: z.string().trim().max(100).optional().default(""),
  access_instructions: z.string().trim().max(2000).optional().default(""),
});

export type SaveRulesState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function saveRules(
  _prev: SaveRulesState,
  formData: FormData,
): Promise<SaveRulesState> {
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
  const houseRules = {
    pets: v.pets,
    pets_note: v.pets_note || null,
    smoking: v.smoking,
    events: v.events,
    quiet_hours_start: v.quiet_hours_start,
    quiet_hours_end: v.quiet_hours_end,
    check_in_time: v.check_in_time,
    check_out_time: v.check_out_time,
    additional_rules: v.additional_rules || null,
    backup_key_location: v.backup_key_location || null,
    lockbox_code: v.lockbox_code || null,
    gate_code: v.gate_code || null,
    access_instructions: v.access_instructions || null,
  };

  const { error } = await supabase
    .from("properties")
    .update({ house_rules: houseRules })
    .eq("id", v.property_id)
    .eq("owner_id", user.id);

  if (error) return { error: error.message };

  // Log activity (fire-and-forget)
  const svc = createServiceClient();
  svc.from("activity_log").insert({
    action: "property_updated",
    entity_type: "property",
    entity_id: v.property_id,
    actor_id: user.id,
    metadata: {
      field_name: "rules",
      description: "House rules and access details updated",
    },
  }).then(() => {}, () => {});

  void logTimelineEvent({
    ownerId: user.id,
    eventType: "onboarding_step",
    category: "account",
    title: "Completed onboarding: House rules",
    propertyId: v.property_id,
    visibility: "admin_only",
    metadata: { step: "rules" },
  });

  await recordVersion(supabase, {
    userId: user.id,
    propertyId: v.property_id,
    stepKey: "rules",
    data: houseRules,
  });

  revalidatePath("/workspace/setup");
  redirect(`/workspace/setup?just=rules&property=${v.property_id}`);
}
