"use client";

/**
 * DocumentSearch — global search in the paperwork hub header. Debounced 300ms
 * against the searchDocuments server action; results open the DocumentDrawer.
 */
import { useEffect, useRef, useState, useTransition } from "react";
import { CircleNotch, FileText, MagnifyingGlass } from "@phosphor-icons/react";
import { STATUS_LABELS, type DocumentDisplayStatus } from "@/lib/documents/status";
import { searchDocuments, type DocumentSearchResult } from "./search-actions";
import styles from "./DocumentSearch.module.css";

interface DocumentSearchProps {
  onSelect: (result: DocumentSearchResult) => void;
}

function relativeActivity(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days < 1) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} ${months === 1 ? "month" : "months"} ago`;
  const years = Math.round(months / 12);
  return `${years} ${years === 1 ? "year" : "years"} ago`;
}

function statusLabel(status: string): string {
  return STATUS_LABELS[status as DocumentDisplayStatus] ?? status;
}

export function DocumentSearch({ onSelect }: DocumentSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DocumentSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [searched, setSearched] = useState(false);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const requestSeq = useRef(0);

  // Debounced server search. Queries shorter than 2 chars are cleared in
  // handleQueryChange, so the effect only ever schedules real searches.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    const seq = ++requestSeq.current;
    const timer = setTimeout(() => {
      startTransition(async () => {
        const found = await searchDocuments(trimmed);
        if (requestSeq.current !== seq) return; // stale response
        setResults(found);
        setSearched(true);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  function handleQueryChange(value: string) {
    setQuery(value);
    setOpen(true);
    if (value.trim().length < 2) {
      requestSeq.current++;
      setResults([]);
      setSearched(false);
    }
  }

  // Close on outside click.
  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function handleSelect(result: DocumentSearchResult) {
    setOpen(false);
    setQuery("");
    setResults([]);
    setSearched(false);
    onSelect(result);
  }

  const showDropdown = open && query.trim().length >= 2;

  return (
    <div className={styles.root} ref={rootRef}>
      <div className={styles.inputWrap}>
        <MagnifyingGlass size={14} className={styles.searchIcon} aria-hidden="true" />
        <input
          type="text"
          className={styles.input}
          placeholder="Search documents, owners, statuses…"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          aria-label="Search documents"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="paperwork-search-results"
        />
        {pending && (
          <CircleNotch size={13} className={styles.spinner} aria-hidden="true" />
        )}
      </div>

      {showDropdown && (
        <div className={styles.dropdown} id="paperwork-search-results" role="listbox">
          {results.length === 0 ? (
            <div className={styles.emptyRow}>
              {pending || !searched ? "Searching…" : "No documents match that search."}
            </div>
          ) : (
            results.map((r) => (
              <button
                key={r.id}
                type="button"
                role="option"
                aria-selected={false}
                className={styles.resultRow}
                onClick={() => handleSelect(r)}
              >
                <span className={styles.resultIcon}>
                  <FileText size={14} weight="duotone" />
                </span>
                <span className={styles.resultMain}>
                  <span className={styles.resultOwner}>{r.owner_name}</span>
                  <span className={styles.resultTitle}>{r.title}</span>
                </span>
                <span className={styles.resultMeta}>
                  <span className={styles.resultStatus}>{statusLabel(r.status)}</span>
                  <span className={styles.resultActivity}>
                    {relativeActivity(r.updated_at)}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
