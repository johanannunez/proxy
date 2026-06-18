"use client";

import { useState, useEffect, useRef, type KeyboardEvent } from "react";
import {
  TextT,
  TextAlignLeft,
  Hash,
  EnvelopeSimple,
  Phone,
  CalendarBlank,
  RadioButton,
  CheckSquare,
  CaretDown,
  UploadSimple,
  Star,
  Signature,
  TextHTwo,
  AlignLeft,
  Minus,
  Rows,
} from "@phosphor-icons/react";
import type { FormFieldType } from "@/lib/admin/forms-types";
import { FIELD_TYPE_LABELS, INPUT_FIELD_TYPES, LAYOUT_FIELD_TYPES } from "@/lib/admin/forms-types";
import styles from "./FieldCommandPalette.module.css";

type Props = {
  onSelect: (type: FormFieldType) => void;
  onClose: () => void;
};

const FIELD_ICONS: Record<FormFieldType, React.ReactNode> = {
  short_text: <TextT size={14} weight="bold" />,
  long_text: <TextAlignLeft size={14} weight="bold" />,
  number: <Hash size={14} weight="bold" />,
  email: <EnvelopeSimple size={14} weight="bold" />,
  phone: <Phone size={14} weight="bold" />,
  date: <CalendarBlank size={14} weight="bold" />,
  single_choice: <RadioButton size={14} weight="bold" />,
  multiple_choice: <CheckSquare size={14} weight="bold" />,
  dropdown: <CaretDown size={14} weight="bold" />,
  file_upload: <UploadSimple size={14} weight="bold" />,
  rating: <Star size={14} weight="bold" />,
  signature: <Signature size={14} weight="bold" />,
  section_header: <TextHTwo size={14} weight="bold" />,
  description: <AlignLeft size={14} weight="bold" />,
  divider: <Minus size={14} weight="bold" />,
  page_break: <Rows size={14} weight="bold" />,
};

const ALL_TYPES: FormFieldType[] = [...INPUT_FIELD_TYPES, ...LAYOUT_FIELD_TYPES];

export function FieldCommandPalette({ onSelect, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const filtered = ALL_TYPES.filter((t) =>
    FIELD_TYPE_LABELS[t].toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [onClose]);

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[activeIndex]) onSelect(filtered[activeIndex]);
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  const inputTypes = filtered.filter((t) => INPUT_FIELD_TYPES.includes(t));
  const layoutTypes = filtered.filter((t) => LAYOUT_FIELD_TYPES.includes(t));

  return (
    <div className={styles.root} ref={rootRef}>
      <div className={styles.searchRow}>
        <input
          ref={inputRef}
          className={styles.searchInput}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search fields…"
          aria-label="Search field types"
        />
      </div>

      <div className={styles.list}>
        {inputTypes.length > 0 && (
          <>
            <div className={styles.groupLabel}>Input fields</div>
            {inputTypes.map((type) => {
              const gi = filtered.indexOf(type);
              return (
                <button
                  key={type}
                  type="button"
                  className={`${styles.item} ${gi === activeIndex ? styles.itemActive : ""}`}
                  onMouseEnter={() => setActiveIndex(gi)}
                  onClick={() => onSelect(type)}
                >
                  <span className={styles.icon}>{FIELD_ICONS[type]}</span>
                  {FIELD_TYPE_LABELS[type]}
                </button>
              );
            })}
          </>
        )}
        {layoutTypes.length > 0 && (
          <>
            <div className={styles.groupLabel}>Layout</div>
            {layoutTypes.map((type) => {
              const gi = filtered.indexOf(type);
              return (
                <button
                  key={type}
                  type="button"
                  className={`${styles.item} ${gi === activeIndex ? styles.itemActive : ""}`}
                  onMouseEnter={() => setActiveIndex(gi)}
                  onClick={() => onSelect(type)}
                >
                  <span className={styles.icon}>{FIELD_ICONS[type]}</span>
                  {FIELD_TYPE_LABELS[type]}
                </button>
              );
            })}
          </>
        )}
        {filtered.length === 0 && (
          <div className={styles.empty}>No fields match &ldquo;{query}&rdquo;</div>
        )}
      </div>
    </div>
  );
}
