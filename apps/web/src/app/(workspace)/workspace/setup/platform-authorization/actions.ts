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
  platform: z.string().trim().max(500).optional().default(""),
  account_email: z.string().trim().max(500).optional().default(""),
  access_type: z.string().trim().max(500).optional().default(""),
  invitation_sent: z.string().trim().max(500).optional().default(""),
  date_invited: z.string().trim().max(500).optional().default(""),
  access_level: z.string().trim().max(500).optional().default(""),
  notes: z.string().trim().max(2000).optional().default(""),
});

export type SavePlatformAuthorizationState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function savePlatformAuthorization(
  _prev: SavePlatformAuthorizationState,
  formData: FormData,
): Promise<SavePlatformAuthorizationState> {
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

  const saveError = await upsertPropertyForm(v.property_id, "platform_authorization", {
          platforms: [
            {
              platform: v.platform,
              account_email: v.account_email,
              access_type: v.access_type,
              invitation_sent: v.invitation_sent,
              date_invited: v.date_invited,
              access_level: v.access_level,
              notes: v.notes,
            },
          ],
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
      metadata: {
        field_name: "platform_authorization",
        description: "Platform authorization saved",
      },
    })
    .then(
      () => {},
      () => {},
    );

  revalidatePath("/workspace/setup");
  redirect(`/workspace/setup?just=compliance&property=${v.property_id}`);
}
