"use client";

import { useCallback } from "react";
import { ReceiptsExplorer } from "@/app/(workspace)/workspace/finances/ReceiptsExplorer";
import type { OwnerReceiptRow } from "@/app/(workspace)/workspace/finances/receipts-types";
import {
  deleteReceiptAdmin,
  getReceiptSignedUrlAdmin,
  markReceiptReviewedAdmin,
  updateReceiptFieldAdmin,
  uploadReceiptForOwner,
} from "./receipts-admin-actions";

export function AdminReceiptsView({
  receipts,
  ownerId,
  workspaceId,
}: {
  receipts: OwnerReceiptRow[];
  ownerId: string;
  workspaceId: string;
}) {
  const onUpload = useCallback(
    (formData: FormData) => uploadReceiptForOwner(formData, ownerId, workspaceId),
    [ownerId, workspaceId],
  );

  const onUpdateField = useCallback(
    (id: string, field: string, value: unknown) => updateReceiptFieldAdmin(id, field, value, workspaceId),
    [workspaceId],
  );

  const onMarkReviewed = useCallback(
    (id: string) => markReceiptReviewedAdmin(id, workspaceId),
    [workspaceId],
  );

  const onDelete = useCallback(
    (id: string, storagePath: string | null) => deleteReceiptAdmin(id, storagePath, workspaceId),
    [workspaceId],
  );

  const onGetSignedUrl = useCallback(
    (storagePath: string) => getReceiptSignedUrlAdmin(storagePath),
    [],
  );

  return (
    <ReceiptsExplorer
      initialReceipts={receipts}
      adminConfig={{
        ownerId,
        workspaceId,
        onUpload,
        onUpdateField,
        onMarkReviewed,
        onDelete,
        onGetSignedUrl,
      }}
    />
  );
}
