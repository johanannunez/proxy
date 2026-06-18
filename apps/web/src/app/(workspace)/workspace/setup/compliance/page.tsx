import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { StepShell } from "@/components/workspace/setup/StepShell";
import { ComplianceForm } from "./ComplianceForm";

export const metadata: Metadata = { title: "Compliance" };
export const dynamic = "force-dynamic";

type ComplianceDetails = {
  needs_permit?: string;
  permit_number?: string;
  has_hoa?: string;
  hoa_approval?: string;
};

export default async function CompliancePage({
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
      .select("id, compliance_details, updated_at")
      .eq("id", propertyId)
      .single();
    property = data;
  }

  const compliance = (property?.compliance_details as ComplianceDetails | null) ?? {};

  return (
    <StepShell
      track="property"
      stepNumber={12}
      title="Compliance"
      whyWeAsk="Some cities require permits or HOA approval for short-term rentals. We need to know what applies to your property."
      estimateMinutes={3}
      lastUpdated={property?.updated_at}
    >
      <ComplianceForm
        propertyId={property?.id ?? ""}
        initial={compliance}
        isEditing={Boolean(compliance.needs_permit)}
      />
    </StepShell>
  );
}
