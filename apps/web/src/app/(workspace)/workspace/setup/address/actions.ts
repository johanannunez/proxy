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
  address_line1: z.string().trim().min(1, "Street address is required."),
  address_line2: z.string().trim().max(120).optional().or(z.literal("")),
  city: z.string().trim().min(1, "City is required."),
  state: z.string().trim().min(2, "State is required."),
  postal_code: z.string().trim().min(3, "ZIP code is required."),
});

export type SaveAddressState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function saveAddress(
  _prev: SaveAddressState,
  formData: FormData,
): Promise<SaveAddressState> {
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
  const { error } = await supabase
    .from("properties")
    .update({
      address_line1: v.address_line1,
      address_line2: v.address_line2 || null,
      city: v.city,
      state: v.state.toUpperCase(),
      postal_code: v.postal_code,
    })
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
      field_name: "address",
      description: `Address updated to ${v.address_line1}, ${v.city}, ${v.state}`,
    },
  }).then(() => {}, () => {});

  void logTimelineEvent({
    ownerId: user.id,
    eventType: "onboarding_step",
    category: "account",
    title: "Completed onboarding: Property address",
    propertyId: v.property_id,
    visibility: "admin_only",
    metadata: { step: "address" },
  });

  await recordVersion(supabase, {
    userId: user.id,
    propertyId: v.property_id,
    stepKey: "address",
    data: {
      address_line1: v.address_line1,
      address_line2: v.address_line2,
      city: v.city,
      state: v.state,
      postal_code: v.postal_code,
    },
  });

  revalidatePath("/workspace/setup");
  redirect(`/workspace/setup?just=address&property=${v.property_id}`);
}
