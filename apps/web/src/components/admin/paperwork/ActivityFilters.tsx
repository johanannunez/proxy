"use client";

/**
 * ActivityFilters: the shared filter bar above the hub activity tables
 * (Signatures, History, Forms, Responses). One search box plus a row of
 * faceted menus so the two hubs read the same.
 *
 * Each hub derives its own facet options from its rows and applies the
 * predicate itself; this component only renders the controls.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CaretDown,
  Check,
  MagnifyingGlass,
  SlidersHorizontal,
  X,
} from "@phosphor-icons/react";
import type { SelectOption } from "@/components/admin/CustomSelect";
import styles from "./ActivityFilters.module.css";

export type ActivityFacet = {
  key: string;
  label?: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
};

function defaultFacetLabel(placeholder: string): string {
  return placeholder.replace(/^All\s+/i, "").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function facetDefaultValue(facet: ActivityFacet): string {
  return facet.options[0]?.value ?? "";
}

function valuesFromFacets(facets: ActivityFacet[]): Record<string, string> {
  return Object.fromEntries(facets.map((facet) => [facet.key, facet.value]));
}

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
  const [scopeOpen, setScopeOpen] = useState(false);
  const [draftValues, setDraftValues] = useState<Record<string, string>>(() =>
    valuesFromFacets(facets),
  );
  const barRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const activeCount = useMemo(
    () => facets.filter((facet) => facet.value !== facetDefaultValue(facet)).length,
    [facets],
  );

  function closeScope(restoreFocus = true) {
    setScopeOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }

  function openScope() {
    setDraftValues(valuesFromFacets(facets));
    setScopeOpen(true);
  }

  useEffect(() => {
    if (!scopeOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (barRef.current?.contains(event.target as Node)) return;
      closeScope(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeScope();
    }
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [scopeOpen]);

  useEffect(() => {
    if (!scopeOpen) return;
    window.setTimeout(() => {
      const firstOption = sheetRef.current?.querySelector<HTMLButtonElement>(
        `.${styles.optionRow}`,
      );
      firstOption?.focus();
    }, 0);
  }, [scopeOpen]);

  function clearDraftScope() {
    setDraftValues(
      Object.fromEntries(facets.map((facet) => [facet.key, facetDefaultValue(facet)])),
    );
  }

  function applyScope() {
    for (const facet of facets) {
      const nextValue = draftValues[facet.key] ?? facetDefaultValue(facet);
      if (nextValue !== facet.value) {
        facet.onChange(nextValue);
      }
    }
    closeScope();
  }

  return (
    <div className={styles.bar} ref={barRef}>
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
        <div className={styles.scopeWrap}>
          <button
            ref={triggerRef}
            type="button"
            className={`${styles.scopeButton} ${activeCount > 0 ? styles.scopeButtonActive : ""}`}
            aria-haspopup="dialog"
            aria-expanded={scopeOpen}
            onClick={() => (scopeOpen ? closeScope(false) : openScope())}
          >
            <SlidersHorizontal size={14} weight="bold" />
            Scope
            {activeCount > 0 ? <span className={styles.scopeCount}>{activeCount}</span> : null}
            <CaretDown
              size={12}
              weight="bold"
              className={`${styles.scopeCaret} ${scopeOpen ? styles.scopeCaretOpen : ""}`}
            />
          </button>
          {scopeOpen ? (
            <div
              ref={sheetRef}
              className={styles.scopeSheet}
              role="dialog"
              aria-label="Activity scope"
              aria-modal="false"
            >
              <div className={styles.sheetHeader}>
                <span>
                  <span className={styles.sheetTitle}>Scope</span>
                  <span className={styles.sheetSubtitle}>Filter this activity view</span>
                </span>
                <button
                  type="button"
                  className={styles.closeButton}
                  onClick={() => closeScope()}
                  aria-label="Close scope"
                >
                  <X size={14} weight="bold" />
                </button>
              </div>
              <div className={styles.sheetBody}>
                {facets.map((facet) => {
                  const label = facet.label ?? defaultFacetLabel(facet.placeholder);
                  const draftValue = draftValues[facet.key] ?? facetDefaultValue(facet);

                  return (
                    <section key={facet.key} className={styles.scopeSection}>
                      <h3 className={styles.sectionTitle}>{label}</h3>
                      <div className={styles.optionList} role="listbox" aria-label={label}>
                        {facet.options.map((option) => {
                          const selected = option.value === draftValue;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              role="option"
                              aria-selected={selected}
                              className={`${styles.optionRow} ${
                                selected ? styles.optionRowActive : ""
                              }`}
                              onClick={() =>
                                setDraftValues((current) => ({
                                  ...current,
                                  [facet.key]: option.value,
                                }))
                              }
                            >
                              <span className={styles.optionLabel}>{option.label}</span>
                              <span className={styles.optionCheck} aria-hidden>
                                {selected ? <Check size={13} weight="bold" /> : null}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
              <div className={styles.sheetFooter}>
                <button
                  type="button"
                  className={styles.clearButton}
                  onClick={clearDraftScope}
                >
                  Clear scope
                </button>
                <button type="button" className={styles.applyButton} onClick={applyScope}>
                  Apply
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
