export type ReceiptPropertyRow = {
  id?: string;
  name: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
};

export type OwnerReceiptRow = {
  id: string;
  vendor: string;
  amount: number;
  currency: string | null;
  category: string;
  purchase_date: string;
  notes: string | null;
  image_url: string | null;
  storage_path: string | null;
  reviewed_at: string | null;
  analysis_kind: "receipt" | "invoice" | "recurring" | "to_pay" | null;
  analysis_summary: string | null;
  analysis_source: "document" | "ai" | "rules" | "manual" | null;
  payment_source:
    | "owner_card"
    | "company_card"
    | "owner_paid"
    | "vendor_invoice"
    | "airbnb_claim"
    | "insurance_claim"
    | "other";
  reimbursement_status:
    | "none"
    | "reimbursement_needed"
    | "claim_needed"
    | "claim_submitted"
    | "reimbursed"
    | "denied_writeoff";
  line_items: unknown;
  file_hash: string | null;
  property: ReceiptPropertyRow | null;
  starred_at: string | null;
  archived_at: string | null;
  review_notes: string | null;
  tags: string[];
};

export type TreeFolder = {
  type: "folder";
  key: string;
  label: string;
  children: TreeNode[];
};

export type TreeFile = {
  type: "file";
  key: string;
  receipt: OwnerReceiptRow;
  extension: string | null;
};

export type TreeNode = TreeFolder | TreeFile;

export type Breadcrumb = {
  label: string;
  key?: string;
  onClick?: () => void;
};

export type AdminReceiptConfig = {
  ownerId: string;
  workspaceId: string;
  onUpload: (formData: FormData) => Promise<
    | { receiptId: string; storagePath: string; signedUrl: string; receipt: OwnerReceiptRow }
    | { duplicate: true; existingReceipt: OwnerReceiptRow; signedUrl: string | null }
    | { error: string }
  >;
  onUpdateField: (id: string, field: string, value: unknown) => Promise<void>;
  onMarkReviewed: (id: string) => Promise<void>;
  onDelete: (id: string, storagePath: string | null) => Promise<void>;
  onGetSignedUrl: (storagePath: string) => Promise<string | null>;
  onToggleVisibility?: (id: string, visible: boolean) => Promise<void>;
};
