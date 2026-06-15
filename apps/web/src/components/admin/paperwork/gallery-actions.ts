"use server";

/**
 * Lazy data loader for the Template Gallery create modal. Returns lean DTOs so
 * the client modal can render template/form cards without pulling the heavy
 * DocuSeal/schema payloads. Admin-gated; reads the caller's org only.
 */

import { requireAdminUser } from "@/lib/admin/auth";
import { listDocumentTemplates } from "@/lib/admin/document-templates";
import { listForms } from "@/lib/admin/forms";

export type GallerySignature = {
  id: string;
  name: string;
  /** "yours" = an org override; "proxy" = a system/Proxy-library template. */
  group: "yours" | "proxy";
  /** Seed for the deterministic preview accent. */
  seed: string;
  category: string | null;
  isReady: boolean;
};

export type GalleryForm = {
  id: string;
  name: string;
  icon: string | null;
  iconColor: string | null;
  category: string | null;
  fieldCount: number;
  responseCount: number;
};

export type GalleryData = {
  signatures: GallerySignature[];
  forms: GalleryForm[];
};

export async function loadGalleryData(orgId: string): Promise<GalleryData> {
  await requireAdminUser();

  const [templates, forms] = await Promise.all([
    listDocumentTemplates(orgId),
    listForms(orgId),
  ]);

  const signatures: GallerySignature[] = templates.map((t) => ({
    id: t.id,
    name: t.title ?? t.display_name,
    group: t.org_id === null ? "proxy" : "yours",
    seed: t.document_key,
    category: t.category,
    isReady: t.docuseal_template_id !== null && t.is_active,
  }));

  const galleryForms: GalleryForm[] = forms
    .filter((f) => !f.archived_at)
    .map((f) => ({
      id: f.id,
      name: f.name,
      icon: f.icon,
      iconColor: f.icon_color,
      category: f.category,
      fieldCount: f.schema?.fields?.length ?? 0,
      responseCount: f.response_count,
    }));

  return { signatures, forms: galleryForms };
}
