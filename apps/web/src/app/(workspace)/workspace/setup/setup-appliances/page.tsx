import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { untypedDatabase } from "@/lib/supabase/untyped";
import { StepShell } from "@/components/workspace/setup/StepShell";
import { AppliancesForm } from "./AppliancesForm";

export const metadata: Metadata = { title: "Appliances" };
export const dynamic = "force-dynamic";

export default async function SetupAppliancesPage({
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

    const { data: formRow } = await untypedDatabase(supabase)
      .from<{ data: Record<string, unknown> | null; completed_at: string | null; updated_at: string | null }>("property_forms")
      .select("data, completed_at, updated_at")
      .eq("property_id", propertyId)
      .eq("form_key", "setup_appliances")
      .maybeSingle();
    if (formRow?.data) saved = formRow.data as Record<string, unknown>;
    if (formRow?.updated_at) propertyUpdatedAt = formRow.updated_at;
  }

  return (
    <StepShell
      track="property"
      stepNumber={19}
      title="Appliances"
      whyWeAsk="Accurate appliance info helps us train cleaners and answer guest questions about the property."
      estimateMinutes={4}
      lastUpdated={propertyUpdatedAt}
    >
      <AppliancesForm
        propertyId={propertyId ?? ""}
        initial={saved}
        isEditing={Object.keys(saved).length > 0}
      />
    </StepShell>
  );
}
