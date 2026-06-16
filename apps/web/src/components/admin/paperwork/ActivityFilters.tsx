"use client";

/**
 * ActivityFilters — the shared filter bar above the hub activity tables
 * (Signatures → History, Forms → Responses). One search box plus a row of
 * faceted selects (document / person / status) so the two hubs read the same.
 *
 * Each hub derives its own facet options from its rows and applies the
 * predicate itself; this component only renders the controls.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { CaretDown, MagnifyingGlass, SlidersHorizontal, X } from "@phosphor-icons/react";
import { CustomSelect, type SelectOption } from "@/components/admin/CustomSelect";
import styles from "./ActivityFilters.module.css";

export type ActivityFacet = {
  key: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
};

export function ActivityFilters({
  search,
  onSearch,
  searchPlaceholder = "Search…",
  searchAriaLabel = "Search activity",
  facets,
}: {
  search: string;
  onSearch: (value: string) => void;
  searchPlaceholder?: string;
  searchAriaLabel?: string;
  facets: ActivityFacet[];
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const activeCount = useMemo(
    () => facets.filter((facet) => facet.value !== "").length,
    [facets],
  );

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (panelRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function clearFilters() {
    for (const facet of facets) {
      facet.onChange("");
    }
  }

  return (
    <div className={styles.bar}>
      <span className={styles.searchWrap}>
        <MagnifyingGlass size={14} weight="bold" className={styles.searchIcon} />
        <input
          type="text"
          className={styles.searchInput}
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          aria-label={searchAriaLabel}
        />
      </span>
      {facets.length > 0 && (
        <div className={styles.filterMenu} ref={panelRef}>
          <button
            type="button"
            className={styles.filterButton}
            aria-expanded={open}
            aria-haspopup="dialog"
            onClick={() => setOpen((next) => !next)}
          >
            <SlidersHorizontal size={15} weight="bold" />
            Filters
            {activeCount > 0 ? <span className={styles.filterCount}>{activeCount}</span> : null}
            <CaretDown
              size={12}
              weight="bold"
              className={`${styles.filterCaret} ${open ? styles.filterCaretOpen : ""}`}
            />
          </button>
          {open ? (
            <div className={styles.filterPanel} role="dialog" aria-label="Activity filters">
              <div className={styles.filterPanelHead}>
                <span>Filters</span>
                {activeCount > 0 ? (
                  <button
                    type="button"
                    className={styles.clearButton}
                    onClick={clearFilters}
                  >
                    <X size={12} weight="bold" />
                    Clear
                  </button>
                ) : null}
              </div>
              <div className={styles.facets}>
                {facets.map((facet) => (
                  <label key={facet.key} className={styles.facet}>
                    <span className={styles.facetLabel}>{facet.placeholder}</span>
                    <CustomSelect
                      value={facet.value}
                      onChange={facet.onChange}
                      options={facet.options}
                      placeholder={facet.placeholder}
                    />
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
