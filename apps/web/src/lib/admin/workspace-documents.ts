import "server-only";
import { createClient } from "@/lib/supabase/server";

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
  if (
    lower.includes("w9")
    || lower.includes("w-9")
    || lower.includes("ach")
    || lower.includes("tax")
    || lower.includes("card authorization")
    || lower.includes("credit card")
    || lower.includes("payment")
    || lower.includes("bank")
  ) {
    return "financial";
  }
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
