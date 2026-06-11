import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { StepShell } from "@/components/workspace/setup/StepShell";
import { SecurityForm } from "./SecurityForm";
import { getPropertyForm } from "@/lib/workspace/property-forms";

export const metadata: Metadata = { title: "Security System" };
export const dynamic = "force-dynamic";

export default async function SetupSecurityPage({
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

    const formRow = await getPropertyForm(propertyId, "setup_security");
    if (formRow?.data) saved = formRow.data as Record<string, unknown>;
    if (formRow?.updated_at) propertyUpdatedAt = formRow.updated_at;
  }

  return (
    <StepShell
      track="property"
      stepNumber={17}
      title="Security system"
      whyWeAsk="Our team needs to arm and disarm the system between stays. Guests need to know if there are sensors."
      estimateMinutes={3}
      lastUpdated={propertyUpdatedAt}
    >
      <SecurityForm
        propertyId={propertyId ?? ""}
        initial={saved}
        isEditing={Object.keys(saved).length > 0}
      />
    </StepShell>
  );
}
