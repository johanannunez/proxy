import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  listDocumentTemplates,
  listTemplateSendCounts,
} from "@/lib/admin/document-templates";
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

/**
 * Templates tab — signature/PDF masters plus the Proxy library
 * (2026-06-12 IA amendment). Form masters live on the Forms tab; old
 * ?type=form links land there.
 */
export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  if (params.type === "form") {
    redirect("/admin/paperwork/forms");
  }

  const headerList = await headers();
  const orgId = headerList.get("x-org-id") ?? PROXY_ORG_ID;

  const [signatureTemplates, sendCounts, owners] = await Promise.all([
    listDocumentTemplates(),
    listTemplateSendCounts(),
    fetchDocumentsHubData(),
  ]);

  // First-page preview images from DocuSeal (small leading thumbnails).
  const previewUrls = await Promise.all(
    signatureTemplates.map((t) =>
      t.docuseal_template_id ? getTemplatePreviewUrl(t.docuseal_template_id) : null,
    ),
  );

  const unified: UnifiedTemplate[] = signatureTemplates.map(
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
  );

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
