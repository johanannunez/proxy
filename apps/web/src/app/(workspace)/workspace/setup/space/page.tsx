import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { StepShell } from "@/components/workspace/setup/StepShell";
import { SpaceForm } from "./SpaceForm";

export const metadata: Metadata = { title: "Space and Capacity" };
export const dynamic = "force-dynamic";

export default async function SpacePage({
  searchParams,
}: {
  searchParams?: Promise<{ property?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const params = await searchParams;
  const propertyId = params?.property ?? null;

  let property = null;
  if (propertyId) {
    const { data } = await supabase
      .from("properties")
      .select("id, bedrooms, bathrooms, half_bathrooms, guest_capacity, square_feet, bed_arrangements, updated_at")
      .eq("id", propertyId)
      .single();
    property = data;
  }

  return (
    <StepShell
      track="property"
      stepNumber={4}
      title="Space and capacity"
      whyWeAsk="These numbers show on every listing and help guests decide if your home is the right fit."
      estimateMinutes={4}
      lastUpdated={property?.updated_at}
    >
      <SpaceForm
        initial={{
          property_id: property?.id ?? "",
          bedrooms: property?.bedrooms?.toString() ?? "",
          bathrooms: property?.bathrooms?.toString() ?? "",
          guest_capacity: property?.guest_capacity?.toString() ?? "",
          square_feet: property?.square_feet?.toString() ?? "",
          bed_arrangements: property?.bed_arrangements ?? null,
        }}
        isEditing={property?.bedrooms !== null && property?.bedrooms !== undefined}
      />
    </StepShell>
  );
}
