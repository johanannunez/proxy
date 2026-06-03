import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { StepShell } from "@/components/workspace/setup/StepShell";
import { AccountForm } from "./AccountForm";

export const metadata: Metadata = { title: "Your Account" };
export const dynamic = "force-dynamic";

type MailingAddress = {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  emergency_contact?: { name?: string; phone?: string };
};

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "full_name, updated_at, avatar_url, preferred_name, contact_method, timezone, referral_source, mailing_address, phone",
    )
    .eq("id", user.id)
    .single();

  const isEditing = Boolean(profile?.full_name);
  const addr = profile?.mailing_address as MailingAddress | null;

  return (
    <StepShell
      track="owner"
      stepNumber={1}
      title="Your account"
      whyWeAsk="We need your name, phone, and mailing address to send payouts, tax documents, and any important mail."
      estimateMinutes={3}
      lastUpdated={isEditing ? profile?.updated_at : null}
    >
      <AccountForm
        initial={{
          first_name: profile?.full_name?.split(" ")[0] ?? "",
          last_name: profile?.full_name?.split(" ").slice(1).join(" ") ?? "",
          preferred_name: profile?.preferred_name ?? "",
          phone: profile?.phone ?? "",
          avatar_url: profile?.avatar_url ?? "",
          contact_method: profile?.contact_method ?? "",
          timezone: profile?.timezone ?? "",
          referral_source: "",
          mailing_address: addr ?? null,
        }}
        email={user.email ?? ""}
        userId={user.id}
        isEditing={isEditing}
      />
    </StepShell>
  );
}
