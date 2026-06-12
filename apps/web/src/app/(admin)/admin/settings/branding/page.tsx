import type { Metadata } from "next";
import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/service";
import { untypedDatabase } from "@/lib/supabase/untyped";
import { PROXY_ORG_ID, type OrganizationBranding } from "@/types/organizations";
import { BrandingSettings } from "./BrandingSettings";

export const metadata: Metadata = {
  title: "Branding | Proxy",
};

export const dynamic = "force-dynamic";

export default async function BrandingSettingsPage() {
  const headerList = await headers();
  const orgId = headerList.get("x-org-id") ?? PROXY_ORG_ID;
  const planTier = headerList.get("x-org-plan") ?? "starter";

  const service = createServiceClient();
  const { data: branding } = await untypedDatabase(service)
    .from<OrganizationBranding>("organization_branding")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();

  return (
    <BrandingSettings
      branding={branding}
      isWhiteLabel={planTier === "white_label"}
    />
  );
}
