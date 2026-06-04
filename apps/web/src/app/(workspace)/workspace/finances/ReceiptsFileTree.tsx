"use client";

import { useRef, useState } from "react";
import {
  FilePdf,
  FileImage,
  File,
  FolderOpen,
  Folder,
  CaretRight,
  UploadSimple,
  MagnifyingGlass,
  X,
  Star,
  Tray,
  DotsThree,
  ArrowSquareOut,
  Rows,
  SquaresFour,
} from "@phosphor-icons/react";
import type { TreeNode, OwnerReceiptRow } from "./receipts-types";

// Category color map
const CAT_COLORS: Record<string, string> = {
  Maintenance: "#b45309",
  Cleaning: "#0f766e",
  Supplies: "#1b77be",
  Utilities: "#854d0e",
  Insurance: "#7c3aed",
  Taxes: "#b91c1c",
  Furnishings: "#15803d",
  Marketing: "#be185d",
  Travel: "#0369a1",
  "Professional Services": "#4338ca",
  Other: "#4b5563",
};

function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getFileIcon(ext: string | null) {
  if (!ext) return { Icon: File, color: "var(--color-text-tertiary)" };
  const lower = ext.toLowerCase();
  if (lower === "pdf") return { Icon: FilePdf, color: "#e05c4b" };
  if (["jpg", "jpeg", "png", "webp", "gif", "heic", "heif", "bmp"].includes(lower))
    return { Icon: FileImage, color: "var(--color-brand-light)" };
  return { Icon: File, color: "var(--color-text-tertiary)" };
}

function CategoryBar({
  receipts,
  filter,
  onFilter,
}: {
  receipts: OwnerReceiptRow[];
  filter: string | null;
  onFilter: (c: string | null) => void;
}) {
  const byCategory = receipts.reduce<Record<string, number>>((acc, r) => {
    const cat = r.category ?? "Other";
    acc[cat] = (acc[cat] ?? 0) + Number(r.amount);
    return acc;
  }, {});
  const total = Object.values(byCategory).reduce((a, b) => a + b, 0);
  if (total === 0 || Object.keys(byCategory).length === 0) return null;

  const sorted = Object.entries(byCategory).sort(([, a], [, b]) => b - a).slice(0, 5);

  return (
    <div
      style={{
        display: "flex",
        gap: "3px",
        padding: "6px 12px",
        borderBottom: "1px solid var(--color-warm-gray-200)",
      }}
    >
      {sorted.map(([cat, amt]) => {
        const isActive = filter === cat;
        const colorHex = CAT_COLORS[cat] ?? "#4b5563";
        return (
          <button
            key={cat}
            type="button"
            onClick={() => onFilter(isActive ? null : cat)}
            title={`${cat}: $${Math.round(amt)}`}
            style={{
              flex: amt / total,
              minWidth: "8px",
              height: "4px",
              borderRadius: "2px",
              backgroundColor: colorHex,
              opacity: filter && !isActive ? 0.25 : 1,
              border: "none",
              cursor: "pointer",
              transition: "opacity 120ms ease",
            }}
          />
        );
      })}
    </div>
  );
}

function ContextMenu({
  receipt,
  onArchive,
  onClose,
}: {
  receipt: OwnerReceiptRow;
  onArchive: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        right: "4px",
        top: "100%",
        zIndex: 50,
        backgroundColor: "var(--color-white)",
        border: "1px solid var(--color-warm-gray-200)",
        borderRadius: "8px",
        boxShadow: "var(--shadow-lg)",
        padding: "4px",
        minWidth: "120px",
      }}
      onMouseLeave={onClose}
    >
      <button
        type="button"
        onClick={() => { onArchive(); onClose(); }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          width: "100%",
          padding: "5px 8px",
          borderRadius: "5px",
          border: "none",
          cursor: "pointer",
          backgroundColor: "transparent",
          fontSize: "12px",
          color: receipt.archived_at ? "var(--color-brand)" : "var(--color-text-secondary)",
          textAlign: "left",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--color-warm-gray-100)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
        }}
      >
        <Tray size={12} weight="bold" />
        {receipt.archived_at ? "Unarchive" : "Archive"}
      </button>
    </div>
  );
}

