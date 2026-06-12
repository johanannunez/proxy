import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import {
  getForm,
  listFormResponsesDetailed,
  getFormViewCount,
} from "@/lib/admin/forms";
import { getDocumentTemplate } from "@/lib/admin/document-templates";
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
      <PaperworkShell active="templates" orgId={orgId}>
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

  const initialTab = tab === "settings" ? "settings" : "fields";
  return (
    <PaperworkShell active="templates" orgId={orgId}>
      <SignatureTemplateDetail template={template} initialTab={initialTab} />
    </PaperworkShell>
  );
}
