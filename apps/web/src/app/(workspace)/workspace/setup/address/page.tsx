import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { StepShell } from "@/components/workspace/setup/StepShell";
import { AddressForm } from "./AddressForm";

export const metadata: Metadata = { title: "Address" };
export const dynamic = "force-dynamic";

export default async function AddressPage({
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
      .select("id, address_line1, address_line2, city, state, postal_code, updated_at")
      .eq("id", propertyId)
      .single();
    property = data;
  }

  return (
    <StepShell
      track="property"
      stepNumber={3}
      title="Address"
      whyWeAsk="Guests see your city until their reservation is confirmed. The full address is never public."
      estimateMinutes={2}
      lastUpdated={property?.updated_at}
    >
      <AddressForm
        initial={{
          property_id: property?.id ?? "",
          address_line1: property?.address_line1 ?? "",
          address_line2: property?.address_line2 ?? "",
          city: property?.city ?? "",
          state: property?.state ?? "",
          postal_code: property?.postal_code ?? "",
        }}
        isEditing={Boolean(property?.address_line1)}
      />
    </StepShell>
  );
}
