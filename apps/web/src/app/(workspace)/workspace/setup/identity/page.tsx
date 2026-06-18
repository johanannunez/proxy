import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { StepShell } from "@/components/workspace/setup/StepShell";
import { IdentityForm } from "./IdentityForm";

export const metadata: Metadata = { title: "Identity Verification" };
export const dynamic = "force-dynamic";

export default async function IdentityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: kyc } = await supabase
    .from("owner_kyc")
    .select("legal_name, license_number, issuing_state, expiration_date, front_photo_url, back_photo_url, consent_given, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <StepShell
      track="owner"
      stepNumber={2}
      title="Identity verification"
      whyWeAsk="Verifying your identity protects both you and your guests. Required for compliance with short-term rental regulations."
      estimateMinutes={3}
      lastUpdated={kyc?.updated_at}
    >
      <IdentityForm
        initial={{
          legal_name: kyc?.legal_name ?? "",
          license_number: kyc?.license_number ?? "",
          issuing_state: kyc?.issuing_state ?? "",
          expiration_date: kyc?.expiration_date ?? "",
          front_photo_url: kyc?.front_photo_url ?? "",
          back_photo_url: kyc?.back_photo_url ?? "",
          consent_given: kyc?.consent_given ?? false,
        }}
        isEditing={Boolean(kyc?.legal_name)}
      />
    </StepShell>
  );
}
