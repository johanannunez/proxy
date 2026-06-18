"use client";

import type { OwnerReceiptRow } from "./receipts-types";

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

function catColor(category: string): string {
  return CAT_COLORS[category] ?? CAT_COLORS["Other"];
}

function groupByMonth(receipts: OwnerReceiptRow[]): { key: string; label: string; total: number; items: OwnerReceiptRow[] }[] {
  const map = new Map<string, { label: string; total: number; items: OwnerReceiptRow[] }>();

  for (const r of receipts) {
    if (r.archived_at) continue;
    const date = new Date(`${r.purchase_date}T12:00:00`);
    if (Number.isNaN(date.getTime())) continue;
    const year = date.getFullYear();
    const month = date.getMonth();
    const key = `${year}-${String(month + 1).padStart(2, "0")}`;
    const label = date.toLocaleDateString("en-US", { month: "long", year: "numeric" });

    if (!map.has(key)) {
      map.set(key, { label, total: 0, items: [] });
    }
    const group = map.get(key)!;
    group.total += Number(r.amount);
    group.items.push(r);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([key, value]) => ({ key, ...value }));
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}

function formatDate(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ReceiptCard({
  receipt,
  selected,
  onSelect,
}: {
  receipt: OwnerReceiptRow;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const dot = catColor(receipt.category);

  return (
    <button
      type="button"
      onClick={() => onSelect(receipt.id)}
      style={{
        width: "160px",
        flexShrink: 0,
        backgroundColor: selected ? "rgba(27, 119, 190, 0.06)" : "var(--color-white)",
        border: `1px solid ${selected ? "var(--color-brand)" : "var(--color-warm-gray-200)"}`,
        borderRadius: "10px",
        padding: "12px",
        cursor: "pointer",
        textAlign: "left",
        transition: "border-color 100ms ease, background-color 100ms ease",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        outline: "none",
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-warm-gray-400, #9ca3af)";
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-warm-gray-200)";
        }
      }}
    >
      <div
        style={{
          fontSize: "13px",
          fontWeight: 600,
          color: "var(--color-text-primary)",
          lineHeight: "1.3",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {receipt.vendor}
      </div>

      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          backgroundColor: "rgba(27, 119, 190, 0.10)",
          borderRadius: "5px",
          padding: "2px 7px",
          alignSelf: "flex-start",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-ibm-plex-mono)",
            fontSize: "11px",
            fontWeight: 700,
            color: "var(--color-brand)",
            letterSpacing: "0.01em",
          }}
        >
          {new Intl.NumberFormat("en-US", { style: "currency", currency: receipt.currency ?? "USD" }).format(Number(receipt.amount))}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
        <span
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            backgroundColor: dot,
            flexShrink: 0,
            display: "inline-block",
          }}
        />
        <span
          style={{
            fontSize: "11px",
            color: "var(--color-text-secondary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {receipt.category}
        </span>
      </div>

      <div style={{ fontSize: "10px", color: "var(--color-text-tertiary)" }}>
        {formatDate(receipt.purchase_date)}
      </div>
    </button>
  );
}

export function ReceiptsTimeline({
  receipts,
  selectedId,
  onSelect,
}: {
  receipts: OwnerReceiptRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const groups = groupByMonth(receipts);

  if (groups.length === 0 || groups.every((g) => g.items.length === 0)) {
    return (
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          backgroundColor: "var(--color-warm-gray-50)",
          padding: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontSize: "14px", color: "var(--color-text-tertiary)" }}>No documents</span>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        backgroundColor: "var(--color-warm-gray-50)",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "0px",
      }}
    >
      {groups.map((group, gi) => (
        <div
          key={group.key}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "16px",
            paddingBottom: gi < groups.length - 1 ? "20px" : "0px",
          }}
        >
          <div
            style={{
              width: "120px",
              flexShrink: 0,
              paddingTop: "10px",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-ibm-plex-mono)",
                fontSize: "11px",
                fontWeight: 700,
                color: "var(--color-text-tertiary)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                lineHeight: "1.2",
              }}
            >
              {group.label}
            </div>
            <div
              style={{
                marginTop: "4px",
                fontSize: "14px",
                fontWeight: 700,
                color: "var(--color-brand)",
                letterSpacing: "-0.01em",
              }}
            >
              {formatCurrency(group.total)}
            </div>
            <div
              style={{
                marginTop: "2px",
                fontSize: "11px",
                color: "var(--color-text-tertiary)",
              }}
            >
              {group.items.length} {group.items.length === 1 ? "item" : "items"}
            </div>
          </div>

          <div
            style={{
              flex: 1,
              minWidth: 0,
              overflowX: "auto",
              display: "flex",
              flexDirection: "row",
              gap: "10px",
              padding: "4px 2px 8px",
            }}
          >
            {group.items.map((receipt) => (
              <ReceiptCard
                key={receipt.id}
                receipt={receipt}
                selected={selectedId === receipt.id}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
