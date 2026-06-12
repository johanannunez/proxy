import type { Metadata } from "next";
import { headers } from "next/headers";
import { fetchDocumentsHubData, computeDocTypeStats } from "@/lib/admin/documents-hub";
import { fetchActionQueue } from "@/lib/admin/action-queue";
import { PROXY_ORG_ID } from "@/types/organizations";
import { PaperworkShell } from "./PaperworkShell";
import { DocumentsHub } from "./DocumentsHub";

export const metadata: Metadata = { title: "Paperwork" };
export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const headerList = await headers();
  const orgId = headerList.get("x-org-id") ?? PROXY_ORG_ID;

  const [owners, actionQueue] = await Promise.all([
    fetchDocumentsHubData(),
    fetchActionQueue(),
  ]);
  const stats = computeDocTypeStats(owners);

  return (
    <PaperworkShell active="documents" orgId={orgId}>
      <DocumentsHub owners={owners} stats={stats} actionQueue={actionQueue} />
    </PaperworkShell>
  );
}
