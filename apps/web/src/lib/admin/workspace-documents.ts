import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PropertyFormKey } from "@/lib/admin/documents-hub-shared";

export type WorkspaceDocument = {
  id: string;
  templateName: string;
  category: "legal" | "financial" | "property";
  status: string;
  signedAt: string | null;
  signedPdfUrl: string | null;
  propertyId: string | null;
  propertyLabel: string | null;
  createdAt: string;
};

function deriveCategory(templateName: string): WorkspaceDocument["category"] {
  const lower = templateName.toLowerCase();
  if (lower.includes("agreement") || lower.includes("addendum") || lower.includes("contract")) return "legal";
  if (lower.includes("w9") || lower.includes("w-9") || lower.includes("ach") || lower.includes("tax")) return "financial";
  return "property";
}

export async function fetchWorkspaceDocuments(profileId: string): Promise<WorkspaceDocument[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("signed_documents")
    .select(`
      id, template_name, status, signed_at, signed_pdf_url, property_id, created_at,
      property:properties(address_line1, city, state)
    `)
    .eq("user_id", profileId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[workspace-documents] fetch error:", error.message);
    return [];
  }

  return (data ?? []).map((row) => {
    const prop = row.property as { address_line1: string | null; city: string | null; state: string | null } | null;
    const propertyLabel = prop
      ? [prop.address_line1, prop.city, prop.state].filter(Boolean).join(", ")
      : null;
    return {
      id: row.id,
      templateName: row.template_name,
      category: deriveCategory(row.template_name),
      status: row.status,
      signedAt: row.signed_at,
      signedPdfUrl: row.signed_pdf_url,
      propertyId: row.property_id,
      propertyLabel,
      createdAt: row.created_at,
    };
  });
}

export type WorkspaceFormData = {
  /** Primary property whose forms are shown/edited (first property today). */
  propertyId: string | null;
  /** Owner profile id, needed for admin edit-on-behalf. */
  profileId: string;
  /** Full property_forms.data keyed by form_key for the primary property. */
  rawForms: Partial<Record<PropertyFormKey, Record<string, unknown>>>;
};

/**
 * Loads the property_forms answers for a workspace owner's primary property,
 * so the admin can view every question (filled or not) and edit on behalf.
 */
export async function fetchWorkspaceFormData(profileId: string): Promise<WorkspaceFormData> {
  const supabase = await createClient();

  const { data: props } = await supabase
    .from("properties")
    .select("id")
    .eq("owner_id", profileId)
    .order("created_at", { ascending: true })
    .limit(1);

  const propertyId = (props?.[0] as { id: string } | undefined)?.id ?? null;
  if (!propertyId) return { propertyId: null, profileId, rawForms: {} };

  // property_forms is not in the generated Supabase types yet.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: forms } = await (supabase as any)
    .from("property_forms")
    .select("form_key, data")
    .eq("property_id", propertyId);

  const rawForms: Partial<Record<string, Record<string, unknown>>> = {};
  for (const row of (forms ?? []) as Array<{ form_key: string; data: unknown }>) {
    rawForms[row.form_key] = (row.data as Record<string, unknown>) ?? {};
  }

  return { propertyId, profileId, rawForms: rawForms as WorkspaceFormData["rawForms"] };
}
