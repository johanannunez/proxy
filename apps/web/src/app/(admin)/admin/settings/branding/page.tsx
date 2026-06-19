import type { Metadata } from "next";
import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/service";
import { untypedDatabase } from "@/lib/supabase/untyped";
import { DEFAULT_AGENCY_ID, type AgencyBranding } from "@/types/agencies";
import { BrandingSettings } from "./BrandingSettings";

export const metadata: Metadata = {
  title: "Branding | Proxy",
};

export const dynamic = "force-dynamic";

export default async function BrandingSettingsPage() {
  const headerList = await headers();
  const orgId = headerList.get("x-org-id") ?? DEFAULT_AGENCY_ID;
  const planTier = headerList.get("x-org-plan") ?? "starter";

  const service = createServiceClient();
  const { data: branding } = await untypedDatabase(service)
    .from<AgencyBranding>("organization_branding")
    .select("*")
    .eq("agency_id", orgId)
    .maybeSingle();

  return (
    <BrandingSettings
      branding={branding}
      isWhiteLabel={planTier === "white_label"}
    />
  );
}
