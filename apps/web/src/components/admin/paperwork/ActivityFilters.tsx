"use client";

/**
 * ActivityFilters — the shared filter bar above the hub activity tables
 * (Signatures → History, Forms → Responses). One search box plus a row of
 * faceted selects (document / person / status) so the two hubs read the same.
 *
 * Each hub derives its own facet options from its rows and applies the
 * predicate itself; this component only renders the controls.
 */

import { MagnifyingGlass } from "@phosphor-icons/react";
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
        <div className={styles.facets}>
          {facets.map((facet) => (
            <span key={facet.key} className={styles.facet}>
              <CustomSelect
                value={facet.value}
                onChange={facet.onChange}
                options={facet.options}
                placeholder={facet.placeholder}
              />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
