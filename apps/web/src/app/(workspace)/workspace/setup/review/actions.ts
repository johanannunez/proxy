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

export type SubmitReviewState = {
  error?: string;
};

export async function submitForReview(
  _prev: SubmitReviewState,
  formData: FormData,
): Promise<SubmitReviewState> {
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

  const { error } = await supabase
    .from("properties")
    .update({ setup_status: "pending_review" })
    .eq("id", v.property_id)
    .eq("owner_id", user.id);

  if (error) return { error: error.message };

  // Log activity (fire-and-forget)
  const svc = createServiceClient();
  svc.from("activity_log").insert({
    action: "property_submitted_for_review",
    entity_type: "property",
    entity_id: v.property_id,
    actor_id: user.id,
    metadata: {
      description: "Property submitted for review",
    },
  }).then(() => {}, () => {});

  void logTimelineEvent({
    ownerId: user.id,
    eventType: "onboarding_complete",
    category: "account",
    title: "Onboarding complete",
    isPinned: true,
  });

  await recordVersion(supabase, {
    userId: user.id,
    propertyId: v.property_id,
    stepKey: "review",
    data: { setup_status: "pending_review", submitted_at: new Date().toISOString() },
  });

  revalidatePath("/workspace/setup");
  redirect(`/workspace/setup?just=review&property=${v.property_id}`);
}
