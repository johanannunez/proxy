import type { Metadata } from "next";
import { FileText } from "@phosphor-icons/react/dist/ssr";
import { getWorkspaceContext } from "@/lib/workspace-context";
import { EmptyState } from "@/components/workspace/EmptyState";
import { getOwnerDocumentHub } from "@/lib/documents/workspace";
import { DocumentsHub } from "./DocumentsHub";

export const metadata: Metadata = { title: "Documents" };
export const dynamic = "force-dynamic";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ request?: string }>;
}) {
  const { request: requestId } = await searchParams;
  const { userId, client } = await getWorkspaceContext();
  const hub = await getOwnerDocumentHub(client, userId);

  // If the owner arrived from a request link/notification, surface what Proxy asked for.
  let requestContext: { id: string; items: Array<{ label: string; status: string }> } | null = null;
  if (requestId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: items } = await (client as any)
      .from("workspace_request_items")
      .select("label, status")
      .eq("request_id", requestId);
    if (items && items.length > 0) {
      requestContext = { id: requestId, items: items as Array<{ label: string; status: string }> };
    }
  }

  if (hub.progress.total === 0) {
    return (
      <EmptyState
        icon={<FileText size={26} weight="duotone" />}
        title="No documents yet"
        body="Once your account is set up, the documents we need from you (agreement, W-9, identity, and more) will appear here for you to complete, sign, and track."
      />
    );
  }

  return <DocumentsHub hub={hub} requestContext={requestContext} />;
}
