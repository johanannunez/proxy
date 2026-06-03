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
});

export type AcknowledgeState = {
  error?: string;
};

export async function acknowledgeAgreement(
  _prev: AcknowledgeState,
  formData: FormData,
): Promise<AcknowledgeState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = schema.safeParse(raw);

  if (!parsed.success) {
    return { error: "Property ID is missing." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const v = parsed.data;
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("properties")
    .update({ agreement_acknowledged_at: now })
    .eq("id", v.property_id)
    .eq("owner_id", user.id);

  if (error) return { error: error.message };

  // Log activity (fire-and-forget)
  const svc = createServiceClient();
  svc.from("activity_log").insert({
    action: "agreement_acknowledged",
    entity_type: "property",
    entity_id: v.property_id,
    actor_id: user.id,
    metadata: {
      acknowledged_at: now,
      description: "Host agreement acknowledged",
    },
  }).then(() => {}, () => {});

  void logTimelineEvent({
    ownerId: user.id,
    eventType: "onboarding_step",
    category: "account",
    title: "Completed onboarding: Management agreement review",
    propertyId: v.property_id,
    visibility: "admin_only",
    metadata: { step: "agreement-preview" },
  });

  await recordVersion(supabase, {
    userId: user.id,
    propertyId: v.property_id,
    stepKey: "agreement-preview",
    data: { agreement_acknowledged_at: now },
  });

  revalidatePath("/workspace/setup");
  redirect(`/workspace/setup?just=agreement-preview&property=${v.property_id}`);
}
