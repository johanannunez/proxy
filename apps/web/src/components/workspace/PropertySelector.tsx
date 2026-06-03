"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CaretDown,
  Check,
  MapPin,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import { formatAddress } from "@/lib/address";

export type PropertyOption = {
  id: string;
  address_line1: string | null;
  address_line2?: string | null;
  city: string | null;
  state: string | null;
  postal_code?: string | null;
  ownerName?: string | null;
  /** Kept for backward compat with callers that still pass it, but no longer used for display. */
  name?: string | null;
};

type PropertySelectorProps = {
  properties: PropertyOption[];
  activeId: string;
  onChange?: (id: string) => void;
  hrefTemplate?: string;
  variant?: "inline" | "bar";
  /** Admin-only: show owner names in the trigger and group by owner in the dropdown */
  showOwner?: boolean;
};

function displayName(p: PropertyOption): string {
  return formatAddress(p) || "Property";
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function displaySub(_prop: PropertyOption): string {
  return "";
}

/** Group properties by owner name, preserving order */
function groupByOwner(props: PropertyOption[]): { owner: string; items: PropertyOption[] }[] {
  const map = new Map<string, PropertyOption[]>();
  for (const p of props) {
    const key = p.ownerName || "Unknown owner";
    const group = map.get(key) ?? [];
    group.push(p);
    map.set(key, group);
  }
  return Array.from(map.entries()).map(([owner, items]) => ({ owner, items }));
}

export function PropertySelector({
  properties,
  activeId,
  onChange,
  hrefTemplate,
  variant = "inline",
  showOwner = false,
}: PropertySelectorProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [focusIdx, setFocusIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const active = properties.find((p) => p.id === activeId) ?? properties[0];
  const showSearch = properties.length >= 5;

  const select = useCallback((id: string) => {
    setOpen(false);
    setSearch("");
    setFocusIdx(-1);
    if (onChange) {
      onChange(id);
    } else if (hrefTemplate) {
      router.push(hrefTemplate.replace("{id}", id));
    }
  }, [onChange, hrefTemplate, router]);

  const filtered =
    showSearch && search.trim()
      ? properties.filter((p) => {
          const q = search.toLowerCase();
          return (
            displayName(p).toLowerCase().includes(q) ||
            displaySub(p).toLowerCase().includes(q)
          );
        })
      : properties;

  // 1 property: static label
  if (properties.length <= 1) {
    if (!active) return null;
    return (
      <div
        className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 ${
          variant === "bar" ? "w-full" : ""
        }`}
        style={{
          backgroundColor: "var(--color-warm-gray-50)",
          color: "var(--color-text-primary)",
        }}
      >
        <MapPin
          size={15}
          weight="duotone"
          style={{ color: "var(--color-brand)", flexShrink: 0 }}
        />
        <span className="text-sm font-medium">{displayName(active)}</span>
        {displaySub(active) && (
          <span
            className="text-xs"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {displaySub(active)}
          </span>
        )}
      </div>
    );
  }

  // Close on outside click
  /* eslint-disable react-hooks/rules-of-hooks */
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setSearch("");
        setFocusIdx(-1);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Focus search when opening
  useEffect(() => {
    if (open && showSearch) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open, showSearch]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusIdx >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll("[data-option]");
      items[focusIdx]?.scrollIntoView({ block: "nearest" });
    }
  }, [focusIdx]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
          e.preventDefault();
          setOpen(true);
          return;
        }
        return;
      }

      switch (e.key) {
        case "Escape":
          e.preventDefault();
          setOpen(false);
          setSearch("");
          setFocusIdx(-1);
          buttonRef.current?.focus();
          break;
        case "ArrowDown":
          e.preventDefault();
          setFocusIdx((prev) =>
            prev < filtered.length - 1 ? prev + 1 : 0,
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setFocusIdx((prev) =>
            prev > 0 ? prev - 1 : filtered.length - 1,
          );
          break;
        case "Enter":
          e.preventDefault();
          if (focusIdx >= 0 && focusIdx < filtered.length) {
            select(filtered[focusIdx].id);
          }
          break;
      }
    },
    [open, filtered, focusIdx, select],
  );
  /* eslint-enable react-hooks/rules-of-hooks */

  return (
    <div
      ref={containerRef}
      className={`relative ${variant === "bar" ? "w-full" : "inline-block"}`}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors duration-150 hover:bg-[var(--color-warm-gray-50)] ${
          variant === "bar" ? "w-full" : ""
        }`}
        style={{
          backgroundColor: "var(--color-white)",
          borderColor: open
            ? "var(--color-brand)"
            : "var(--color-warm-gray-200)",
          color: "var(--color-text-primary)",
        }}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <MapPin
          size={15}
          weight="duotone"
          style={{ color: "var(--color-brand)", flexShrink: 0 }}
        />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate text-sm font-medium">
            {active ? displayName(active) : "Select property"}
          </span>
          {active && displaySub(active) && (
            <span
              className="hidden truncate text-xs sm:inline"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              {displaySub(active)}
            </span>
          )}
          {showOwner && active?.ownerName && (
            <span
              className="hidden shrink-0 truncate rounded-full px-2 py-0.5 text-[11px] font-medium sm:inline"
              style={{
                backgroundColor: "var(--color-warm-gray-100)",
                color: "var(--color-text-secondary)",
              }}
            >
              {active.ownerName}
            </span>
          )}
        </div>
        <CaretDown
          size={14}
          weight="bold"
          className="shrink-0 transition-transform duration-150"
          style={{
            color: "var(--color-text-tertiary)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute left-0 z-50 mt-1.5 w-full min-w-[280px] overflow-hidden rounded-xl border"
          style={{
            backgroundColor: "var(--color-white)",
            borderColor: "var(--color-warm-gray-200)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          {/* Search input (5+ properties) */}
          {showSearch && (
            <div
              className="border-b px-3 py-2"
              style={{ borderColor: "var(--color-warm-gray-100)" }}
            >
              <div
                className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5"
                style={{
                  borderColor: "var(--color-warm-gray-200)",
                  backgroundColor: "var(--color-warm-gray-50)",
                }}
              >
                <MagnifyingGlass
                  size={14}
                  weight="bold"
                  style={{ color: "var(--color-text-tertiary)", flexShrink: 0 }}
                />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setFocusIdx(-1);
                  }}
                  placeholder="Search properties..."
                  className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--color-text-tertiary)]"
                  style={{ color: "var(--color-text-primary)" }}
                />
              </div>
            </div>
          )}

          {/* Options list */}
          <ul
            ref={listRef}
            role="listbox"
            className="max-h-[240px] overflow-y-auto py-1"
          >
            {filtered.length === 0 ? (
              <li
                className="px-4 py-3 text-center text-sm"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                No properties found
              </li>
            ) : showOwner ? (
              /* Grouped by owner */
              (() => {
                const groups = groupByOwner(filtered);
                let globalIdx = 0;
                return groups.map((group) => (
                  <li key={group.owner}>
                    <p
                      className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em]"
                      style={{ color: "var(--color-text-tertiary)" }}
                    >
                      {group.owner}
                    </p>
                    <ul>
                      {group.items.map((p) => {
                        const idx = globalIdx++;
                        const isActive = p.id === activeId;
                        const isFocused = idx === focusIdx;
                        return (
                          <li
                            key={p.id}
                            data-option
                            role="option"
                            aria-selected={isActive}
                            className="cursor-pointer px-1.5"
                            onClick={() => select(p.id)}
                            onMouseEnter={() => setFocusIdx(idx)}
                          >
                            <OptionRow p={p} isActive={isActive} isFocused={isFocused} />
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ));
              })()
            ) : (
              /* Flat list */
              filtered.map((p, idx) => {
                const isActive = p.id === activeId;
                const isFocused = idx === focusIdx;
                return (
                  <li
                    key={p.id}
                    data-option
                    role="option"
                    aria-selected={isActive}
                    className="cursor-pointer px-1.5"
                    onClick={() => select(p.id)}
                    onMouseEnter={() => setFocusIdx(idx)}
                  >
                    <OptionRow p={p} isActive={isActive} isFocused={isFocused} />
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function OptionRow({
  p,
  isActive,
  isFocused,
}: {
  p: PropertyOption;
  isActive: boolean;
  isFocused: boolean;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors duration-100"
      style={{
        backgroundColor: isFocused
          ? "var(--color-warm-gray-50)"
          : isActive
            ? "#02aaeb0a"
            : "transparent",
      }}
    >
      <MapPin
        size={15}
        weight="duotone"
        style={{
          color: isActive ? "#02AAEB" : "var(--color-text-tertiary)",
          flexShrink: 0,
        }}
      />
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-sm"
          style={{
            color: isActive ? "#1B77BE" : "var(--color-text-primary)",
            fontWeight: isActive ? 600 : 500,
          }}
        >
          {displayName(p)}
        </p>
        {displaySub(p) && (
          <p
            className="truncate text-[11px]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {displaySub(p)}
          </p>
        )}
      </div>
      {isActive && (
        <Check
          size={14}
          weight="bold"
          style={{ color: "#02AAEB", flexShrink: 0 }}
        />
      )}
    </div>
  );
}
