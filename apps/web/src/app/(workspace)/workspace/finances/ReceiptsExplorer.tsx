"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ReceiptsBreadcrumb } from "./ReceiptsBreadcrumb";
import { ReceiptsFileTree } from "./ReceiptsFileTree";
import { ReceiptsDropZone } from "./ReceiptsDropZone";
import { ReceiptsPreviewPanel } from "./ReceiptsPreviewPanel";
import type { AdminReceiptConfig, Breadcrumb, OwnerReceiptRow, TreeFile, TreeFolder, TreeNode } from "./receipts-types";
import {
  deleteReceipt,
  getReceiptSignedUrl,
  markReceiptReviewed,
  updateReceiptField,
  uploadReceipt,
} from "./receipts-actions";

function getExtension(path: string | null): string | null {
  if (!path) return null;
  const dot = path.lastIndexOf(".");
  return dot >= 0 ? path.slice(dot + 1).toLowerCase() : null;
}

function monthLabel(iso: string): { year: string; month: string; monthIndex: number } {
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return { year: "Unsorted", month: "Unknown date", monthIndex: -1 };
  }
  return {
    year: String(date.getFullYear()),
    month: date.toLocaleDateString("en-US", { month: "long" }),
    monthIndex: date.getMonth(),
  };
}

function buildTree(receipts: OwnerReceiptRow[], multiProperty: boolean): TreeNode[] {
  const yearMap = new Map<string, Map<string, Map<string, OwnerReceiptRow[]>>>();
  const monthIndexMap = new Map<string, number>();

  for (const r of receipts) {
    const { year, month, monthIndex } = monthLabel(r.purchase_date);
    monthIndexMap.set(`${year}:${month}`, monthIndex);

    if (!yearMap.has(year)) yearMap.set(year, new Map());
    const months = yearMap.get(year)!;

    if (!months.has(month)) months.set(month, new Map());
    const props = months.get(month)!;

    const propKey = multiProperty
      ? (r.property?.name ?? r.property?.address_line1 ?? "No property")
      : "__all__";

    if (!props.has(propKey)) props.set(propKey, []);
    props.get(propKey)!.push(r);
  }

  const yearKeys = Array.from(yearMap.keys()).sort((a, b) => Number(b) - Number(a));

  return yearKeys.map((year): TreeFolder => ({
    type: "folder",
    key: `year:${year}`,
    label: year,
    children: Array.from(yearMap.get(year)!.entries())
      .sort(([a], [b]) => {
        const ai = monthIndexMap.get(`${year}:${a}`) ?? 0;
        const bi = monthIndexMap.get(`${year}:${b}`) ?? 0;
        return bi - ai;
      })
      .map(([month, props]): TreeFolder => ({
        type: "folder",
        key: `month:${year}:${month}`,
        label: month,
        children: multiProperty
          ? Array.from(props.entries()).map(([propName, items]): TreeFolder => ({
              type: "folder",
              key: `prop:${year}:${month}:${propName}`,
              label: propName,
              children: items.map(
                (r): TreeFile => ({
                  type: "file",
                  key: `file:${r.id}`,
                  receipt: r,
                  extension: getExtension(r.storage_path),
                }),
              ),
            }))
          : (props.get("__all__") ?? []).map(
              (r): TreeFile => ({
                type: "file",
                key: `file:${r.id}`,
                receipt: r,
                extension: getExtension(r.storage_path),
              }),
            ),
      })),
  }));
}

function buildBreadcrumbs(
  tree: TreeNode[],
  selectedId: string | null,
  openFolders: Set<string>,
  onNavigate: (key: string | null) => void,
): Breadcrumb[] {
  const crumbs: Breadcrumb[] = [
    { label: "Finances", key: "root", onClick: () => onNavigate(null) },
  ];

  if (!selectedId) return crumbs;

  function findPath(nodes: TreeNode[], target: string, path: TreeFolder[]): TreeFolder[] | null {
    for (const node of nodes) {
      if (node.type === "file" && node.receipt.id === target) return path;
      if (node.type === "folder") {
        const found = findPath(node.children, target, [...path, node]);
        if (found) return found;
      }
    }
    return null;
  }

  const path = findPath(tree, selectedId, []);
  if (path) {
    for (const folder of path) {
      crumbs.push({
        label: folder.label,
        key: folder.key,
        onClick: () => onNavigate(folder.key),
      });
    }
    const fileNode = tree
      .flatMap(function flat(n): TreeFile[] {
        if (n.type === "file") return [n];
        return n.children.flatMap(flat);
      })
      .find((f) => f.receipt.id === selectedId);
    if (fileNode) {
      crumbs.push({ label: fileNode.receipt.vendor || "Receipt", key: `file:${selectedId}` });
    }
  }

  return crumbs;
}

