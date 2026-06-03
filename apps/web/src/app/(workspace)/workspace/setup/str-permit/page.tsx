import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { StepShell } from "@/components/workspace/setup/StepShell";
import { StrPermitForm } from "./StrPermitForm";

export const metadata: Metadata = { title: "STR Permit" };
export const dynamic = "force-dynamic";

export default async function StrPermitPage({
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

  let lastUpdated: string | null = null;
  let saved: Record<string, unknown> = {};

  if (propertyId) {
    const { data: formRow } = await (supabase as any)
      .from("property_forms")
      .select("data, completed_at, updated_at")
      .eq("property_id", propertyId)
      .eq("form_key", "str_permit")
      .maybeSingle();
    if (formRow?.data) saved = formRow.data as Record<string, unknown>;
    if (formRow?.updated_at) lastUpdated = formRow.updated_at;
  }

  return (
    <StepShell
      track="property"
      stepNumber={26}
      title="STR permit"
      whyWeAsk="A short-term rental permit is required in most markets. We need the permit number and expiration date to display on your listing and stay compliant."
      estimateMinutes={3}
      lastUpdated={lastUpdated}
    >
      <StrPermitForm
        propertyId={propertyId ?? ""}
        initial={saved}
        isEditing={Object.keys(saved).length > 0}
      />
    </StepShell>
  );
}
