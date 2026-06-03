"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { geocodeAddress } from "@/lib/geocode";
import { logTimelineEvent } from "@/lib/timeline";
import { recordVersion } from "@/lib/wizard/version-history";
import type { Json } from "@/types/supabase";

const schema = z.object({
  first_name: z.string().trim().min(1, "First name is required."),
  last_name: z.string().trim().min(1, "Last name is required."),
  phone: z.string().trim().min(7, "Phone number is required."),
  preferred_name: z.string().trim().optional().default(""),
  street: z.string().trim().min(1, "Street address is required."),
  city: z.string().trim().min(1, "City is required."),
  state: z.string().trim().min(2, "State is required."),
  zip: z.string().trim().min(3, "ZIP code is required."),
  emergency_name: z.string().trim().optional().default(""),
  emergency_phone: z.string().trim().optional().default(""),
  has_emergency_contact: z.string().trim().optional().default("no"),
  contact_method: z.string().trim().optional().default(""),
  timezone: z.string().trim().optional().default(""),
  avatar_url: z.string().trim().optional().default(""),
});

export type SaveAccountState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function saveAccount(
  _prev: SaveAccountState,
  formData: FormData,
): Promise<SaveAccountState> {
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

  // Build mailing_address jsonb with nested emergency_contact
  const mailingAddress: { [key: string]: Json | undefined } = {
    street: v.street,
    city: v.city,
    state: v.state.toUpperCase(),
    zip: v.zip,
  };

  if (v.has_emergency_contact === "yes" && (v.emergency_name || v.emergency_phone)) {
    mailingAddress.emergency_contact = {
      name: v.emergency_name || null,
      phone: v.emergency_phone || null,
    };
  } else {
    mailingAddress.emergency_contact = null;
  }

  const fullName = `${v.first_name} ${v.last_name}`;

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      phone: v.phone,
      mailing_address: mailingAddress,
      preferred_name: v.preferred_name || null,
      contact_method: v.contact_method || null,
      timezone: v.timezone || null,
      avatar_url: v.avatar_url || null,
    })
    .eq("id", user.id);

  if (error) return { error: error.message };

  // Geocode owner home address and store on contacts record.
  // Fire-and-forget: a geocoding failure must never break onboarding.
  (async () => {
    try {
      const point = await geocodeAddress(v.street, v.city, v.state, v.zip);
      if (!point) return;
      const svcForGeo = createServiceClient();
      await svcForGeo
        .from('contacts')
        .update({ home_lat: point.lat, home_lng: point.lng })
        .eq('profile_id', user.id);
    } catch {
      // Intentionally swallowed — geocoding is best-effort.
    }
  })();

  // Log activity (fire-and-forget)
  const svc = createServiceClient();
  svc.from("activity_log").insert({
    action: "profile_updated",
    entity_type: "profile",
    entity_id: user.id,
    actor_id: user.id,
    metadata: {
      field_name: "account",
      description: "Account details updated during setup",
    },
  }).then(() => {}, () => {});

  void logTimelineEvent({
    ownerId: user.id,
    eventType: "onboarding_step",
    category: "account",
    title: "Completed onboarding: Account details",
    visibility: "admin_only",
    metadata: { step: "account" },
  });

  await recordVersion(supabase, {
    userId: user.id,
    stepKey: "account",
    data: {
      first_name: v.first_name,
      last_name: v.last_name,
      full_name: fullName,
      phone: v.phone,
      preferred_name: v.preferred_name,
      contact_method: v.contact_method,
      timezone: v.timezone,
      mailing_address: mailingAddress,
    },
  });

  revalidatePath("/workspace/setup");
  redirect("/workspace/setup?just=account");
}
