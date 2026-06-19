import type { Metadata } from "next";
import { headers } from "next/headers";
import { listForms, listAllFormResponsesForOrg } from "@/lib/admin/forms";
import { listDocumentTemplates } from "@/lib/admin/document-templates";
import { fetchActionQueue } from "@/lib/admin/action-queue";
import { fetchDocumentsHubData } from "@/lib/admin/documents-hub";
import { SECURE_DOC_TYPES, type SecureDocKey } from "@/lib/admin/documents-hub-shared";
import { DEFAULT_AGENCY_ID } from "@/types/agencies";
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
  const orgId = headerList.get("x-org-id") ?? DEFAULT_AGENCY_ID;

  const [forms, systemTemplates, owners, responses, actionQueue] = await Promise.all([
    listForms(orgId),
    listDocumentTemplates(),
    fetchDocumentsHubData(),
    listAllFormResponsesForOrg(orgId, 100),
    fetchActionQueue(),
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
    <PaperworkShell active="forms" orgId={orgId} actionCount={actionQueue.length}>
      <FormsTab
        forms={forms}
        recipients={recipients}
        library={library}
        responses={responses}
      />
    </PaperworkShell>
  );
}
