"use client";

/**
 * IconPicker — a Notion-style icon chooser. A tinted trigger tile shows the
 * current selection; clicking opens a popover with a search field, an
 * Emoji / Icons tab switch, an optional tint row, and a scrollable grid.
 *
 * Emits an `IconValue` (`{ kind: "emoji" | "icon", value }`). The icon set is
 * the curated, searchable Phosphor catalog in `icon-picker-data`. The optional
 * color row lets a host (e.g. the form appearance card) drive the tile tint
 * without coupling this component to any one tint system.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { ICON_BY_NAME, type IconValue } from "./icon-picker-data";
import {
  PHOSPHOR_ICONS,
  EMOJI_GROUPS,
  ALL_EMOJIS,
} from "./icon-picker-catalog";
import styles from "./IconPicker.module.css";

export type { IconValue } from "./icon-picker-data";

export type IconColorOption = { key: string; label: string; swatch: string };

type Tab = "emoji" | "icon";

function isHex(value: string): boolean {
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

export function IconPicker({
  value,
  onChange,
  color,
  onColorChange,
  colorOptions,
  ariaLabel = "Choose an icon",
  triggerBg,
  triggerFg,
  triggerContent,
}: {
  value: IconValue | null;
  onChange: (next: IconValue) => void;
  /** Currently selected tint key (for the trigger tile + selection ring). */
  color?: string;
  onColorChange?: (key: string) => void;
  colorOptions?: IconColorOption[];
  ariaLabel?: string;
  /** Host-driven trigger tile look + glyph (e.g. a resolved form appearance,
   * so legacy stored icons still render in the trigger). */
  triggerBg?: string;
  triggerFg?: string;
  triggerContent?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>(value?.kind === "emoji" ? "emoji" : "icon");
  const [query, setQuery] = useState("");
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // Local draft so typing a hex doesn't persist on every keystroke (the host's
  // onColorChange may run a server action + refresh). Commit only on blur/Enter
  // with a complete, changed hex.
  const [hexDraft, setHexDraft] = useState("");
  useEffect(() => {
    setHexDraft(color && isHex(color) ? color.replace(/^#/, "") : "");
  }, [color]);

  function commitHex() {
    const v = hexDraft.toLowerCase();
    if ((v.length === 6 || v.length === 3) && `#${v}` !== (color ?? "").toLowerCase()) {
      onColorChange?.(`#${v}`);
    }
  }

  const activeSwatch = useMemo(
    () =>
      colorOptions?.find((c) => c.key === color)?.swatch ??
      (color && isHex(color) ? color : undefined),
    [colorOptions, color],
  );

  function place() {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const PANEL_W = 332;
    const left = Math.max(16, Math.min(r.left, window.innerWidth - PANEL_W - 16));
    const top = r.bottom + 8;
    // Skip the state update (and portal re-render) when nothing moved.
    setCoords((prev) => (prev && prev.top === top && prev.left === left ? prev : { top, left }));
  }

  function openPicker() {
    place();
    setQuery("");
    setOpen(true);
  }

  // Reposition on scroll/resize while open; close on outside click + Escape.
  useEffect(() => {
    if (!open) return;
    function onScrollResize() {
      place();
    }
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (popoverRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("scroll", onScrollResize, true);
    window.addEventListener("resize", onScrollResize);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onScrollResize, true);
      window.removeEventListener("resize", onScrollResize);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const q = query.trim().toLowerCase();

  const filteredEmojis = useMemo(() => {
    if (!q) return null; // null = show grouped view
    return ALL_EMOJIS.filter((e) => e.keywords.includes(q));
  }, [q]);

  const filteredIcons = useMemo(() => {
    if (!q) return PHOSPHOR_ICONS;
    return PHOSPHOR_ICONS.filter(
      (e) => e.keywords.includes(q) || e.name.toLowerCase().includes(q),
    );
  }, [q]);

  function pickEmoji(char: string) {
    onChange({ kind: "emoji", value: char });
    setOpen(false);
  }
  function pickIcon(name: string) {
    onChange({ kind: "icon", value: name });
    setOpen(false);
  }

  const CurrentIcon = value?.kind === "icon" ? ICON_BY_NAME[value.value] : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        onClick={() => (open ? setOpen(false) : openPicker())}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        style={{
          background: triggerBg ?? activeSwatch ?? undefined,
          color: triggerFg ?? undefined,
        }}
      >
        {triggerContent ? (
          triggerContent
        ) : value?.kind === "emoji" ? (
          <span className={styles.triggerEmoji}>{value.value}</span>
        ) : CurrentIcon ? (
          <CurrentIcon size={22} weight="duotone" />
        ) : (
          <span className={styles.triggerEmoji}>🏠</span>
        )}
      </button>

      {mounted && open && coords
        ? createPortal(
            <div
              ref={popoverRef}
              role="dialog"
              aria-label={ariaLabel}
              className={styles.popover}
              style={{ top: coords.top, left: coords.left }}
            >
              <div className={styles.head}>
                <div className={styles.tabs} role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab === "icon"}
                    className={`${styles.tab} ${tab === "icon" ? styles.tabActive : ""}`}
                    onClick={() => setTab("icon")}
                  >
                    Icons
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab === "emoji"}
                    className={`${styles.tab} ${tab === "emoji" ? styles.tabActive : ""}`}
                    onClick={() => setTab("emoji")}
                  >
                    Emoji
                  </button>
                </div>
                <button
                  type="button"
                  className={styles.closeBtn}
                  onClick={() => setOpen(false)}
                  aria-label="Close icon picker"
                >
                  <X size={14} weight="bold" />
                </button>
              </div>

              <div className={styles.searchRow}>
                <MagnifyingGlass size={13} weight="bold" aria-hidden />
                <input
                  className={styles.searchInput}
                  placeholder={tab === "emoji" ? "Search emoji" : "Search icons"}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                  aria-label={tab === "emoji" ? "Search emoji" : "Search icons"}
                />
              </div>

              {colorOptions && colorOptions.length > 0 && onColorChange ? (
                <div className={styles.colorRow} role="group" aria-label="Tile color">
                  {colorOptions.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      className={`${styles.colorDot} ${color === c.key ? styles.colorDotActive : ""}`}
                      style={{ background: c.swatch }}
                      onClick={() => onColorChange(c.key)}
                      aria-label={`${c.label} tile`}
                      aria-pressed={color === c.key}
                    />
                  ))}
                  <label
                    className={`${styles.hexField} ${color && isHex(color) ? styles.hexFieldActive : ""}`}
                    title="Custom hex color"
                  >
                    <span
                      className={styles.hexSwatch}
                      style={{
                        background:
                          hexDraft.length === 6 || hexDraft.length === 3 ? `#${hexDraft}` : undefined,
                      }}
                      aria-hidden
                    />
                    <span className={styles.hexHash}>#</span>
                    <input
                      className={styles.hexInput}
                      value={hexDraft}
                      onChange={(e) =>
                        setHexDraft(e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6))
                      }
                      onBlur={commitHex}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          commitHex();
                        }
                      }}
                      placeholder="hex"
                      maxLength={6}
                      spellCheck={false}
                      aria-label="Custom hex color"
                    />
                  </label>
                </div>
              ) : null}

              <div className={styles.grid}>
                {tab === "emoji" ? (
                  filteredEmojis ? (
                    filteredEmojis.length === 0 ? (
                      <p className={styles.empty}>No emoji match “{query}”.</p>
                    ) : (
                      <div className={styles.emojiGrid}>
                        {filteredEmojis.map((e) => (
                          <button
                            key={e.char}
                            type="button"
                            className={styles.emojiBtn}
                            onClick={() => pickEmoji(e.char)}
                            aria-label={`Emoji ${e.char}`}
                          >
                            {e.char}
                          </button>
                        ))}
                      </div>
                    )
                  ) : (
                    EMOJI_GROUPS.map((group) => (
                      <div key={group.label} className={styles.emojiGroup}>
                        <p className={styles.groupLabel}>{group.label}</p>
                        <div className={styles.emojiGrid}>
                          {group.emojis.map((e) => (
                            <button
                              key={e.char}
                              type="button"
                              className={`${styles.emojiBtn} ${value?.kind === "emoji" && value.value === e.char ? styles.emojiBtnActive : ""}`}
                              onClick={() => pickEmoji(e.char)}
                              aria-label={`Emoji ${e.char}`}
                            >
                              {e.char}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  )
                ) : filteredIcons.length === 0 ? (
                  <p className={styles.empty}>No icons match “{query}”.</p>
                ) : (
                  <div className={styles.iconGrid}>
                    {filteredIcons.map(({ name, Icon }) => (
                      <button
                        key={name}
                        type="button"
                        className={`${styles.iconBtn} ${value?.kind === "icon" && value.value === name ? styles.iconBtnActive : ""}`}
                        onClick={() => pickIcon(name)}
                        aria-label={name}
                        title={name}
                      >
                        <Icon size={19} weight="duotone" color={activeSwatch} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/** Render any stored IconValue inline (cards, tiles). Falls back to a house. */
export function IconValueGlyph({
  value,
  size = 20,
  weight = "duotone",
}: {
  value: IconValue | null;
  size?: number;
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone";
}) {
  if (value?.kind === "emoji") {
    return <span style={{ fontSize: size, lineHeight: 1 }}>{value.value}</span>;
  }
  const Icon = value?.kind === "icon" ? ICON_BY_NAME[value.value] : null;
  if (!Icon) return <span style={{ fontSize: size, lineHeight: 1 }}>🏠</span>;
  return <Icon size={size} weight={weight} />;
}
