"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ReceiptsBreadcrumb } from "./ReceiptsBreadcrumb";
import { ReceiptsFileTree } from "./ReceiptsFileTree";
import { ReceiptsDropZone } from "./ReceiptsDropZone";
import { ReceiptsPreviewPanel } from "./ReceiptsPreviewPanel";
import { ReceiptsTimeline } from "./ReceiptsTimeline";
import type { AdminReceiptConfig, Breadcrumb, OwnerReceiptRow, TreeFile, TreeFolder, TreeNode } from "./receipts-types";
import {
  deleteReceipt,
  getReceiptSignedUrl,
  markReceiptReviewed,
  updateReceiptField,
  uploadReceipt,
  starReceipt,
  unstarReceipt,
  archiveReceipt,
  unarchiveReceipt,
  exportReceiptsAsCsv,
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
  const [, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // New state
  const [pendingUploads, setPendingUploads] = useState<Map<string, string>>(new Map());
  const [searchQuery, setSearchQuery] = useState("");
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"tree" | "timeline">("tree");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  const filteredReceipts = useMemo(() => {
    if (!searchQuery && !categoryFilter) return receipts.filter((r) => !r.archived_at);
    return receipts.filter((r) => {
      if (r.archived_at) return false;
      if (categoryFilter && r.category !== categoryFilter) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        r.vendor.toLowerCase().includes(q) ||
        (r.category ?? "").toLowerCase().includes(q) ||
        String(r.amount).includes(q) ||
        (r.tags ?? []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [receipts, searchQuery, categoryFilter]);

  const tree = useMemo(() => buildTree(filteredReceipts, multiProperty), [filteredReceipts, multiProperty]);

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

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      function collectIds(nodes: TreeNode[]): string[] {
        const ids: string[] = [];
        for (const node of nodes) {
          if (node.type === "file") ids.push(node.receipt.id);
          else if (node.type === "folder" && openFolders.has(node.key)) {
            ids.push(...collectIds(node.children));
          }
        }
        return ids;
      }
      const visibleIds = collectIds(tree);
      const currentIndex = selectedId ? visibleIds.indexOf(selectedId) : -1;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const nextId = visibleIds[currentIndex + 1];
        if (nextId) handleSelect(nextId);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prevId = visibleIds[currentIndex - 1];
        if (prevId) handleSelect(prevId);
      } else if (e.key === "r" && selectedId) {
        handleMarkReviewed();
      } else if (e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "Escape") {
        setSearchQuery("");
        setSelectedId(null);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [tree, selectedId, openFolders, handleSelect, handleMarkReviewed]);

  const handleStarToggle = useCallback(async (id: string) => {
    const receipt = receipts.find((r) => r.id === id);
    if (!receipt) return;
    const nowStar = !receipt.starred_at;
    setReceipts((prev) => prev.map((r) => r.id === id ? { ...r, starred_at: nowStar ? new Date().toISOString() : null } : r));
    if (nowStar) await starReceipt(id);
    else await unstarReceipt(id);
  }, [receipts]);

  const handleArchiveToggle = useCallback(async (id: string) => {
    const receipt = receipts.find((r) => r.id === id);
    if (!receipt) return;
    const nowArchive = !receipt.archived_at;
    setReceipts((prev) => prev.map((r) => r.id === id ? { ...r, archived_at: nowArchive ? new Date().toISOString() : null } : r));
    if (id === selectedId && nowArchive) setSelectedId(null);
    if (nowArchive) await archiveReceipt(id);
    else await unarchiveReceipt(id);
  }, [receipts, selectedId]);

  const handleBulkMarkReviewed = useCallback(async () => {
    const now = new Date().toISOString();
    const ids = Array.from(bulkSelectedIds);
    setReceipts((prev) => prev.map((r) => ids.includes(r.id) ? { ...r, reviewed_at: now } : r));
    setBulkSelectedIds(new Set());
    const reviewFn = adminConfig?.onMarkReviewed ?? markReceiptReviewed;
    await Promise.all(ids.map((id) => reviewFn(id)));
    notify(`${ids.length} document${ids.length === 1 ? "" : "s"} marked reviewed`);
  }, [bulkSelectedIds, adminConfig, notify]);

  const handleExportCsv = useCallback(async () => {
    const csv = await exportReceiptsAsCsv();
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "receipts.csv";
    a.click();
    URL.revokeObjectURL(url);
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
      const tempId = crypto.randomUUID();
      const filename = file.name;

      const placeholder: OwnerReceiptRow = {
        id: tempId,
        vendor: file.name.replace(/\.[^.]+$/, ""),
        amount: 0,
        currency: "USD",
        category: "Other",
        purchase_date: new Date().toISOString().split("T")[0],
        notes: null,
        image_url: null,
        storage_path: null,
        reviewed_at: null,
        analysis_kind: "receipt",
        analysis_summary: null,
        analysis_source: null,
        payment_source: "owner_paid",
        reimbursement_status: "none",
        line_items: null,
        file_hash: null,
        property: null,
        starred_at: null,
        archived_at: null,
        review_notes: null,
        tags: [],
      };

      // Add placeholder immediately and select it
      setReceipts((prev) => [placeholder, ...prev]);
      setSelectedId(tempId);
      setPendingUploads((prev) => { const next = new Map(prev); next.set(tempId, filename); return next; });

      const formData = new FormData();
      formData.append("file", file);
      const result = await uploadFn(formData);

      if ("error" in result) {
        // Remove placeholder, show error
        setPendingUploads((prev) => { const next = new Map(prev); next.delete(tempId); return next; });
        setReceipts((prev) => prev.filter((r) => r.id !== tempId));
        if (selectedId === tempId) setSelectedId(null);
        notify(`Upload failed: ${result.error}`, "error");
      } else if ("duplicate" in result) {
        // Remove placeholder, select duplicate
        setPendingUploads((prev) => { const next = new Map(prev); next.delete(tempId); return next; });
        setReceipts((prev) => prev.filter((r) => r.id !== tempId));
        notify(`Already uploaded: ${result.existingReceipt.vendor}`, "error");
        await handleSelect(result.existingReceipt.id);
        if (result.signedUrl) setSignedUrl(result.signedUrl);
      } else {
        // Remove placeholder, add real receipt at the front
        setPendingUploads((prev) => { const next = new Map(prev); next.delete(tempId); return next; });
        setReceipts((prev) => [result.receipt, ...prev.filter((r) => r.id !== tempId)]);
        notify(`${result.receipt.vendor} added`);
        await handleSelect(result.receipt.id);
        setSignedUrl(result.signedUrl);
      }
    }
    setUploading(false);
  }, [handleSelect, adminConfig, selectedId, notify]);

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
  }, [selectedId, receipts, adminConfig, notify]);

  const handleAttachFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const selectedFileExt = selectedReceipt?.storage_path
    ? getExtension(selectedReceipt.storage_path)
    : undefined;

  const unreviewedCount = filteredReceipts.filter((r) => !r.reviewed_at).length;

  const starredReceipts = useMemo(
    () => receipts.filter((r) => !!r.starred_at && !r.archived_at),
    [receipts],
  );

  const archivedReceipts = useMemo(
    () => receipts.filter((r) => !!r.archived_at),
    [receipts],
  );

  return (
    <div ref={containerRef} style={{ display: "flex", flexDirection: "column", minHeight: "640px", position: "relative" }}>
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
          position: "relative",
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
            uploadLabel="Upload document"
            pendingUploads={pendingUploads}
            bulkSelectedIds={bulkSelectedIds}
            onBulkSelect={(id: string, add: boolean) =>
              setBulkSelectedIds((prev) => {
                const next = new Set(prev);
                if (add) next.add(id);
                else next.delete(id);
                return next;
              })
            }
            onBulkClear={() => setBulkSelectedIds(new Set())}
            onBulkMarkReviewed={handleBulkMarkReviewed}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchInputRef={searchInputRef}
            onStarToggle={handleStarToggle}
            onArchiveToggle={handleArchiveToggle}
            categoryFilter={categoryFilter}
            onCategoryFilter={setCategoryFilter}
            onExportCsv={handleExportCsv}
            starredReceipts={starredReceipts}
            archivedReceipts={archivedReceipts}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
        </div>

        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          {viewMode === "timeline" ? (
            <ReceiptsTimeline
              receipts={filteredReceipts}
              selectedId={selectedId}
              onSelect={handleSelect}
            />
          ) : (
            <ReceiptsPreviewPanel
              receipt={selectedReceipt}
              signedUrl={signedUrl}
              onFieldUpdate={handleFieldUpdate}
              onMarkReviewed={handleMarkReviewed}
              onDelete={handleDelete}
              onAttachFile={handleAttachFile}
              uploading={uploading}
            />
          )}
        </div>

        {bulkSelectedIds.size > 0 && (
          <div
            style={{
              position: "absolute",
              bottom: "16px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 20,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 16px",
              borderRadius: "12px",
              backgroundColor: "var(--color-white)",
              boxShadow: "var(--shadow-lg)",
              border: "1px solid var(--color-warm-gray-200)",
            }}
          >
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-primary)" }}>
              {bulkSelectedIds.size} selected
            </span>
            <button
              type="button"
              onClick={handleBulkMarkReviewed}
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "#15803d",
                backgroundColor: "rgba(22,163,74,0.10)",
                border: "1px solid rgba(22,163,74,0.20)",
                borderRadius: "8px",
                padding: "6px 12px",
                cursor: "pointer",
              }}
            >
              Mark all reviewed
            </button>
            <button
              type="button"
              onClick={() => setBulkSelectedIds(new Set())}
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--color-text-secondary)",
                backgroundColor: "var(--color-warm-gray-50)",
                border: "1px solid var(--color-warm-gray-200)",
                borderRadius: "8px",
                padding: "6px 10px",
                cursor: "pointer",
              }}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      <ReceiptsDropZone active onDrop={handleDrop} containerRef={containerRef} />

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
