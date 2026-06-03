"use client";

import { useState } from "react";
import {
  FilePdf,
  FileImage,
  File,
  FolderOpen,
  Folder,
  CaretRight,
  UploadSimple,
} from "@phosphor-icons/react";
import type { TreeNode, OwnerReceiptRow } from "./receipts-types";

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

function FileNodeRow({
  receipt,
  ext,
  isSelected,
  onSelect,
  depth,
}: {
  receipt: OwnerReceiptRow;
  ext: string | null;
  isSelected: boolean;
  onSelect: () => void;
  depth: number;
}) {
  const [hovered, setHovered] = useState(false);
  const { Icon, color } = getFileIcon(ext);
  const needsReview = !receipt.reviewed_at;

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
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
        border: "none",
        cursor: "pointer",
        textAlign: "left",
        position: "relative",
        backgroundColor: isSelected
          ? "rgba(27, 119, 190, 0.08)"
          : hovered
          ? "var(--color-warm-gray-100)"
          : "transparent",
        transition: "background-color 100ms ease",
      }}
    >
      {isSelected && (
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
  );
}

function FolderRow({
  label,
  isOpen,
  depth,
  onToggle,
}: {
  label: string;
  isOpen: boolean;
  depth: number;
  onToggle: () => void;
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
      {isOpen ? (
        <FolderOpen size={14} weight="duotone" color="#f59e0b" style={{ flexShrink: 0 }} />
      ) : (
        <Folder size={14} weight="duotone" color="#f59e0b" style={{ flexShrink: 0 }} />
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
}: {
  node: TreeNode;
  selectedId: string | null;
  onSelect: (id: string) => void;
  openFolders: Set<string>;
  onToggle: (key: string) => void;
  depth: number;
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
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <FileNodeRow
      receipt={node.receipt}
      ext={node.extension}
      isSelected={selectedId === node.receipt.id}
      onSelect={() => onSelect(node.receipt.id)}
      depth={depth}
    />
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
  uploadLabel = "Upload receipt",
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
}) {
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
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "8px 6px",
        }}
      >
        {tree.length === 0 && !uploading ? (
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
            {uploading && (
              <>
                <style>{`@keyframes shimmer-pulse { 0%,100% { opacity:1 } 50% { opacity:0.35 } }`}</style>
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
                    Analyzing…
                  </span>
                </div>
              </>
            )}
            {tree.map((node) => (
              <TreeNodeRenderer
                key={node.key}
                node={node}
                selectedId={selectedId}
                onSelect={onSelect}
                openFolders={openFolders}
                onToggle={onToggleFolder}
                depth={0}
              />
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          padding: "10px 12px",
          borderTop: "1px solid var(--color-warm-gray-200)",
        }}
      >
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
          {uploading ? "Uploading…" : uploadLabel}
        </button>
      </div>
    </div>
  );
}
