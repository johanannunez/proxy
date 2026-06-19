import type { Metadata } from "next";
import { headers } from "next/headers";
import { fetchActionQueue } from "@/lib/admin/action-queue";
import { fetchWorkspaceStatusBoard } from "@/lib/admin/status-board";
import { DEFAULT_AGENCY_ID } from "@/types/agencies";
import { PaperworkShell } from "./PaperworkShell";
import { StatusBoardTab } from "./StatusBoardTab";

export const metadata: Metadata = { title: "Paperwork" };
export const dynamic = "force-dynamic";

/**
 * Status Board — the default Paperwork tab (2026-06-14 redesign). The workspace
 * completion matrix is the whole page. The action queue is fetched here only
 * for its count (the Action Center pill); the queue itself lives in the
 * on-demand Action Center slide-over, which lazy-fetches its full payload.
 */
export default async function PaperworkStatusPage() {
  const headerList = await headers();
  const orgId = headerList.get("x-org-id") ?? DEFAULT_AGENCY_ID;

  const [actionQueue, statusBoard] = await Promise.all([
    fetchActionQueue(),
    fetchWorkspaceStatusBoard(orgId),
  ]);

  return (
    <PaperworkShell active="status" orgId={orgId} actionCount={actionQueue.length}>
      <StatusBoardTab board={statusBoard} />
    </PaperworkShell>
  );
}
