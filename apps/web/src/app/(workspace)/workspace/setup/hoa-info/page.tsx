import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { StepShell } from "@/components/workspace/setup/StepShell";
import { HoaInfoForm } from "./HoaInfoForm";
import { getPropertyForm } from "@/lib/workspace/property-forms";

export const metadata: Metadata = { title: "HOA Information" };
export const dynamic = "force-dynamic";

export default async function HoaInfoPage({
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
    const formRow = await getPropertyForm(propertyId, "hoa_info");
    if (formRow?.data) saved = formRow.data as Record<string, unknown>;
    if (formRow?.updated_at) lastUpdated = formRow.updated_at;
  }

  return (
    <StepShell
      track="property"
      stepNumber={27}
      title="HOA information"
      whyWeAsk="If your property has an HOA, we need to confirm that short-term rentals are permitted and get emergency contact info."
      estimateMinutes={3}
      lastUpdated={lastUpdated}
    >
      <HoaInfoForm
        propertyId={propertyId ?? ""}
        initial={saved}
        isEditing={Object.keys(saved).length > 0}
      />
    </StepShell>
  );
}
