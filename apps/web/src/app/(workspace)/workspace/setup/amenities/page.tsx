import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { StepShell } from "@/components/workspace/setup/StepShell";
import { AmenitiesForm } from "./AmenitiesForm";
import type { AmenityDetails } from "@/lib/wizard/amenities";

export const metadata: Metadata = { title: "Amenities" };
export const dynamic = "force-dynamic";

export default async function AmenitiesPage({
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
      .select("id, amenities, updated_at")
      .eq("id", propertyId)
      .single();
    property = data;
  }

  // Handle both old format (string[]) and new format ({ selected, details })
  let savedAmenities: string[] = [];
  let savedDetails: AmenityDetails = {};

  if (property?.amenities) {
    if (Array.isArray(property.amenities)) {
      // Legacy: plain array of IDs
      savedAmenities = property.amenities as string[];
    } else if (
      typeof property.amenities === "object" &&
      property.amenities !== null
    ) {
      const data = property.amenities as {
        selected?: string[];
        details?: AmenityDetails;
      };
      savedAmenities = data.selected ?? [];
      savedDetails = data.details ?? {};
    }
  }

  return (
    <StepShell
      track="property"
      stepNumber={5}
      title="Amenities"
      whyWeAsk="Guests filter by amenities when searching. The more accurate your list, the better your search placement."
      estimateMinutes={5}
      lastUpdated={property?.updated_at}
    >
      <AmenitiesForm
        propertyId={property?.id ?? ""}
        savedAmenities={savedAmenities}
        savedDetails={savedDetails}
        isEditing={savedAmenities.length > 0}
      />
    </StepShell>
  );
}
