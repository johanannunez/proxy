import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import {
  getForm,
  listFormResponsesDetailed,
  getFormViewCount,
} from "@/lib/admin/forms";
import { getDocumentTemplate, templateHasBeenSent } from "@/lib/admin/document-templates";
import { getTemplateFields } from "@/lib/signing/docuseal";
import { computeCoverage } from "@/lib/signing/field-coverage";
import { PROXY_ORG_ID } from "@/types/organizations";
import { PaperworkShell } from "../../PaperworkShell";
import { FormTemplateDetail } from "./FormTemplateDetail";
import { SignatureTemplateDetail } from "./SignatureTemplateDetail";

export const metadata: Metadata = { title: "Paperwork · Template" };
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
};

/**
 * Template detail: one id namespace across both kinds. Forms and signature
 * templates live in different tables with uuid primary keys, so an id resolves
 * to exactly one of them.
 */
export default async function TemplateDetailPage({ params, searchParams }: Props) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  const headerList = await headers();
  const orgId = headerList.get("x-org-id") ?? PROXY_ORG_ID;

  const form = await getForm(id);

  if (form) {
    const [responses, viewCount] = await Promise.all([
      listFormResponsesDetailed(id),
      getFormViewCount(id),
    ]);
    const initialTab =
      tab === "responses" ? "responses" : tab === "settings" ? "settings" : "build";
    return (
      <PaperworkShell active="forms" orgId={orgId}>
        <FormTemplateDetail
          form={form}
          responses={responses}
          viewCount={viewCount}
          initialTab={initialTab}
        />
      </PaperworkShell>
    );
  }

  const template = await getDocumentTemplate(id);
  if (!template) notFound();

  // Coverage drives the Settings status pill. Only meaningful when a DocuSeal
  // layout exists; null means "unknown" so the UI falls back to is_active.
  // getTemplateFields is crash-safe, so a DocuSeal outage degrades to [] (which
  // self-heals on the next render since this page is force-dynamic).
  let missingRoles: string[] | null = null;
  if (template.docuseal_template_id) {
    const fields = await getTemplateFields(template.docuseal_template_id);
    missingRoles = computeCoverage(fields, template.signer_roles).missingRoles;
  }

  // Whether any document has been sent under this key. Drives the lock on the
  // document key and signer-role editors in Settings.
  const hasBeenSent = await templateHasBeenSent(template.document_key);

  // ?tab=write is only valid for HTML-authored templates (source_html non-null);
  // PDF templates fall through to the Fields tab.
  const initialTab =
    tab === "write" && template.source_html !== null
      ? "write"
      : tab === "settings"
        ? "settings"
        : "fields";
  return (
    <PaperworkShell active="signatures" orgId={orgId}>
      <SignatureTemplateDetail
        template={template}
        initialTab={initialTab}
        missingRoles={missingRoles}
        hasBeenSent={hasBeenSent}
      />
    </PaperworkShell>
  );
}
