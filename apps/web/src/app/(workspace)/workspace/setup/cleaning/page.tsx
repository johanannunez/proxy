import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { StepShell } from "@/components/workspace/setup/StepShell";
import { CleaningForm } from "./CleaningForm";

export const metadata: Metadata = { title: "Your Cleaning Team" };
export const dynamic = "force-dynamic";

type CleaningTeam = {
  name?: string;
  phone?: string;
  email?: string;
  experience?: string;
  work_style?: string;
  emergency_ok?: string;
  available_days?: string[];
  cities_covered?: string;
  notes?: string;
  has_equipment?: boolean;
};

export default async function CleaningPage({
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

  let property = null;
  if (propertyId) {
    const { data } = await supabase
      .from("properties")
      .select("id, cleaning_choice, cleaning_team, updated_at")
      .eq("id", propertyId)
      .single();
    property = data;
  }

  const team = (property?.cleaning_team as CleaningTeam | null) ?? {};

  return (
    <StepShell
      track="property"
      stepNumber={10}
      title="Your cleaning team"
      whyWeAsk="Turnovers are the backbone of short-term rentals. We need to know if you have a cleaner or if we should handle it."
      estimateMinutes={3}
      lastUpdated={property?.updated_at}
    >
      <CleaningForm
        propertyId={property?.id ?? ""}
        initialChoice={(property?.cleaning_choice as "proxy" | "byoc" | null) ?? null}
        initialTeam={team}
        isEditing={Boolean(property?.cleaning_choice)}
      />
    </StepShell>
  );
}
