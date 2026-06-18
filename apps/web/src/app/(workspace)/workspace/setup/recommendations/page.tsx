import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { StepShell } from "@/components/workspace/setup/StepShell";
import { RecommendationsForm } from "./RecommendationsForm";
import { getPropertyForm } from "@/lib/workspace/property-forms";

export const metadata: Metadata = { title: "Local Recommendations" };
export const dynamic = "force-dynamic";

export default async function RecommendationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ property?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const params = await searchParams;
  const propertyId = params?.property ?? null;

  let lastUpdated: string | null = null;
  let saved: Record<string, unknown> = {};

  if (propertyId) {
    const formRow = await getPropertyForm(propertyId, "guidebook");
    if (formRow?.data) saved = formRow.data as Record<string, unknown>;
    if (formRow?.updated_at) lastUpdated = formRow.updated_at;
  }

  return (
    <StepShell
      track="property"
      stepNumber={9}
      title="Local recommendations"
      whyWeAsk="Your guidebook is one of the most-read parts of your listing. Great local recommendations help guests feel at home and earn you better reviews."
      estimateMinutes={5}
      lastUpdated={lastUpdated}
    >
      <RecommendationsForm
        propertyId={propertyId ?? ""}
        initial={saved}
        isEditing={Object.keys(saved).length > 0}
      />
    </StepShell>
  );
}
