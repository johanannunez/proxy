import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { StepShell } from "@/components/workspace/setup/StepShell";
import { FinancialForm } from "./FinancialForm";

export const metadata: Metadata = { title: "Financial Baseline" };
export const dynamic = "force-dynamic";

type FinancialBaseline = {
  red_line_income?: number | null;
  desired_income?: number | null;
  target_launch_date?: string | null;
  furnishing_needs?: string | null;
  furnishing_budget?: number | null;
  financially_ready?: string | null;
};

export default async function FinancialPage({
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
      .select("id, financial_baseline, updated_at")
      .eq("id", propertyId)
      .single();
    property = data;
  }

  const fb = (property?.financial_baseline as FinancialBaseline | null) ?? {};

  return (
    <StepShell
      track="property"
      stepNumber={8}
      title="Financial baseline"
      whyWeAsk="Understanding your income goals and readiness helps us set the right pricing strategy and timeline."
      estimateMinutes={3}
      lastUpdated={property?.updated_at}
    >
      <FinancialForm
        propertyId={property?.id ?? ""}
        initial={fb}
        isEditing={fb.red_line_income !== undefined && fb.red_line_income !== null}
      />
    </StepShell>
  );
}
