import type { Metadata } from "next";
import { headers } from "next/headers";
import {
  listDocumentTemplates,
  listTemplateSendCounts,
} from "@/lib/admin/document-templates";
import { fetchDocumentsHubData } from "@/lib/admin/documents-hub";
import { fetchActionQueue } from "@/lib/admin/action-queue";
import { getTemplatePreviewUrl } from "@/lib/signing/docuseal";
import { SECURE_DOC_TYPES, type SecureDocKey } from "@/lib/admin/documents-hub-shared";
import { PROXY_ORG_ID } from "@/types/organizations";
import { PaperworkShell } from "../PaperworkShell";
import { SignaturesHub } from "./SignaturesHub";
import type { SendRecipient, UnifiedTemplate } from "../templates/unified-types";

export const metadata: Metadata = { title: "Paperwork · Signatures" };
export const dynamic = "force-dynamic";

const secureKeys = Object.keys(SECURE_DOC_TYPES) as SecureDocKey[];

/**
 * Signatures tab (was Documents) — 2026-06-14 redesign. Two jobs in one tab:
 * a per-owner management list of sent signatures (each opens the DocumentDrawer
 * for audit trail, resend, remind, certificate) and a reusable signature
 * Library. Form masters live on the Forms tab; the templates/[id] master-detail
 * route stays shared infra.
 */
export default async function SignaturesPage() {
  const headerList = await headers();
  const orgId = headerList.get("x-org-id") ?? PROXY_ORG_ID;

  const [signatureTemplates, sendCounts, owners, actionQueue] = await Promise.all([
    listDocumentTemplates(),
    listTemplateSendCounts(),
    fetchDocumentsHubData(),
    fetchActionQueue(),
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
    <PaperworkShell active="signatures" orgId={orgId} actionCount={actionQueue.length}>
      <SignaturesHub owners={owners} templates={unified} recipients={recipients} />
    </PaperworkShell>
  );
}
