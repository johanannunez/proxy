import type { Metadata } from "next";
import { headers } from "next/headers";
import { fetchDocumentsHubData } from "@/lib/admin/documents-hub";
import { fetchActionQueue } from "@/lib/admin/action-queue";
import { fetchWorkspaceStatusBoard } from "@/lib/admin/status-board";
import { PROXY_ORG_ID } from "@/types/organizations";
import { PaperworkShell } from "./PaperworkShell";
import { DocumentsHub } from "./DocumentsHub";

export const metadata: Metadata = { title: "Paperwork" };
export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const headerList = await headers();
  const orgId = headerList.get("x-org-id") ?? PROXY_ORG_ID;

  // owners powers the Needs Action queue's detail drawer; statusBoard powers
  // the workspace completion matrix that is the Documents tab itself.
  const [owners, actionQueue, statusBoard] = await Promise.all([
    fetchDocumentsHubData(),
    fetchActionQueue(),
    fetchWorkspaceStatusBoard(orgId),
  ]);

  return (
    <PaperworkShell active="documents" orgId={orgId}>
      <DocumentsHub
        owners={owners}
        actionQueue={actionQueue}
        statusBoard={statusBoard}
      />
    </PaperworkShell>
  );
}
