import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { StepShell } from "@/components/workspace/setup/StepShell";
import { PhotosForm } from "./PhotosForm";

export const metadata: Metadata = { title: "Photos" };
export const dynamic = "force-dynamic";

type PhotoEntry = {
  url: string;
  isPrimary: boolean;
};

export default async function PhotosPage({
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
      .select("id, photos, updated_at")
      .eq("id", propertyId)
      .single();
    property = data;
  }

  const savedPhotos =
    property?.photos && Array.isArray(property.photos)
      ? (property.photos as PhotoEntry[])
      : [];

  return (
    <StepShell
      track="property"
      stepNumber={11}
      title="Photos"
      whyWeAsk="Great photos are the single biggest factor in booking conversions. Upload your best shots or we can arrange professional photography."
      estimateMinutes={5}
      lastUpdated={property?.updated_at}
    >
      <PhotosForm
        propertyId={property?.id ?? ""}
        userId={user.id}
        savedPhotos={savedPhotos}
        isEditing={savedPhotos.length > 0}
      />
    </StepShell>
  );
}
