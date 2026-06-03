import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { StepShell } from "@/components/workspace/setup/StepShell";
import { UtilitiesForm } from "./UtilitiesForm";

export const metadata: Metadata = { title: "Utilities and Systems" };
export const dynamic = "force-dynamic";

export default async function SetupUtilitiesPage({
  searchParams,
}: {
  searchParams?: Promise<{ property?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const params = await searchParams;
  const propertyId = params?.property ?? null;

  let propertyUpdatedAt: string | null = null;
  let saved: Record<string, unknown> = {};

  if (propertyId) {
    const { data: prop } = await supabase
      .from("properties")
      .select("id, updated_at")
      .eq("id", propertyId)
      .maybeSingle();
    propertyUpdatedAt = prop?.updated_at ?? null;

    const { data: formRow } = await (supabase as any)
      .from("property_forms")
      .select("data, completed_at, updated_at")
      .eq("property_id", propertyId)
      .eq("form_key", "setup_utilities")
      .maybeSingle();
    if (formRow?.data) saved = formRow.data as Record<string, unknown>;
    if (formRow?.updated_at) propertyUpdatedAt = formRow.updated_at;
  }

  return (
    <StepShell
      track="property"
      stepNumber={18}
      title="Utilities and systems"
      whyWeAsk="Utility info lets us troubleshoot issues quickly and ensure safety items are in place for guests."
      estimateMinutes={6}
      lastUpdated={propertyUpdatedAt}
    >
      <UtilitiesForm
        propertyId={propertyId ?? ""}
        initial={saved}
        isEditing={Object.keys(saved).length > 0}
      />
    </StepShell>
  );
}
