"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  SlidersHorizontal,
  DotsSixVertical,
  Bed,
  Bathtub,
  Users as UsersIcon,
  Ruler,
  CheckCircle,
  Circle,
  X,
  Plus,
} from "@phosphor-icons/react";
import { homeTypeLabels } from "@/lib/labels";
import type { PropertyRowData } from "./types";

const STORAGE_KEY = "proxy_property_table_columns_v1";

type ColumnId = "status" | "type" | "bedrooms" | "bathrooms" | "guests" | "sqft";

const ALL_COLUMNS: Array<{ id: ColumnId; label: string }> = [
  { id: "status", label: "Status" },
  { id: "type", label: "Type" },
  { id: "bedrooms", label: "Bedrooms" },
  { id: "bathrooms", label: "Bathrooms" },
  { id: "guests", label: "Guests" },
  { id: "sqft", label: "Square feet" },
];

const DEFAULT_ENABLED: ColumnId[] = ["status", "type", "bedrooms", "bathrooms", "guests"];

type ColPrefs = { order: ColumnId[]; enabled: Set<ColumnId> };

function loadPrefs(): ColPrefs {
  if (typeof window === "undefined") {
    return { order: DEFAULT_ENABLED, enabled: new Set(DEFAULT_ENABLED) };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error("no prefs");
    const parsed = JSON.parse(raw) as { order: ColumnId[]; enabled: ColumnId[] };
    const validIds = new Set(ALL_COLUMNS.map((c) => c.id));
    const order = parsed.order.filter((id) => validIds.has(id));
    const enabled = new Set(parsed.enabled.filter((id) => validIds.has(id)) as ColumnId[]);
    return { order, enabled };
  } catch {
    return { order: ALL_COLUMNS.map((c) => c.id), enabled: new Set(DEFAULT_ENABLED) };
  }
}

function savePrefs(prefs: ColPrefs) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ order: prefs.order, enabled: Array.from(prefs.enabled) }),
  );
}

/** Thumbnail at 38px showing the property image or a brand gradient */
function Thumbnail({ property }: { property: PropertyRowData }) {
  const url =
    property.imageSource === "aerial"
      ? property.aerialUrl
      : property.imageSource === "street"
        ? property.streetUrl
        : property.coverPhotoUrl;

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={property.address}
        className="h-[38px] w-[38px] shrink-0 rounded-md object-cover"
        loading="lazy"
      />
    );
  }
  return (
    <div
      className="h-[38px] w-[38px] shrink-0 rounded-md"
      style={{
        background: "linear-gradient(135deg, #1B77BE 0%, #02AAEB 55%, #72CFF5 100%)",
      }}
    />
  );
}

