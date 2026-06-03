import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { StepShell } from "@/components/workspace/setup/StepShell";
import { InsuranceCertificateForm } from "./InsuranceCertificateForm";

export const metadata: Metadata = { title: "Insurance Certificate" };
export const dynamic = "force-dynamic";

export default async function InsuranceCertificatePage({
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
      .eq("form_key", "insurance_certificate")
      .maybeSingle();
    if (formRow?.data) saved = formRow.data as Record<string, unknown>;
    if (formRow?.updated_at) lastUpdated = formRow.updated_at;
  }

  return (
    <StepShell
      track="property"
      stepNumber={28}
      title="Insurance certificate"
      whyWeAsk="Your management agreement requires active short-term rental or homeowners insurance. We keep this on file so we can respond quickly if a claim comes up."
      estimateMinutes={3}
      lastUpdated={lastUpdated}
    >
      <InsuranceCertificateForm
        propertyId={propertyId ?? ""}
        initial={saved}
        isEditing={Object.keys(saved).length > 0}
      />
    </StepShell>
  );
}
