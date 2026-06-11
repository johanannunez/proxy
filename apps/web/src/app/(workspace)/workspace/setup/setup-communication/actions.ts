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
  contact_text: z.string().optional().default(""),
  contact_call: z.string().optional().default(""),
  contact_email: z.string().optional().default(""),
  best_times: z.string().trim().max(500).optional().default(""),
  booking_notification_preference: z.string().trim().max(500).optional().default(""),
});

export type SaveSetupCommunicationState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function saveSetupCommunication(
  _prev: SaveSetupCommunicationState,
  formData: FormData,
): Promise<SaveSetupCommunicationState> {
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
  const { property_id: propertyId } = v;

  const preferred_contact_methods = [
    ...(v.contact_text === "yes" ? ["text"] : []),
    ...(v.contact_call === "yes" ? ["call"] : []),
    ...(v.contact_email === "yes" ? ["email"] : []),
  ].join(",");

  const data = {
    preferred_contact_methods: preferred_contact_methods || null,
    best_times: v.best_times || null,
    booking_notification_preference: v.booking_notification_preference || null,
  };

  const saveError = await upsertPropertyForm(propertyId, "setup_communication", data);

  if (saveError) return { error: saveError };

  const svc = createServiceClient();
  untypedDatabase(svc)
    .from("activity_log")
    .insert({
      action: "property_updated",
      entity_type: "property",
      entity_id: propertyId,
      actor_id: user.id,
      metadata: {
        field_name: "setup_communication",
        description: "Setup: communication preferences saved",
      },
    })
    .then(
      () => {},
      () => {},
    );

  revalidatePath("/workspace/setup");
  redirect(`/workspace/setup?just=property-setup&property=${propertyId}`);
}
