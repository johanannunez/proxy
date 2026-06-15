"use client";

/**
 * CardActionMenu — a compact "⋯" overflow menu for secondary card actions.
 *
 * Built so a dense card footer (Edit + Send) never has to compete with three
 * icon buttons (copy / duplicate / archive) and wrap to a second line. The
 * secondary actions collapse into a portalled popover anchored to the trigger.
 *
 * Mirrors the positioning + dismissal model of chrome/CreateMenu: fixed-position
 * portal (escapes any card overflow clipping), outside-click close, Escape, and
 * roving focus with ArrowUp/Down/Home/End for keyboard users.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { DotsThree } from "@phosphor-icons/react";
import styles from "./CardActionMenu.module.css";

export type CardMenuItem = {
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  danger?: boolean;
};

const MENU_WIDTH = 190;
const GAP = 6;

export function CardActionMenu({
  items,
  label = "More actions",
}: {
  items: CardMenuItem[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const update = () => {
      const rect = btnRef.current!.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let top = rect.bottom + GAP;
      let left = rect.right - MENU_WIDTH;
      // Flip above the trigger if there isn't room below.
      const estHeight = items.length * 34 + 12;
      if (top + estHeight > vh - 8) top = Math.max(8, rect.top - GAP - estHeight);
      if (left < 8) left = 8;
      if (left + MENU_WIDTH > vw - 8) left = vw - MENU_WIDTH - 8;
      setCoords({ top, left });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, items.length]);

  // Focus the first item once the menu is positioned.
  useEffect(() => {
    if (!open || !coords) return;
    const id = requestAnimationFrame(() => itemRefs.current[0]?.focus());
    return () => cancelAnimationFrame(id);
  }, [open, coords]);

  // Outside click closes.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    btnRef.current?.focus();
  }, []);

  function runItem(item: CardMenuItem) {
    setOpen(false);
    item.onSelect();
  }

  function onMenuKeyDown(e: React.KeyboardEvent) {
    const focusables = itemRefs.current.filter(Boolean) as HTMLButtonElement[];
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const idx = focusables.indexOf(document.activeElement as HTMLButtonElement);
      const next =
        e.key === "ArrowDown"
          ? (idx + 1) % focusables.length
          : (idx - 1 + focusables.length) % focusables.length;
      focusables[next]?.focus();
    }
    if (e.key === "Home") {
      e.preventDefault();
      focusables[0]?.focus();
    }
    if (e.key === "End") {
      e.preventDefault();
      focusables[focusables.length - 1]?.focus();
    }
  }

  const menu =
    open && coords ? (
      <div
        ref={menuRef}
        className={styles.menu}
        role="menu"
        aria-label={label}
        style={{ top: coords.top, left: coords.left }}
        onKeyDown={onMenuKeyDown}
      >
        {items.map((item, i) => (
          <button
            key={item.label}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            type="button"
            role="menuitem"
            className={`${styles.item} ${item.danger ? styles.itemDanger : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              runItem(item);
            }}
          >
            <span className={styles.itemIcon}>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    ) : null;

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        ref={btnRef}
        type="button"
        className={styles.trigger}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        title={label}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <DotsThree size={16} weight="bold" />
      </button>
      {mounted && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
