import type { Metadata } from "next";
import { headers } from "next/headers";
import { listForms, listAllFormResponsesForOrg } from "@/lib/admin/forms";
import { listDocumentTemplates } from "@/lib/admin/document-templates";
import { fetchDocumentsHubData } from "@/lib/admin/documents-hub";
import { SECURE_DOC_TYPES, type SecureDocKey } from "@/lib/admin/documents-hub-shared";
import { PROXY_ORG_ID } from "@/types/organizations";
import { PaperworkShell } from "../PaperworkShell";
import { FormsTab } from "./FormsTab";
import type { SendRecipient } from "../templates/unified-types";

export const metadata: Metadata = { title: "Paperwork · Forms" };
export const dynamic = "force-dynamic";

const secureKeys = Object.keys(SECURE_DOC_TYPES) as SecureDocKey[];

/**
 * Forms tab: form-master library (Library sub-tab) and cross-form response
 * feed (Activity sub-tab). The three data fetches run in parallel.
 */
export default async function FormsPage() {
  const headerList = await headers();
  const orgId = headerList.get("x-org-id") ?? PROXY_ORG_ID;

  const [forms, systemTemplates, owners, responses] = await Promise.all([
    listForms(orgId),
    listDocumentTemplates(),
    fetchDocumentsHubData(),
    listAllFormResponsesForOrg(orgId, 100),
  ]);

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

  const library = systemTemplates
    .filter((t) => t.is_system)
    .map((t) => ({
      id: t.id,
      name: t.display_name,
      description: t.description,
    }));

  return (
    <PaperworkShell active="forms" orgId={orgId}>
      <FormsTab
        forms={forms}
        recipients={recipients}
        library={library}
        responses={responses}
      />
    </PaperworkShell>
  );
}
