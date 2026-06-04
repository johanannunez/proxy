import type { WorkspaceFinance } from "@/lib/admin/workspace-finance";
import type { WorkspaceContactProperty } from "@/lib/admin/workspace-contact-detail";
import type { OwnerReceiptRow } from "@/app/(workspace)/workspace/finances/receipts-types";
import { AdminReceiptsView } from "./AdminReceiptsView";
import { FinanceRequestsPanel } from "./FinanceRequestsPanel";
import styles from "./FinanceTab.module.css";


export function FinanceTab({
  finance,
  contactId,
  ownerEmail,
  ownerId,
  ownerName,
  ownerPhone,
  ownerAddress,
  properties,
  workspaceId,
  receiptsForExplorer,
}: {
  finance: WorkspaceFinance;
  contactId: string;
  ownerEmail: string | null;
  ownerId: string | null;
  ownerName: string;
  ownerPhone: string | null;
  ownerAddress: { line1: string; line2: string } | null;
  properties: WorkspaceContactProperty[];
  workspaceId: string;
  receiptsForExplorer: OwnerReceiptRow[];
}) {
  return (
    <div className={styles.root}>
      <div style={{ padding: "28px 32px 24px", flexShrink: 0 }}>
        <FinanceRequestsPanel
          finance={finance}
          contactId={contactId}
          ownerEmail={ownerEmail}
          ownerId={ownerId}
          ownerName={ownerName}
          ownerPhone={ownerPhone}
          ownerAddress={ownerAddress}
          workspaceId={workspaceId}
        />
      </div>

      {ownerId && (
        <div style={{ paddingBottom: "32px", paddingLeft: "32px", paddingRight: "32px" }}>
          <AdminReceiptsView
            receipts={receiptsForExplorer}
            ownerId={ownerId}
            workspaceId={workspaceId}
          />
        </div>
      )}
    </div>
  );
}
