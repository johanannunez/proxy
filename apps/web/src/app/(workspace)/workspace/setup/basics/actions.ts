"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logTimelineEvent } from "@/lib/timeline";
import { recordVersion } from "@/lib/wizard/version-history";

const schema = z.object({
  property_id: z.string().uuid().optional().or(z.literal("")),
  name: z.string().trim().max(120).optional().or(z.literal("")),
  property_type: z.enum(["str", "ltr", "arbitrage", "mtr", "co-hosting"], {
    message: "Pick the type that fits best.",
  }),
  home_type: z.enum(
    [
      "single_family",
      "apartment",
      "condo",
      "townhouse",
      "duplex",
      "multi_family",
      "adu",
      "studio",
      "loft",
      "cabin",
      "tiny_home",
      "mobile_home",
      "other",
    ],
    { message: "Pick the home type that fits best." },
  ),
  address_line1: z.string().trim().min(1, "Street address is required."),
  address_line2: z.string().trim().max(120).optional().or(z.literal("")),
  city: z.string().trim().min(1, "City is required."),
  state: z.string().trim().min(2, "State is required."),
  postal_code: z.string().trim().min(3, "Postal code is required."),
  country: z.string().trim().min(2).max(2).default("US"),
  bedrooms: z.coerce.number().int().min(0).max(30),
  bathrooms: z.coerce.number().min(0).max(30),
  square_feet: z.coerce
    .number({ message: "Square footage is required." })
    .int()
    .min(1, "Square footage is required.")
    .max(100000),
  guest_capacity: z.coerce.number().int().min(1).max(60),
});

export type SaveBasicsState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  savedAt?: number;
};

export async function saveBasics(
  _prev: SaveBasicsState,
  formData: FormData,
): Promise<SaveBasicsState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = schema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]?.toString();
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      error: "A few fields need your attention.",
      fieldErrors,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to save this step." };
  }

  const v = parsed.data;

  const payload = {
    owner_id: user.id,
    name: v.name || null,
    property_type: v.property_type,
    home_type: v.home_type,
    address_line1: v.address_line1,
    address_line2: v.address_line2 || null,
    city: v.city,
    state: v.state.toUpperCase(),
    postal_code: v.postal_code,
    country: v.country.toUpperCase(),
    bedrooms: v.bedrooms,
    bathrooms: v.bathrooms,
    square_feet: v.square_feet,
    guest_capacity: v.guest_capacity,
    active: true,
  };

  let propertyId = v.property_id || "";

  if (v.property_id) {
    const { error } = await supabase
      .from("properties")
      .update(payload)
      .eq("id", v.property_id)
      .eq("owner_id", user.id);

    if (error) return { error: error.message };
  } else {
    const { data: inserted, error } = await supabase
      .from("properties")
      .insert(payload)
      .select("id")
      .single();
    if (error) return { error: error.message };
    propertyId = inserted.id;
  }

  // Log activity (fire-and-forget)
  const svc = createServiceClient();
  svc.from("activity_log").insert({
    action: "property_updated",
    entity_type: "property",
    entity_id: propertyId || null,
    actor_id: user.id,
    metadata: {
      field_name: "basics",
      property_name: v.name || `${v.address_line1}, ${v.city}`,
      description: v.property_id ? "Property basics updated" : "New property created",
    },
  }).then(() => {}, () => {});

  void logTimelineEvent({
    ownerId: user.id,
    eventType: "onboarding_step",
    category: "account",
    title: "Completed onboarding: Property basics",
    propertyId: propertyId || undefined,
    visibility: "admin_only",
    metadata: { step: "basics" },
  });

  // Record version history (no-op until migration runs)
  await recordVersion(supabase, {
    userId: user.id,
    propertyId: propertyId || null,
    stepKey: "basics",
    data: payload as Record<string, unknown>,
  });

  revalidatePath("/workspace/setup");
  revalidatePath("/workspace/home");
  revalidatePath("/workspace/properties");

  const redirectUrl = propertyId
    ? `/workspace/setup?just=basics&property=${propertyId}`
    : "/workspace/setup?just=basics";
  redirect(redirectUrl);
}
