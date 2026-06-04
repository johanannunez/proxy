import type { Metadata } from "next";
import { fetchDocumentsHubData, computeDocTypeStats } from "@/lib/admin/documents-hub";
import { DocumentsHub } from "./DocumentsHub";

export const metadata: Metadata = { title: "Documents" };
export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const owners = await fetchDocumentsHubData();
  const stats = computeDocTypeStats(owners);
  return <DocumentsHub owners={owners} stats={stats} />;
}
