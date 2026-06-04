import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { untypedDatabase } from "@/lib/supabase/untyped";
import { StepShell } from "@/components/workspace/setup/StepShell";
import { PlatformAuthorizationForm } from "./PlatformAuthorizationForm";

export const metadata: Metadata = { title: "Platform Authorization" };
export const dynamic = "force-dynamic";

export default async function PlatformAuthorizationPage({
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
    const { data: formRow } = await untypedDatabase(supabase)
      .from<{ data: Record<string, unknown> | null; completed_at: string | null; updated_at: string | null }>("property_forms")
      .select("data, completed_at, updated_at")
      .eq("property_id", propertyId)
      .eq("form_key", "platform_authorization")
      .maybeSingle();
    if (formRow?.data) saved = formRow.data as Record<string, unknown>;
    if (formRow?.updated_at) lastUpdated = formRow.updated_at;
  }

  // Extract first platform entry if it exists
  const platforms = saved.platforms as Array<Record<string, unknown>> | undefined;
  const firstPlatform: Record<string, unknown> = platforms?.[0] ?? {};

  return (
    <StepShell
      track="property"
      stepNumber={29}
      title="Platform authorization"
      whyWeAsk="We need co-host access or login credentials for each platform where your property is listed so we can manage bookings, pricing, and guest communication."
      estimateMinutes={4}
      lastUpdated={lastUpdated}
    >
      <PlatformAuthorizationForm
        propertyId={propertyId ?? ""}
        initial={firstPlatform}
        isEditing={Object.keys(firstPlatform).length > 0}
      />
    </StepShell>
  );
}
