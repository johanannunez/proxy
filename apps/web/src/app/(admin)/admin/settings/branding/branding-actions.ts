"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { untypedDatabase } from "@/lib/supabase/untyped";
import { createClient } from "@/lib/supabase/server";
import { PROXY_ORG_ID } from "@/types/organizations";
import { pushBrandingToDocuSeal } from "@/lib/signing/docuseal-branding";

export type BrandingActionResult = { success: true } | { success: false; error: string };

async function requireBrandingAccess(orgId: string): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "You need to be signed in.";

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role === "admin") return null;

  const service = createServiceClient();
  const { data: membership } = await untypedDatabase(service)
    .from<{ role: string }>("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("profile_id", user.id)
    .maybeSingle();

  if (membership && ["org_owner", "org_admin"].includes(membership.role)) {
    return null;
  }
  return "You do not have permission to manage branding for this workspace.";
}

export async function saveBrandingSettings(
  logoUrl: string | null,
  primaryColor: string,
  accentColor: string,
  customDomain: string | null,
): Promise<BrandingActionResult> {
  const headerList = await headers();
  const orgId = headerList.get("x-org-id") ?? PROXY_ORG_ID;

  const denied = await requireBrandingAccess(orgId);
  if (denied) return { success: false, error: denied };

  const service = createServiceClient();
  const db = untypedDatabase(service);

  const { error } = await db
    .from<{ org_id: string }>("organization_branding")
    .upsert(
      {
        org_id: orgId,
        logo_url: logoUrl ?? null,
        primary_color: primaryColor,
        accent_color: accentColor,
        custom_domain: customDomain ?? null,
      },
      { onConflict: "org_id" },
    );

  if (error) {
    console.error("[branding] upsert failed:", error);
    return { success: false, error: "Failed to save branding. Please try again." };
  }

  // Push logo and primary color to DocuSeal so signing pages inherit the org's
  // brand. Errors are swallowed in pushBrandingToDocuSeal — never block the save.
  await pushBrandingToDocuSeal(logoUrl, primaryColor);

  revalidatePath("/admin/settings/branding");
  return { success: true };
}
