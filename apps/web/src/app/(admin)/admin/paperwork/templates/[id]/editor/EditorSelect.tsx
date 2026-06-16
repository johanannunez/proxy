"use client";

/**
 * EditorSelect — a compact dropdown select for the document toolbar whose menu
 * is portal-rendered to document.body (so it is never clipped by the toolbar).
 *
 * Selection preservation: the trigger and every option use onMouseDown +
 * preventDefault rather than onClick. This keeps the Plate editor from blurring,
 * so the chosen mark (font family, size, weight, line height, block type)
 * applies to the live text selection. This matches the existing toolbar buttons
 * (Btn) and color swatches, which are mouse-first by the same necessity.
 */

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CaretDown, Check } from "@phosphor-icons/react";
import { useFloatingPosition, useFloatingDismiss } from "./floating";
import styles from "./EditorSelect.module.css";

export type EditorSelectOption = { value: string; label: string };

export function EditorSelect({
  value,
  options,
  onChange,
  placeholder = "Select",
  width,
  ariaLabel,
}: {
  value: string;
  options: EditorSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  /** Fixed trigger width in px, sized so the label never truncates. */
  width: number;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const coords = useFloatingPosition(triggerRef, menuRef, open, {
    align: "start",
  });
  useFloatingDismiss(open, () => setOpen(false), [triggerRef]);

  const current = options.find((o) => o.value === value);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        style={{ width }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        title={ariaLabel}
        onMouseDown={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
      >
        <span className={`${styles.label} ${current || value ? "" : styles.placeholder}`}>
          {current?.label ?? (value || placeholder)}
        </span>
        <CaretDown
          size={11}
          weight="bold"
          className={styles.caret}
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              className={styles.menu}
              data-editor-floating
              role="listbox"
              aria-label={ariaLabel}
              style={{
                top: coords?.top ?? 0,
                left: coords?.left ?? 0,
                minWidth: width,
                visibility: coords ? "visible" : "hidden",
              }}
            >
              {options.map((opt) => {
                const selected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`${styles.option} ${selected ? styles.optionSelected : ""}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onChange(opt.value);
                      setOpen(false);
                    }}
                  >
                    <span className={styles.optionLabel}>{opt.label}</span>
                    {selected ? (
                      <Check size={12} weight="bold" className={styles.optionCheck} />
                    ) : null}
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