export function PropertyTable({ properties }: { properties: PropertyRowData[] }) {
  const [prefs, setPrefs] = useState<ColPrefs>(() => loadPrefs());
  const [panelOpen, setPanelOpen] = useState(false);
  const [dragOver, setDragOver] = useState<ColumnId | null>(null);
  const dragItem = useRef<ColumnId | null>(null);

  useEffect(() => {
    savePrefs(prefs);
  }, [prefs]);

  const visibleColumns = prefs.order.filter((id) => prefs.enabled.has(id));

  function toggleColumn(id: ColumnId) {
    setPrefs((prev) => {
      const next = new Set(prev.enabled);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { ...prev, enabled: next };
    });
  }

  function onDragStart(id: ColumnId) {
    dragItem.current = id;
  }

  function onDragEnter(id: ColumnId) {
    setDragOver(id);
  }

  function onDrop(targetId: ColumnId) {
    const from = dragItem.current;
    if (!from || from === targetId) {
      setDragOver(null);
      return;
    }
    setPrefs((prev) => {
      const order = [...prev.order];
      const fromIdx = order.indexOf(from);
      const toIdx = order.indexOf(targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      order.splice(fromIdx, 1);
      order.splice(toIdx, 0, from);
      return { ...prev, order };
    });
    dragItem.current = null;
    setDragOver(null);
  }

  function renderCell(col: ColumnId, p: PropertyRowData): React.ReactNode {
    switch (col) {
      case "status":
        return (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{
              backgroundColor: p.active
                ? "rgba(22, 163, 74, 0.12)"
                : "rgba(100, 116, 139, 0.10)",
              color: p.active ? "#15803d" : "#4b4948",
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: p.active ? "#16a34a" : "#94a3b8" }}
            />
            {p.active ? "Active" : "Paused"}
          </span>
        );
      case "type":
        return (
          <span style={{ color: "var(--color-text-secondary)" }}>
            {p.homeType ? (homeTypeLabels[p.homeType] ?? p.homeType) : "—"}
          </span>
        );
      case "bedrooms":
        return (
          <span className="tabular-nums" style={{ color: "var(--color-text-secondary)" }}>
            {p.bedrooms ?? "—"}
          </span>
        );
      case "bathrooms":
        return (
          <span className="tabular-nums" style={{ color: "var(--color-text-secondary)" }}>
            {p.bathrooms ?? "—"}
          </span>
        );
      case "guests":
        return (
          <span className="tabular-nums" style={{ color: "var(--color-text-secondary)" }}>
            {p.guests ?? "—"}
          </span>
        );
      case "sqft":
        return (
          <span className="tabular-nums" style={{ color: "var(--color-text-secondary)" }}>
            {p.sqft != null ? p.sqft.toLocaleString() : "—"}
          </span>
        );
    }
  }

  function colIcon(id: ColumnId) {
    switch (id) {
      case "bedrooms": return <Bed size={12} weight="duotone" />;
      case "bathrooms": return <Bathtub size={12} weight="duotone" />;
      case "guests": return <UsersIcon size={12} weight="duotone" />;
      case "sqft": return <Ruler size={12} weight="duotone" />;
      default: return null;
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Mobile table — address + status only, no controls */}
      <div
        className="overflow-hidden rounded-xl sm:hidden"
        style={{ border: "1px solid var(--color-warm-gray-200)" }}
      >
        <table className="w-full border-collapse text-left">
          <thead>
            <tr
              style={{
                borderBottom: "1px solid var(--color-warm-gray-200)",
                backgroundColor: "var(--color-warm-gray-50)",
              }}
            >
              <th
                className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.10em]"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                Address
              </th>
              <th
                className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.10em]"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {properties.map((p, i) => (
              <tr
                key={p.id}
                className="group transition-colors hover:bg-[var(--color-warm-gray-50)]"
                style={{
                  borderBottom:
                    i < properties.length - 1
                      ? "1px solid var(--color-warm-gray-100)"
                      : "none",
                }}
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/workspace/properties/${p.id}`}
                    className="flex items-center gap-3 focus-visible:outline-none"
                  >
                    <Thumbnail property={p} />
                    <div className="min-w-0">
                      <p
                        className="truncate text-[13px] font-semibold leading-tight group-hover:underline"
                        style={{ color: "var(--color-text-primary)" }}
                      >
                        {p.address}
                      </p>
                      {(p.city || p.state) && (
                        <p
                          className="mt-0.5 truncate text-[11px]"
                          style={{ color: "var(--color-text-tertiary)" }}
                        >
                          {[p.city, p.state].filter(Boolean).join(", ")}
                        </p>
                      )}
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={{
                      backgroundColor: p.active
                        ? "rgba(22, 163, 74, 0.12)"
                        : "rgba(100, 116, 139, 0.10)",
                      color: p.active ? "#15803d" : "#4b4948",
                    }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: p.active ? "#16a34a" : "#94a3b8" }}
                    />
                    {p.active ? "Active" : "Paused"}
                  </span>
                </td>
              </tr>
            ))}
            <tr
              className="group transition-colors hover:bg-[var(--color-warm-gray-50)]"
              style={{ borderTop: "1px solid var(--color-warm-gray-100)" }}
            >
              <td className="px-4 py-3" colSpan={2}>
                <Link
                  href="/workspace/setup/basics"
                  className="inline-flex items-center gap-2 text-[13px] font-medium transition-colors"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full transition-colors group-hover:bg-[rgba(2,170,235,0.1)]"
                    style={{ backgroundColor: "var(--color-warm-gray-100)" }}
                  >
                    <Plus size={12} weight="bold" className="group-hover:text-[var(--color-brand)]" />
                  </span>
                  <span className="group-hover:text-[var(--color-brand)]">Add property</span>
                </Link>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Desktop table — full features */}
      {/* Toolbar */}
      <div className="hidden sm:flex items-center justify-end">
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors"
          style={{
            backgroundColor: panelOpen ? "rgba(2,170,235,0.08)" : "var(--color-warm-gray-100)",
            color: panelOpen ? "var(--color-brand)" : "var(--color-text-secondary)",
            border: panelOpen
              ? "1px solid rgba(2,170,235,0.25)"
              : "1px solid var(--color-warm-gray-200)",
          }}
        >
          <SlidersHorizontal size={13} weight="bold" />
          Customize columns
        </button>
      </div>

      {/* Column customization panel — desktop only */}
      {panelOpen && (
        <div
          className="hidden flex-col gap-0 overflow-hidden rounded-xl sm:flex"
          style={{ border: "1px solid var(--color-warm-gray-200)" }}
        >
          <div
            className="flex items-center justify-between px-4 py-2.5"
            style={{ borderBottom: "1px solid var(--color-warm-gray-100)" }}
          >
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              Column visibility and order
            </p>
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              className="flex h-5 w-5 items-center justify-center rounded transition-colors hover:bg-[var(--color-warm-gray-100)]"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              <X size={12} weight="bold" />
            </button>
          </div>

          {/* Address — locked row */}
          <div
            className="flex items-center gap-3 px-4 py-2.5"
            style={{ borderBottom: "1px solid var(--color-warm-gray-100)" }}
          >
            <span style={{ color: "var(--color-warm-gray-200)" }}>
              <DotsSixVertical size={14} />
            </span>
            <CheckCircle size={16} weight="fill" style={{ color: "var(--color-brand)" }} />
            <span
              className="text-[13px] font-medium"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Address
            </span>
            <span
              className="ml-auto rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              style={{
                backgroundColor: "var(--color-warm-gray-100)",
                color: "var(--color-text-tertiary)",
              }}
            >
              Locked
            </span>
          </div>

          {/* Draggable column rows */}
          {prefs.order.map((id) => {
            const col = ALL_COLUMNS.find((c) => c.id === id)!;
            const enabled = prefs.enabled.has(id);
            const isDragTarget = dragOver === id;
            return (
              <div
                key={id}
                draggable
                onDragStart={() => onDragStart(id)}
                onDragEnter={() => onDragEnter(id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(id)}
                onDragEnd={() => setDragOver(null)}
                className="flex cursor-grab items-center gap-3 px-4 py-2.5 transition-colors active:cursor-grabbing"
                style={{
                  borderBottom: "1px solid var(--color-warm-gray-100)",
                  backgroundColor: isDragTarget
                    ? "rgba(2,170,235,0.06)"
                    : "transparent",
                }}
              >
                <span style={{ color: "var(--color-warm-gray-300)" }}>
                  <DotsSixVertical size={14} />
                </span>
                <button
                  type="button"
                  onClick={() => toggleColumn(id)}
                  style={{ color: enabled ? "var(--color-brand)" : "var(--color-warm-gray-300)" }}
                >
                  {enabled ? (
                    <CheckCircle size={16} weight="fill" />
                  ) : (
                    <Circle size={16} />
                  )}
                </button>
                <span
                  className="flex items-center gap-1.5 text-[13px]"
                  style={{
                    color: enabled
                      ? "var(--color-text-primary)"
                      : "var(--color-text-tertiary)",
                  }}
                >
                  {colIcon(id)}
                  {col.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Table */}
      <div
        className="hidden overflow-hidden rounded-xl sm:block"
        style={{ border: "1px solid var(--color-warm-gray-200)" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--color-warm-gray-200)",
                  backgroundColor: "var(--color-warm-gray-50)",
                }}
              >
                <th
                  className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.10em]"
                  style={{ color: "var(--color-text-tertiary)", minWidth: 240 }}
                >
                  Address
                </th>
                {visibleColumns.map((id) => (
                  <th
                    key={id}
                    className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.10em] whitespace-nowrap"
                    style={{ color: "var(--color-text-tertiary)" }}
                  >
                    {ALL_COLUMNS.find((c) => c.id === id)?.label ?? id}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {properties.map((p, i) => (
                <tr
                  key={p.id}
                  className="group transition-colors hover:bg-[var(--color-warm-gray-50)]"
                  style={{
                    borderBottom:
                      i < properties.length - 1
                        ? "1px solid var(--color-warm-gray-100)"
                        : "none",
                  }}
                >
                  {/* Address cell with thumbnail */}
                  <td className="px-4 py-3">
                    <Link
                      href={`/workspace/properties/${p.id}`}
                      className="flex items-center gap-3 focus-visible:outline-none"
                    >
                      <Thumbnail property={p} />
                      <div className="min-w-0">
                        <p
                          className="truncate text-[13px] font-semibold leading-tight group-hover:underline"
                          style={{ color: "var(--color-text-primary)" }}
                        >
                          {p.address}
                        </p>
                        {(p.city || p.state) && (
                          <p
                            className="mt-0.5 truncate text-[11px]"
                            style={{ color: "var(--color-text-tertiary)" }}
                          >
                            {[p.city, p.state].filter(Boolean).join(", ")}
                          </p>
                        )}
                      </div>
                    </Link>
                  </td>
                  {visibleColumns.map((id) => (
                    <td key={id} className="px-4 py-3 text-[13px] whitespace-nowrap">
                      {renderCell(id, p)}
                    </td>
                  ))}
                </tr>
              ))}
              {/* Add property row */}
              <tr
                className="group transition-colors hover:bg-[var(--color-warm-gray-50)]"
                style={{ borderTop: "1px solid var(--color-warm-gray-100)" }}
              >
                <td className="px-4 py-3" colSpan={visibleColumns.length + 1}>
                  <Link
                    href="/workspace/setup/basics"
                    className="inline-flex items-center gap-2 text-[13px] font-medium transition-colors"
                    style={{ color: "var(--color-text-tertiary)" }}
                  >
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full transition-colors group-hover:bg-[rgba(2,170,235,0.1)]"
                      style={{ backgroundColor: "var(--color-warm-gray-100)" }}
                    >
                      <Plus size={12} weight="bold" className="group-hover:text-[var(--color-brand)]" />
                    </span>
                    <span className="group-hover:text-[var(--color-brand)]">Add property</span>
                  </Link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