function FileNodeRow({
  receipt,
  ext,
  isSelected,
  onSelect,
  depth,
  onStarToggle,
  onArchiveToggle,
  bulkSelectedIds,
  onBulkSelect,
  isPending,
}: {
  receipt: OwnerReceiptRow;
  ext: string | null;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  depth: number;
  onStarToggle: (id: string) => void;
  onArchiveToggle: (id: string) => void;
  bulkSelectedIds: Set<string>;
  onBulkSelect: (id: string, add: boolean) => void;
  isPending?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { Icon, color } = getFileIcon(ext);
  const needsReview = !receipt.reviewed_at;
  const isStarred = !!receipt.starred_at;
  const isBulkSelected = bulkSelectedIds.has(receipt.id);

  const handleClick = (e: React.MouseEvent) => {
    if (e.shiftKey) {
      onBulkSelect(receipt.id, !isBulkSelected);
    } else {
      onSelect(e);
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          width: "100%",
          paddingLeft: `${12 + depth * 16}px`,
          paddingRight: "10px",
          paddingTop: "5px",
          paddingBottom: "5px",
          borderRadius: "6px",
          border: isBulkSelected ? "1px solid rgba(27,119,190,0.35)" : "1px solid transparent",
          cursor: "pointer",
          textAlign: "left",
          position: "relative",
          backgroundColor: isBulkSelected
            ? "rgba(27, 119, 190, 0.06)"
            : isSelected
            ? "rgba(27, 119, 190, 0.08)"
            : hovered
            ? "var(--color-warm-gray-100)"
            : "transparent",
          transition: "background-color 100ms ease",
          opacity: isPending ? 0.6 : 1,
        }}
      >
        {(isSelected || isBulkSelected) && (
          <span
            style={{
              position: "absolute",
              left: 0,
              top: "4px",
              bottom: "4px",
              width: "2px",
              borderRadius: "2px",
              backgroundColor: "var(--color-brand)",
            }}
          />
        )}

        {/* Bulk checkbox indicator */}
        {isBulkSelected && (
          <span
            style={{
              position: "absolute",
              left: `${2 + depth * 16}px`,
              top: "50%",
              transform: "translateY(-50%)",
              width: "10px",
              height: "10px",
              borderRadius: "3px",
              backgroundColor: "var(--color-brand)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          />
        )}

        <Icon size={14} weight="duotone" color={color} style={{ flexShrink: 0 }} />
        <span
          style={{
            fontSize: "12.5px",
            fontFamily: "var(--font-ibm-plex-mono), monospace",
            color: isSelected ? "var(--color-brand)" : "var(--color-text-secondary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            fontWeight: isSelected ? 600 : 400,
          }}
        >
          {receipt.vendor || "Unnamed"}
        </span>

        <span style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
          {/* First tag pill */}
          {receipt.tags && receipt.tags.length > 0 && (
            <span
              style={{
                fontSize: "9px",
                fontWeight: 600,
                color: "var(--color-text-tertiary)",
                backgroundColor: "var(--color-warm-gray-100)",
                border: "1px solid var(--color-warm-gray-200)",
                padding: "1px 4px",
                borderRadius: "3px",
                letterSpacing: "0.03em",
                flexShrink: 0,
                maxWidth: "48px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {receipt.tags[0]}
            </span>
          )}

          {/* Star button */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onStarToggle(receipt.id); }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "16px",
              height: "16px",
              border: "none",
              background: "none",
              cursor: "pointer",
              padding: "0",
              opacity: isStarred ? 1 : hovered ? 0.7 : 0,
              transition: "opacity 100ms ease",
              color: isStarred ? "#f59e0b" : "var(--color-text-tertiary)",
              flexShrink: 0,
            }}
          >
            <Star size={12} weight={isStarred ? "fill" : "regular"} color={isStarred ? "#f59e0b" : "var(--color-text-tertiary)"} />
          </button>

          {/* Dots menu button */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "16px",
              height: "16px",
              border: "none",
              background: "none",
              cursor: "pointer",
              padding: "0",
              opacity: hovered || menuOpen ? 0.7 : 0,
              transition: "opacity 100ms ease",
              color: "var(--color-text-tertiary)",
              flexShrink: 0,
            }}
          >
            <DotsThree size={14} weight="bold" />
          </button>

          {needsReview && (
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: "#f59e0b",
                flexShrink: 0,
              }}
            />
          )}
          {receipt.analysis_kind === "invoice" && (
            <span
              style={{
                fontSize: "9px",
                fontWeight: 700,
                color: "#7c3aed",
                backgroundColor: "rgba(139,92,246,0.10)",
                border: "1px solid rgba(139,92,246,0.20)",
                padding: "1px 4px",
                borderRadius: "3px",
                letterSpacing: "0.04em",
                flexShrink: 0,
              }}
            >
              INV
            </span>
          )}
          {receipt.amount > 0 && (
            <span
              style={{
                fontSize: "10px",
                fontWeight: 600,
                color: "var(--color-text-tertiary)",
                backgroundColor: "var(--color-warm-gray-100)",
                padding: "1px 5px",
                borderRadius: "4px",
                fontFamily: "var(--font-ibm-plex-mono), monospace",
              }}
            >
              {formatCurrency(receipt.amount, receipt.currency ?? "USD")}
            </span>
          )}
        </span>
      </button>

      {/* Context menu */}
      {menuOpen && (
        <ContextMenu
          receipt={receipt}
          onArchive={() => onArchiveToggle(receipt.id)}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </div>
  );
}

function FolderRow({
  label,
  isOpen,
  depth,
  onToggle,
  icon,
  iconColor,
}: {
  label: string;
  isOpen: boolean;
  depth: number;
  onToggle: () => void;
  icon?: React.ReactNode;
  iconColor?: string;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onToggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        width: "100%",
        paddingLeft: `${8 + depth * 16}px`,
        paddingRight: "10px",
        paddingTop: "5px",
        paddingBottom: "5px",
        borderRadius: "6px",
        border: "none",
        cursor: "pointer",
        backgroundColor: hovered ? "var(--color-warm-gray-100)" : "transparent",
        transition: "background-color 100ms ease",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          transition: "transform 160ms ease",
          transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
        }}
      >
        <CaretRight size={10} weight="bold" color="var(--color-text-tertiary)" />
      </span>
      {icon ?? (
        isOpen ? (
          <FolderOpen size={14} weight="duotone" color={iconColor ?? "#f59e0b"} style={{ flexShrink: 0 }} />
        ) : (
          <Folder size={14} weight="duotone" color={iconColor ?? "#f59e0b"} style={{ flexShrink: 0 }} />
        )
      )}
      <span
        style={{
          fontSize: "11.5px",
          fontFamily: "var(--font-ibm-plex-mono), monospace",
          fontWeight: 600,
          color: "var(--color-text-primary)",
          letterSpacing: "0.02em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
    </button>
  );
}

function TreeNodeRenderer({
  node,
  selectedId,
  onSelect,
  openFolders,
  onToggle,
  depth,
  onStarToggle,
  onArchiveToggle,
  bulkSelectedIds,
  onBulkSelect,
  pendingUploads,
}: {
  node: TreeNode;
  selectedId: string | null;
  onSelect: (id: string) => void;
  openFolders: Set<string>;
  onToggle: (key: string) => void;
  depth: number;
  onStarToggle: (id: string) => void;
  onArchiveToggle: (id: string) => void;
  bulkSelectedIds: Set<string>;
  onBulkSelect: (id: string, add: boolean) => void;
  pendingUploads: Map<string, string>;
}) {
  if (node.type === "folder") {
    const isOpen = openFolders.has(node.key);
    return (
      <div>
        <FolderRow
          label={node.label}
          isOpen={isOpen}
          depth={depth}
          onToggle={() => onToggle(node.key)}
        />
        {isOpen && (
          <div>
            {node.children.map((child) => (
              <TreeNodeRenderer
                key={child.key}
                node={child}
                selectedId={selectedId}
                onSelect={onSelect}
                openFolders={openFolders}
                onToggle={onToggle}
                depth={depth + 1}
                onStarToggle={onStarToggle}
                onArchiveToggle={onArchiveToggle}
                bulkSelectedIds={bulkSelectedIds}
                onBulkSelect={onBulkSelect}
                pendingUploads={pendingUploads}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isPending = pendingUploads.has(node.receipt.id);
  return (
    <FileNodeRow
      receipt={node.receipt}
      ext={node.extension}
      isSelected={selectedId === node.receipt.id}
      onSelect={() => onSelect(node.receipt.id)}
      depth={depth}
      onStarToggle={onStarToggle}
      onArchiveToggle={onArchiveToggle}
      bulkSelectedIds={bulkSelectedIds}
      onBulkSelect={onBulkSelect}
      isPending={isPending}
    />
  );
}

function StarredFolder({
  receipts,
  selectedId,
  onSelect,
  openFolders,
  onToggle,
  onStarToggle,
  onArchiveToggle,
  bulkSelectedIds,
  onBulkSelect,
}: {
  receipts: OwnerReceiptRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  openFolders: Set<string>;
  onToggle: (key: string) => void;
  onStarToggle: (id: string) => void;
  onArchiveToggle: (id: string) => void;
  bulkSelectedIds: Set<string>;
  onBulkSelect: (id: string, add: boolean) => void;
}) {
  const FOLDER_KEY = "virtual:starred";
  const isOpen = openFolders.has(FOLDER_KEY);

  if (receipts.length === 0) return null;

  return (
    <div>
      <FolderRow
        label="Starred"
        isOpen={isOpen}
        depth={0}
        onToggle={() => onToggle(FOLDER_KEY)}
        icon={<Star size={14} weight="fill" color="#f59e0b" style={{ flexShrink: 0 }} />}
      />
      {isOpen && (
        <div>
          {receipts.map((r) => (
            <FileNodeRow
              key={r.id}
              receipt={r}
              ext={r.storage_path ? r.storage_path.slice(r.storage_path.lastIndexOf(".") + 1).toLowerCase() : null}
              isSelected={selectedId === r.id}
              onSelect={() => onSelect(r.id)}
              depth={1}
              onStarToggle={onStarToggle}
              onArchiveToggle={onArchiveToggle}
              bulkSelectedIds={bulkSelectedIds}
              onBulkSelect={onBulkSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ArchivedSection({
  receipts,
  selectedId,
  onSelect,
  openFolders,
  onToggle,
  onArchiveToggle,
  bulkSelectedIds,
  onBulkSelect,
}: {
  receipts: OwnerReceiptRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  openFolders: Set<string>;
  onToggle: (key: string) => void;
  onArchiveToggle: (id: string) => void;
  bulkSelectedIds: Set<string>;
  onBulkSelect: (id: string, add: boolean) => void;
}) {
  const FOLDER_KEY = "virtual:archived";
  const isOpen = openFolders.has(FOLDER_KEY);

  if (receipts.length === 0) return null;

  return (
    <div style={{ marginTop: "8px", borderTop: "1px solid var(--color-warm-gray-200)", paddingTop: "6px" }}>
      <FolderRow
        label={`Archived (${receipts.length})`}
        isOpen={isOpen}
        depth={0}
        onToggle={() => onToggle(FOLDER_KEY)}
        icon={<Tray size={14} weight="duotone" color="var(--color-text-tertiary)" style={{ flexShrink: 0 }} />}
      />
      {isOpen && (
        <div>
          {receipts.map((r) => (
            <FileNodeRow
              key={r.id}
              receipt={r}
              ext={r.storage_path ? r.storage_path.slice(r.storage_path.lastIndexOf(".") + 1).toLowerCase() : null}
              isSelected={selectedId === r.id}
              onSelect={() => onSelect(r.id)}
              depth={1}
              onStarToggle={() => {}}
              onArchiveToggle={onArchiveToggle}
              bulkSelectedIds={bulkSelectedIds}
              onBulkSelect={onBulkSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ReceiptsFileTree({
  tree,
  selectedId,
  onSelect,
  openFolders,
  onToggleFolder,
  uploading,
  onUploadClick,
  unreviewedCount = 0,
  uploadLabel = "Upload document",
  pendingUploads,
  bulkSelectedIds,
  onBulkSelect,
  onBulkClear,
  onBulkMarkReviewed,
  searchQuery,
  onSearchChange,
  searchInputRef,
  onStarToggle,
  onArchiveToggle,
  categoryFilter,
  onCategoryFilter,
  onExportCsv,
  starredReceipts,
  archivedReceipts,
  viewMode,
  onViewModeChange,
}: {
  tree: TreeNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  openFolders: Set<string>;
  onToggleFolder: (key: string) => void;
  uploading: boolean;
  onUploadClick: () => void;
  unreviewedCount?: number;
  uploadLabel?: string;
  pendingUploads: Map<string, string>;
  bulkSelectedIds: Set<string>;
  onBulkSelect: (id: string, add: boolean) => void;
  onBulkClear: () => void;
  onBulkMarkReviewed: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  onStarToggle: (id: string) => void;
  onArchiveToggle: (id: string) => void;
  categoryFilter: string | null;
  onCategoryFilter: (cat: string | null) => void;
  onExportCsv: () => void;
  starredReceipts: OwnerReceiptRow[];
  archivedReceipts: OwnerReceiptRow[];
  viewMode: "tree" | "timeline";
  onViewModeChange: (mode: "tree" | "timeline") => void;
}) {
  // Collect all receipts visible in the tree for category bar
  const allVisibleReceipts: OwnerReceiptRow[] = [];
  function collectReceipts(nodes: TreeNode[]) {
    for (const n of nodes) {
      if (n.type === "file") allVisibleReceipts.push(n.receipt);
      else collectReceipts(n.children);
    }
  }
  collectReceipts(tree);

  // Combine for category display: tree + starred (deduped)
  const seenIds = new Set(allVisibleReceipts.map((r) => r.id));
  const receiptsForCategory = [...allVisibleReceipts, ...starredReceipts.filter((r) => !seenIds.has(r.id))];

  const hasPending = pendingUploads.size > 0;
  const pendingEntries = Array.from(pendingUploads.entries());

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        backgroundColor: "var(--color-warm-gray-50)",
        borderRight: "1px solid var(--color-warm-gray-200)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 12px 10px",
          borderBottom: "1px solid var(--color-warm-gray-200)",
        }}
      >
        <span
          style={{
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--color-text-tertiary)",
          }}
        >
          Files
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          {unreviewedCount > 0 && (
            <span
              style={{
                fontSize: "10px",
                fontWeight: 600,
                color: "#b45309",
                backgroundColor: "rgba(245, 158, 11, 0.12)",
                padding: "2px 7px",
                borderRadius: "4px",
                whiteSpace: "nowrap",
              }}
            >
              {unreviewedCount} need{unreviewedCount === 1 ? "s" : ""} review
            </span>
          )}
          <button
            type="button"
            onClick={() => onViewModeChange(viewMode === "tree" ? "timeline" : "tree")}
            title={viewMode === "tree" ? "Switch to timeline view" : "Switch to file view"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "22px",
              height: "22px",
              borderRadius: "5px",
              border: "none",
              backgroundColor: viewMode === "timeline" ? "rgba(27,119,190,0.10)" : "transparent",
              cursor: "pointer",
              color: viewMode === "timeline" ? "var(--color-brand)" : "var(--color-text-tertiary)",
              transition: "background-color 120ms ease, color 120ms ease",
            }}
          >
            {viewMode === "tree" ? <SquaresFour size={13} weight="bold" /> : <Rows size={13} weight="bold" />}
          </button>
          <button
            type="button"
            onClick={onExportCsv}
            title="Export CSV"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "22px",
              height: "22px",
              borderRadius: "5px",
              border: "none",
              backgroundColor: "transparent",
              cursor: "pointer",
              color: "var(--color-text-tertiary)",
            }}
          >
            <ArrowSquareOut size={13} weight="bold" />
          </button>
        </div>
      </div>

      {/* Category bar */}
      <CategoryBar
        receipts={receiptsForCategory}
        filter={categoryFilter}
        onFilter={onCategoryFilter}
      />

      {/* Search box */}
      <div style={{ padding: "6px 10px", borderBottom: "1px solid var(--color-warm-gray-200)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "5px 8px",
            borderRadius: "7px",
            backgroundColor: "var(--color-warm-gray-100)",
            border: "1px solid transparent",
          }}
        >
          <MagnifyingGlass size={12} weight="bold" color="var(--color-text-tertiary)" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search documents..."
            style={{
              flex: 1,
              border: "none",
              background: "none",
              fontSize: "12px",
              color: "var(--color-text-primary)",
              outline: "none",
              fontFamily: "inherit",
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              style={{
                display: "flex",
                border: "none",
                background: "none",
                cursor: "pointer",
                color: "var(--color-text-tertiary)",
                padding: "0",
              }}
            >
              <X size={11} weight="bold" />
            </button>
          )}
        </div>
      </div>

      {/* Tree content */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "8px 6px",
        }}
      >
        {/* Active category filter badge */}
        {categoryFilter && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "3px 8px 6px",
            }}
          >
            <span
              style={{
                fontSize: "10px",
                fontWeight: 600,
                color: CAT_COLORS[categoryFilter] ?? "var(--color-text-secondary)",
                backgroundColor: `${CAT_COLORS[categoryFilter] ?? "#4b5563"}18`,
                border: `1px solid ${CAT_COLORS[categoryFilter] ?? "#4b5563"}40`,
                padding: "2px 6px",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              {categoryFilter}
              <button
                type="button"
                onClick={() => onCategoryFilter(null)}
                style={{ border: "none", background: "none", cursor: "pointer", padding: "0", display: "flex", color: "inherit" }}
              >
                <X size={9} weight="bold" />
              </button>
            </span>
          </div>
        )}

        {tree.length === 0 && !uploading && !hasPending && starredReceipts.length === 0 ? (
          <div
            style={{
              padding: "24px 12px",
              textAlign: "center",
              color: "var(--color-text-tertiary)",
              fontSize: "12px",
            }}
          >
            No receipts yet
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
            <style>{`@keyframes shimmer-pulse { 0%,100% { opacity:1 } 50% { opacity:0.35 } }`}</style>

            {/* Pending upload rows */}
            {pendingEntries.map(([tempId, filename]) => (
              <div
                key={tempId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "5px 12px",
                  borderRadius: "6px",
                  backgroundColor: "rgba(27,119,190,0.05)",
                  animation: "shimmer-pulse 1.2s ease-in-out infinite",
                }}
              >
                <div
                  style={{
                    width: "14px",
                    height: "14px",
                    borderRadius: "3px",
                    backgroundColor: "var(--color-warm-gray-200)",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: "12px",
                    fontFamily: "var(--font-ibm-plex-mono), monospace",
                    color: "var(--color-brand)",
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flex: 1,
                  }}
                >
                  {filename.length > 24 ? `${filename.slice(0, 21)}...` : filename}
                </span>
                <span
                  style={{
                    fontSize: "10px",
                    color: "var(--color-brand)",
                    fontWeight: 500,
                  }}
                >
                  Analyzing...
                </span>
              </div>
            ))}

            {/* Legacy shimmer when uploading but no pending entries tracked */}
            {uploading && pendingEntries.length === 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "5px 12px 5px 12px",
                  borderRadius: "6px",
                  backgroundColor: "rgba(27,119,190,0.05)",
                  animation: "shimmer-pulse 1.2s ease-in-out infinite",
                }}
              >
                <div style={{ width: "14px", height: "14px", borderRadius: "3px", backgroundColor: "var(--color-warm-gray-200)", flexShrink: 0 }} />
                <span
                  style={{
                    fontSize: "12px",
                    fontFamily: "var(--font-ibm-plex-mono), monospace",
                    color: "var(--color-brand)",
                    fontWeight: 500,
                  }}
                >
                  Analyzing...
                </span>
              </div>
            )}

            {/* Starred virtual folder */}
            <StarredFolder
              receipts={starredReceipts}
              selectedId={selectedId}
              onSelect={onSelect}
              openFolders={openFolders}
              onToggle={onToggleFolder}
              onStarToggle={onStarToggle}
              onArchiveToggle={onArchiveToggle}
              bulkSelectedIds={bulkSelectedIds}
              onBulkSelect={onBulkSelect}
            />

            {/* Main tree */}
            {tree.map((node) => (
              <TreeNodeRenderer
                key={node.key}
                node={node}
                selectedId={selectedId}
                onSelect={onSelect}
                openFolders={openFolders}
                onToggle={onToggleFolder}
                depth={0}
                onStarToggle={onStarToggle}
                onArchiveToggle={onArchiveToggle}
                bulkSelectedIds={bulkSelectedIds}
                onBulkSelect={onBulkSelect}
                pendingUploads={pendingUploads}
              />
            ))}

            {/* Archived section */}
            <ArchivedSection
              receipts={archivedReceipts}
              selectedId={selectedId}
              onSelect={onSelect}
              openFolders={openFolders}
              onToggle={onToggleFolder}
              onArchiveToggle={onArchiveToggle}
              bulkSelectedIds={bulkSelectedIds}
              onBulkSelect={onBulkSelect}
            />
          </div>
        )}
      </div>

      {/* Footer: upload button or queue */}
      <div
        style={{
          padding: "10px 12px",
          borderTop: "1px solid var(--color-warm-gray-200)",
        }}
      >
        {pendingUploads.size > 1 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {pendingEntries.slice(0, 3).map(([tempId, filename]) => (
              <div
                key={tempId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 6px",
                  borderRadius: "5px",
                  backgroundColor: "rgba(27,119,190,0.05)",
                }}
              >
                <div
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    border: "2px solid var(--color-brand)",
                    borderTopColor: "transparent",
                    animation: "spin 0.8s linear infinite",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: "11px",
                    fontFamily: "var(--font-ibm-plex-mono), monospace",
                    color: "var(--color-text-secondary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flex: 1,
                  }}
                >
                  {filename.length > 20 ? `${filename.slice(0, 17)}...` : filename}
                </span>
              </div>
            ))}
            <span
              style={{
                fontSize: "10px",
                color: "var(--color-text-tertiary)",
                textAlign: "center",
                paddingTop: "2px",
              }}
            >
              Uploading {pendingUploads.size} files...
            </span>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <button
            type="button"
            onClick={onUploadClick}
            disabled={uploading}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              width: "100%",
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid var(--color-warm-gray-200)",
              backgroundColor: "var(--color-white)",
              color: "var(--color-text-secondary)",
              fontSize: "12.5px",
              fontWeight: 600,
              cursor: uploading ? "not-allowed" : "pointer",
              opacity: uploading ? 0.6 : 1,
              transition: "background-color 120ms ease, border-color 120ms ease",
            }}
            onMouseEnter={(e) => {
              if (!uploading) {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--color-warm-gray-100)";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-warm-gray-400)";
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--color-white)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-warm-gray-200)";
            }}
          >
            <UploadSimple size={13} weight="bold" />
            {uploading ? "Uploading..." : uploadLabel}
          </button>
        )}
      </div>
    </div>
  );
}
