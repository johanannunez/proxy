import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { StepShell } from "@/components/workspace/setup/StepShell";
import { PayoutForm } from "./PayoutForm";

export const metadata: Metadata = { title: "Payout Method" };
export const dynamic = "force-dynamic";

export default async function PayoutPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  return (
    <StepShell
      track="owner"
      stepNumber={4}
      title="Payout method"
      whyWeAsk="Tell us where to send your earnings. Choose ACH direct deposit or card authorization."
      estimateMinutes={5}
    >
      <PayoutForm
        userEmail={profile?.email ?? user.email ?? ""}
        userName={profile?.full_name ?? ""}
        hasBoldSignKey={Boolean(process.env.BOLDSIGN_API_KEY)}
      />
    </StepShell>
  );
}
