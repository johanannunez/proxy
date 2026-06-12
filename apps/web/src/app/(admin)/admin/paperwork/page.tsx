import type { Metadata } from "next";
import { headers } from "next/headers";
import { fetchDocumentsHubData } from "@/lib/admin/documents-hub";
import { fetchActionQueue } from "@/lib/admin/action-queue";
import { fetchTrackedTemplates } from "@/lib/admin/coverage";
import { deriveCoverageGroups } from "@/lib/admin/coverage-shared";
import { PROXY_ORG_ID } from "@/types/organizations";
import { PaperworkShell } from "./PaperworkShell";
import { DocumentsHub } from "./DocumentsHub";

export const metadata: Metadata = { title: "Paperwork" };
export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const headerList = await headers();
  const orgId = headerList.get("x-org-id") ?? PROXY_ORG_ID;

  const [owners, actionQueue, trackedTemplates] = await Promise.all([
    fetchDocumentsHubData(),
    fetchActionQueue(),
    fetchTrackedTemplates(orgId),
  ]);
  const coverageGroups = deriveCoverageGroups(trackedTemplates);

  return (
    <PaperworkShell active="documents" orgId={orgId}>
      <DocumentsHub
        owners={owners}
        actionQueue={actionQueue}
        coverageGroups={coverageGroups}
      />
    </PaperworkShell>
  );
}
