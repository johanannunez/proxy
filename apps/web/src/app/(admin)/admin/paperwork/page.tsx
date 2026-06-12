import type { Metadata } from "next";
import { fetchDocumentsHubData, computeDocTypeStats } from "@/lib/admin/documents-hub";
import { fetchActionQueue } from "@/lib/admin/action-queue";
import { DocumentsHub } from "./DocumentsHub";

export const metadata: Metadata = { title: "Paperwork" };
export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const [owners, actionQueue] = await Promise.all([
    fetchDocumentsHubData(),
    fetchActionQueue(),
  ]);
  const stats = computeDocTypeStats(owners);
  return <DocumentsHub owners={owners} stats={stats} actionQueue={actionQueue} />;
}
