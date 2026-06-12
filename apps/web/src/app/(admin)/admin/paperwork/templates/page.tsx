import type { Metadata } from "next";
import { headers } from "next/headers";
import {
  listDocumentTemplates,
  listTemplateSendCounts,
} from "@/lib/admin/document-templates";
import { listForms } from "@/lib/admin/forms";
import { fetchDocumentsHubData } from "@/lib/admin/documents-hub";
import { getTemplatePreviewUrl } from "@/lib/signing/docuseal";
import { SECURE_DOC_TYPES, type SecureDocKey } from "@/lib/admin/documents-hub-shared";
import { PROXY_ORG_ID } from "@/types/organizations";
import { PaperworkShell } from "../PaperworkShell";
import { TemplatesTab } from "./TemplatesTab";
import type { SendRecipient, UnifiedTemplate } from "./unified-types";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Paperwork · Templates" };
export const dynamic = "force-dynamic";

const secureKeys = Object.keys(SECURE_DOC_TYPES) as SecureDocKey[];

export default async function TemplatesPage() {
  const headerList = await headers();
  const orgId = headerList.get("x-org-id") ?? PROXY_ORG_ID;

  const [signatureTemplates, forms, sendCounts, owners] = await Promise.all([
    listDocumentTemplates(),
    listForms(orgId),
    listTemplateSendCounts(),
    fetchDocumentsHubData(),
  ]);

  // First-page preview images from DocuSeal (real thumbnails on cards).
  const previewUrls = await Promise.all(
    signatureTemplates.map((t) =>
      t.docuseal_template_id ? getTemplatePreviewUrl(t.docuseal_template_id) : null,
    ),
  );

  const unified: UnifiedTemplate[] = [
    ...signatureTemplates.map(
      (t, i): UnifiedTemplate => ({
        id: t.id,
        kind: "signature",
        name: t.display_name,
        description: t.description,
        isSystem: t.is_system,
        isReady: t.docuseal_template_id !== null && t.is_active,
        documentKey: t.document_key,
        docusealTemplateId: t.docuseal_template_id,
        signerRoles: t.signer_roles,
        previewImageUrl: previewUrls[i],
        sentCount: sendCounts[t.document_key] ?? 0,
        responseCount: 0,
        fieldCount: 0,
        previewFields: [],
        slug: null,
        isPublic: false,
      }),
    ),
    ...forms.map(
      (f): UnifiedTemplate => ({
        id: f.id,
        kind: "form",
        name: f.name,
        description: f.description,
        isSystem: false,
        isReady: f.is_active,
        documentKey: null,
        docusealTemplateId: null,
        signerRoles: [],
        previewImageUrl: null,
        sentCount: 0,
        responseCount: f.response_count,
        fieldCount: f.schema.fields.length,
        previewFields: f.schema.fields
          .slice(0, 6)
          .map((field) => ({ label: field.label, type: field.type })),
        slug: f.slug,
        isPublic: f.is_public,
      }),
    ),
  ];

  const recipients: SendRecipient[] = owners
    .filter((o) => o.profileId !== null)
    .map((o) => ({
      profileId: o.profileId as string,
      name: o.fullName,
      email: o.email,
      avatarUrl: o.avatarUrl,
      propertyCount: o.propertyCount,
      activeDocumentKeys: secureKeys.filter(
        (k) => o.secureDocs[k].status !== "not_sent",
      ),
    }));

  return (
    <PaperworkShell active="templates" orgId={orgId}>
      <main className={styles.main}>
        <TemplatesTab templates={unified} recipients={recipients} />
      </main>
    </PaperworkShell>
  );
}
