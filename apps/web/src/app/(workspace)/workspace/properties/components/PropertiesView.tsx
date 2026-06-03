"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, SquaresFour, Table } from "@phosphor-icons/react";
import type { PropertyRowData } from "./types";
import { PropertyCard } from "./PropertyCard";
import { PropertyTable } from "./PropertyTable";

export function PropertiesView({
  properties,
}: {
  properties: PropertyRowData[];
}) {
  const [view, setView] = useState<"gallery" | "table">("gallery");

  return (
    <div className="flex flex-col gap-6">
      {/* View toggle */}
      <div className="flex items-center justify-end gap-4">
        {/* Gallery / Table toggle pill */}
        <div
          className="flex items-center rounded-lg p-0.5"
          style={{
            backgroundColor: "var(--color-warm-gray-100)",
            border: "1px solid var(--color-warm-gray-200)",
          }}
        >
          <ToggleBtn
            active={view === "gallery"}
            onClick={() => setView("gallery")}
            icon={<SquaresFour size={15} weight={view === "gallery" ? "fill" : "regular"} />}
            label="Gallery"
          />
          <ToggleBtn
            active={view === "table"}
            onClick={() => setView("table")}
            icon={<Table size={15} weight={view === "table" ? "fill" : "regular"} />}
            label="Table"
          />
        </div>
      </div>

      {view === "gallery" ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {properties.map((p) => (
            <PropertyCard key={p.id} property={p} />
          ))}
          {/* Add property placeholder card */}
          <Link
            href="/workspace/setup/basics"
            className="group flex min-h-[340px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed transition-colors duration-200 hover:border-[var(--color-brand)]"
            style={{ borderColor: "var(--color-warm-gray-200)" }}
          >
            <span
              className="flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-200 group-hover:bg-[rgba(2,170,235,0.1)]"
              style={{ backgroundColor: "var(--color-warm-gray-100)" }}
            >
              <Plus
                size={18}
                weight="bold"
                style={{ color: "var(--color-text-tertiary)" }}
                className="group-hover:text-[var(--color-brand)]"
              />
            </span>
            <span
              className="text-[13px] font-medium transition-colors duration-200 group-hover:text-[var(--color-brand)]"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              Add property
            </span>
          </Link>
        </div>
      ) : (
        <PropertyTable properties={properties} />
      )}
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-all duration-150"
      style={{
        backgroundColor: active ? "var(--color-white)" : "transparent",
        color: active ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
        boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)" : "none",
      }}
    >
      {icon}
      {label}
    </button>
  );
}