function defaultOpenFolders(tree: TreeNode[]): Set<string> {
  const open = new Set<string>();
  function traverse(nodes: TreeNode[]) {
    for (const n of nodes) {
      if (n.type === "folder") {
        open.add(n.key);
        traverse(n.children);
      }
    }
  }
  if (tree.length > 0) {
    const first = tree[0];
    if (first.type === "folder") {
      open.add(first.key);
      if (first.children[0]?.type === "folder") {
        open.add(first.children[0].key);
      }
    }
  }
  return open;
}

export function ReceiptsExplorer({
  initialReceipts,
  adminConfig,
}: {
  initialReceipts: OwnerReceiptRow[];
  adminConfig?: AdminReceiptConfig;
}) {
  const [receipts, setReceipts] = useState<OwnerReceiptRow[]>(initialReceipts);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [notification, setNotification] = useState<{ message: string; kind: "success" | "error" } | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const notify = useCallback((message: string, kind: "success" | "error" = "success") => {
    setNotification({ message, kind });
  }, []);

  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(() => setNotification(null), 3500);
    return () => clearTimeout(t);
  }, [notification]);

  const uniqueProperties = useMemo(() => {
    const seen = new Set<string>();
    return receipts
      .map((r) => r.property)
      .filter((p): p is NonNullable<typeof p> => {
        if (!p) return false;
        const key = p.name ?? p.address_line1 ?? "";
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [receipts]);

  const multiProperty = uniqueProperties.length > 1;

  const tree = useMemo(() => buildTree(receipts, multiProperty), [receipts, multiProperty]);

  const [openFolders, setOpenFolders] = useState<Set<string>>(() => defaultOpenFolders(tree));

  const selectedReceipt = useMemo(
    () => receipts.find((r) => r.id === selectedId) ?? null,
    [receipts, selectedId],
  );

  const breadcrumbs = useMemo(
    () =>
      buildBreadcrumbs(tree, selectedId, openFolders, (key) => {
        if (!key) setSelectedId(null);
      }),
    [tree, selectedId, openFolders],
  );

  const handleSelect = useCallback(
    async (id: string) => {
      setSelectedId(id);
      const r = receipts.find((x) => x.id === id);
      if (r?.storage_path) {
        const urlFn = adminConfig?.onGetSignedUrl ?? getReceiptSignedUrl;
        const url = await urlFn(r.storage_path);
        setSignedUrl(url);
      } else {
        setSignedUrl(null);
      }
    },
    [receipts, adminConfig],
  );

  const handleToggleFolder = useCallback((key: string) => {
    setOpenFolders((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const processFiles = useCallback(async (files: File[]) => {
    const ALLOWED = new Set([
      "image/jpeg", "image/png", "image/webp", "image/gif",
      "image/heic", "image/heif", "image/bmp", "image/tiff",
      "application/pdf",
    ]);
    const valid = files.filter((f) => ALLOWED.has(f.type));
    if (valid.length === 0) {
      notify("Only images and PDFs are supported for receipts.", "error");
      return;
    }

    setUploading(true);
    const uploadFn = adminConfig?.onUpload ?? uploadReceipt;
    for (const file of valid) {
      const formData = new FormData();
      formData.append("file", file);
      const result = await uploadFn(formData);
      if ("error" in result) {
        notify(`Upload failed: ${result.error}`, "error");
      } else if ("duplicate" in result) {
        notify(`Already uploaded: ${result.existingReceipt.vendor}`, "error");
        await handleSelect(result.existingReceipt.id);
        if (result.signedUrl) setSignedUrl(result.signedUrl);
      } else {
        setReceipts((prev) => [result.receipt, ...prev]);
        notify(`${result.receipt.vendor} added`);
        await handleSelect(result.receipt.id);
        setSignedUrl(result.signedUrl);
      }
    }
    setUploading(false);
  }, [handleSelect, adminConfig]);

  const handleDrop = useCallback(
    (files: File[]) => { processFiles(files); },
    [processFiles],
  );

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFieldUpdate = useCallback(
    async (field: string, value: unknown) => {
      if (!selectedId) return;
      setReceipts((prev) =>
        prev.map((r) =>
          r.id === selectedId
            ? { ...r, [field]: value }
            : r,
        ),
      );
      startTransition(async () => {
        if (adminConfig) {
          await adminConfig.onUpdateField(selectedId!, field, value);
        } else {
          await updateReceiptField(selectedId!, field, value);
        }
      });
    },
    [selectedId, adminConfig],
  );

  const handleMarkReviewed = useCallback(async () => {
    if (!selectedId) return;
    const now = new Date().toISOString();
    setReceipts((prev) =>
      prev.map((r) => (r.id === selectedId ? { ...r, reviewed_at: now } : r)),
    );
    startTransition(async () => {
      if (adminConfig) {
        await adminConfig.onMarkReviewed(selectedId!);
      } else {
        await markReceiptReviewed(selectedId!);
      }
    });
  }, [selectedId, adminConfig]);

  const handleDelete = useCallback(async () => {
    if (!selectedId) return;
    const r = receipts.find((x) => x.id === selectedId);
    setSelectedId(null);
    setSignedUrl(null);
    setReceipts((prev) => prev.filter((x) => x.id !== selectedId));
    startTransition(async () => {
      if (adminConfig) {
        await adminConfig.onDelete(selectedId!, r?.storage_path ?? null);
      } else {
        await deleteReceipt(selectedId!, r?.storage_path ?? null);
      }
    });
    notify("Receipt deleted");
  }, [selectedId, receipts, adminConfig]);

  const handleAttachFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const selectedFileExt = selectedReceipt?.storage_path
    ? getExtension(selectedReceipt.storage_path)
    : undefined;

  const unreviewedCount = receipts.filter((r) => !r.reviewed_at).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "640px", position: "relative" }}>
      {notification && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 9998,
            padding: "10px 16px",
            borderRadius: "10px",
            backgroundColor: notification.kind === "error" ? "rgba(220, 38, 38, 0.95)" : "rgba(22, 163, 74, 0.95)",
            color: "white",
            fontSize: "13px",
            fontWeight: 600,
            boxShadow: "var(--shadow-lg)",
            animation: "fadeInUp 200ms ease",
          }}
        >
          {notification.message}
        </div>
      )}
      <style>{`@keyframes fadeInUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }`}</style>
      <ReceiptsBreadcrumb segments={breadcrumbs} fileExtension={selectedFileExt} />

      <div
        style={{
          display: "flex",
          flex: 1,
          minHeight: 0,
          borderRadius: "16px",
          border: "1px solid var(--color-warm-gray-200)",
          overflow: "hidden",
          backgroundColor: "var(--color-white)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div style={{ width: "290px", flexShrink: 0, display: "flex", flexDirection: "column" }}>
          <ReceiptsFileTree
            tree={tree}
            selectedId={selectedId}
            onSelect={handleSelect}
            openFolders={openFolders}
            onToggleFolder={handleToggleFolder}
            uploading={uploading}
            onUploadClick={handleUploadClick}
            unreviewedCount={unreviewedCount}
            uploadLabel={adminConfig ? "Upload for owner" : "Upload receipt"}
          />
        </div>

        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <ReceiptsPreviewPanel
            receipt={selectedReceipt}
            signedUrl={signedUrl}
            onFieldUpdate={handleFieldUpdate}
            onMarkReviewed={handleMarkReviewed}
            onDelete={handleDelete}
            onAttachFile={handleAttachFile}
          />
        </div>
      </div>

      <ReceiptsDropZone active onDrop={handleDrop} />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) processFiles(files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
