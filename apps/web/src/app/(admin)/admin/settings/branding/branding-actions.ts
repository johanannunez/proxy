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

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
// Hostname only: labels of letters/digits/hyphens separated by dots, at least
// one dot (a bare TLD or "localhost" is never a valid tenant domain).
const HOSTNAME = /^(?=.{4,253}$)([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

export async function saveBrandingSettings(
  logoUrl: string | null,
  primaryColor: string,
  accentColor: string,
  customDomain: string | null,
): Promise<BrandingActionResult> {
  const headerList = await headers();
  const orgId = headerList.get("x-org-id") ?? PROXY_ORG_ID;
  const planTier = headerList.get("x-org-plan") ?? "starter";

  const denied = await requireBrandingAccess(orgId);
  if (denied) return { success: false, error: denied };

  if (!HEX_COLOR.test(primaryColor) || !HEX_COLOR.test(accentColor)) {
    return { success: false, error: "Colors must be 6-digit hex values like #1b77be." };
  }

  // Custom domains are a white-label feature. The UI hides the field on lower
  // tiers, but the server is the enforcement point.
  const normalizedDomain = customDomain?.trim().toLowerCase() || null;
  if (normalizedDomain && planTier !== "white_label") {
    return { success: false, error: "Custom domains require the White-label plan." };
  }
  if (normalizedDomain && !HOSTNAME.test(normalizedDomain)) {
    return { success: false, error: "Enter a valid domain like docs.yourcompany.com." };
  }

  const service = createServiceClient();
  const db = untypedDatabase(service);

  if (normalizedDomain) {
    const { data: taken } = await db
      .from<{ org_id: string }>("organization_branding")
      .select("org_id")
      .eq("custom_domain", normalizedDomain)
      .neq("org_id", orgId)
      .maybeSingle();
    if (taken) {
      return { success: false, error: "That domain is already connected to another workspace." };
    }
  }

  const { error } = await db
    .from<{ org_id: string }>("organization_branding")
    .upsert(
      {
        org_id: orgId,
        logo_url: logoUrl ?? null,
        primary_color: primaryColor,
        accent_color: accentColor,
        custom_domain: normalizedDomain,
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
