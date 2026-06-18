import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { StepShell } from "@/components/workspace/setup/StepShell";
import { RulesForm } from "./RulesForm";

export const metadata: Metadata = { title: "House Rules and Access" };
export const dynamic = "force-dynamic";

type HouseRules = {
  pets?: string;
  pets_note?: string;
  smoking?: string;
  events?: string;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  check_in_time?: string;
  check_out_time?: string;
  additional_rules?: string;
  backup_key_location?: string;
  lockbox_code?: string;
  gate_code?: string;
  access_instructions?: string;
};

export default async function RulesPage({
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
      .select("id, house_rules, updated_at")
      .eq("id", propertyId)
      .single();
    property = data;
  }

  const rules = (property?.house_rules as HouseRules | null) ?? {};

  return (
    <StepShell
      track="property"
      stepNumber={6}
      title="House rules and access"
      whyWeAsk="Clear rules prevent misunderstandings and protect your property. Access instructions help us coordinate smooth check-ins."
      estimateMinutes={4}
      lastUpdated={property?.updated_at}
    >
      <RulesForm
        propertyId={property?.id ?? ""}
        initial={rules}
        isEditing={Boolean(rules.pets || rules.check_in_time)}
      />
    </StepShell>
  );
}
