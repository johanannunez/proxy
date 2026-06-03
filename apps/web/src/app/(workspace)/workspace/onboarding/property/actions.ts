"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logTimelineEvent } from "@/lib/timeline";

const schema = z.object({
  name: z.string().trim().max(120).optional().or(z.literal("")),
  property_type: z.enum(["str", "ltr", "arbitrage", "mtr", "co-hosting"]),
  address_line1: z.string().trim().min(1, "Street address is required"),
  address_line2: z.string().trim().max(120).optional().or(z.literal("")),
  city: z.string().trim().min(1, "City is required"),
  state: z.string().trim().min(2, "State is required"),
  postal_code: z.string().trim().min(3, "Postal code is required"),
  bedrooms: z.coerce.number().int().min(0).max(30).optional(),
  bathrooms: z.coerce.number().min(0).max(30).optional(),
  guest_capacity: z.coerce.number().int().min(0).max(60).optional(),
  square_feet: z.coerce.number().int().min(0).max(100000).optional(),
});

export type AddPropertyState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function addProperty(
  _prev: AddPropertyState,
  formData: FormData,
): Promise<AddPropertyState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]?.toString();
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in to add a property." };

  const v = parsed.data;
  const { error } = await supabase.from("properties").insert({
    owner_id: user.id,
    name: v.name || null,
    property_type: v.property_type,
    address_line1: v.address_line1,
    address_line2: v.address_line2 || null,
    city: v.city,
    state: v.state,
    postal_code: v.postal_code,
    bedrooms: v.bedrooms ?? null,
    bathrooms: v.bathrooms ?? null,
    guest_capacity: v.guest_capacity ?? null,
    square_feet: v.square_feet ?? null,
    active: true,
  });

  if (error) return { error: error.message };

  // Log activity (fire-and-forget)
  const svc = createServiceClient();
  svc.from("activity_log").insert({
    action: "property_created",
    entity_type: "property",
    entity_id: null,
    actor_id: user.id,
    metadata: {
      property_name: v.name || `${v.address_line1}, ${v.city}`,
      property_type: v.property_type,
      description: "New property added during onboarding",
    },
  }).then(() => {}, () => {});

  void logTimelineEvent({
    ownerId: user.id,
    eventType: "property_added",
    category: "property",
    title: `New property: ${v.address_line1}`,
    metadata: { property_type: v.property_type, city: v.city, state: v.state },
  });

  redirect("/workspace/onboarding/complete");
}
