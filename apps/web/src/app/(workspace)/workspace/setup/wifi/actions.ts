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
  provider: z.string().trim().max(200).optional().default(""),
  ssid: z.string().trim().max(200).optional().default(""),
  password: z.string().trim().max(200).optional().default(""),
  router_location: z.string().trim().max(500).optional().default(""),
  modem_location: z.string().trim().max(500).optional().default(""),
  account_website: z.string().trim().max(500).optional().default(""),
  account_username: z.string().trim().max(200).optional().default(""),
  account_password: z.string().trim().max(200).optional().default(""),
});

export type SaveWifiState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function saveWifi(
  _prev: SaveWifiState,
  formData: FormData,
): Promise<SaveWifiState> {
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
  const wifiDetails = {
    provider: v.provider || null,
    ssid: v.ssid || null,
    password: v.password || null,
    router_location: v.router_location || null,
    modem_location: v.modem_location || null,
    account_website: v.account_website || null,
    account_username: v.account_username || null,
    account_password: v.account_password || null,
  };

  const { error } = await supabase
    .from("properties")
    .update({ wifi_details: wifiDetails })
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
      field_name: "wifi",
      description: "WiFi details updated",
    },
  }).then(() => {}, () => {});

  void logTimelineEvent({
    ownerId: user.id,
    eventType: "onboarding_step",
    category: "account",
    title: "Completed onboarding: WiFi and access",
    propertyId: v.property_id,
    visibility: "admin_only",
    metadata: { step: "wifi" },
  });

  await recordVersion(supabase, {
    userId: user.id,
    propertyId: v.property_id,
    stepKey: "wifi",
    data: wifiDetails,
  });

  revalidatePath("/workspace/setup");
  redirect(`/workspace/setup?just=wifi&property=${v.property_id}`);
}
