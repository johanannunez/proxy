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
  red_line_income: z.string().trim().optional().default(""),
  desired_income: z.string().trim().optional().default(""),
  target_launch_date: z.string().trim().optional().default(""),
  furnishing_needs: z.string().trim().optional().default(""),
  furnishing_budget: z.string().trim().optional().default(""),
  financially_ready: z.string().trim().optional().default(""),
});

export type SaveFinancialState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function saveFinancial(
  _prev: SaveFinancialState,
  formData: FormData,
): Promise<SaveFinancialState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = schema.safeParse(raw);

  if (!parsed.success) {
    return { error: "Something went wrong. Please try again." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const v = parsed.data;
  const financialBaseline = {
    red_line_income: v.red_line_income ? Number(v.red_line_income) : null,
    desired_income: v.desired_income ? Number(v.desired_income) : null,
    target_launch_date: v.target_launch_date || null,
    furnishing_needs: v.furnishing_needs || null,
    furnishing_budget: v.furnishing_budget ? Number(v.furnishing_budget) : null,
    financially_ready: v.financially_ready || null,
  };

  const { error } = await supabase
    .from("properties")
    .update({ financial_baseline: financialBaseline })
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
      field_name: "financial",
      description: "Financial baseline updated",
    },
  }).then(() => {}, () => {});

  void logTimelineEvent({
    ownerId: user.id,
    eventType: "onboarding_step",
    category: "account",
    title: "Completed onboarding: Financial goals",
    propertyId: v.property_id,
    visibility: "admin_only",
    metadata: { step: "financial" },
  });

  await recordVersion(supabase, {
    userId: user.id,
    propertyId: v.property_id,
    stepKey: "financial",
    data: financialBaseline as Record<string, unknown>,
  });

  revalidatePath("/workspace/setup");
  redirect(`/workspace/setup?just=financial&property=${v.property_id}`);
}
