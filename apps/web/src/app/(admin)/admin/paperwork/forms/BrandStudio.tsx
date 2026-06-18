"use client";

import { useEffect, useMemo, useState, useTransition, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Check, MagnifyingGlass, Sparkle, X } from "@phosphor-icons/react";
import type { Form } from "@/lib/admin/forms-types";
import { updateFormAppearanceAction } from "../templates/form-actions";
import {
  FORM_SYMBOLS,
  FORM_TINTS,
  emojiFromCodepoints,
  normalizeHexColor,
  resolveFormAppearance,
  resolveTintValue,
  type FormSymbol,
  type FormSymbolCategory,
  type FormSymbolValue,
} from "./form-icon";
import {
  buildSuggestionContext,
  searchFormSymbols,
  suggestFormSymbols,
} from "./form-symbol-search";
import styles from "./BrandStudio.module.css";

const RECENTS_KEY = "proxy.formBrandStudio.recentEmoji";

const CATEGORY_ORDER: FormSymbolCategory[] = [
  "Property",
  "Access",
  "Utilities",
  "Documents",
  "Compliance",
  "Money",
  "Maintenance",
  "Hospitality",
  "People",
  "Surveys",
  "General",
];

type SymbolTooltip = {
  label: string;
  left: number;
  top: number;
  placement: "above" | "below";
};

type LibraryTab = "icons" | "emoji";

export function BrandStudio({ form }: { form: Form }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const initialTint = resolveTintValue(form.icon_color, form.id);
  const [query, setQuery] = useState("");
  const [localIcon, setLocalIcon] = useState(form.icon);
  const [localColor, setLocalColor] = useState(form.icon_color);
  const [customHex, setCustomHex] = useState(
    normalizeHexColor(form.icon_color) ?? initialTint.fg,
  );
  const [libraryTab, setLibraryTab] = useState<LibraryTab>("icons");
  const [recentEmoji, setRecentEmoji] = useState<FormSymbolValue[]>([]);
  const [colorPopoverOpen, setColorPopoverOpen] = useState(false);
  const [hexError, setHexError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const nextTint = resolveTintValue(form.icon_color, form.id);
    setLocalIcon(form.icon);
    setLocalColor(form.icon_color);
    setCustomHex(normalizeHexColor(form.icon_color) ?? nextTint.fg);
    setColorPopoverOpen(false);
    setHexError(null);
  }, [form.icon, form.icon_color, form.id]);

  useEffect(() => {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setRecentEmoji(
          parsed.filter(
            (value): value is FormSymbolValue =>
              typeof value === "string" && value.startsWith("emoji:"),
          ),
        );
      }
    } catch {
      window.localStorage.removeItem(RECENTS_KEY);
    }
  }, []);

  const appearance = resolveFormAppearance({
    id: form.id,
    icon: localIcon,
    icon_color: localColor,
  });
  const selectedTint = resolveTintValue(localColor, form.id);
  const normalizedCustomHex = normalizeHexColor(customHex);
  const customPreview = normalizedCustomHex ?? selectedTint.fg;
  const queryText = query.trim();

  const suggestionContext = useMemo(
    () =>
      buildSuggestionContext({
        name: form.name,
        description: form.description,
        fields: form.schema.fields,
      }),
    [form.description, form.name, form.schema.fields],
  );
  const suggestedSymbols = useMemo(
    () => suggestFormSymbols(suggestionContext).map((entry) => entry.symbol),
    [suggestionContext],
  );
  const searchResults = useMemo(() => searchFormSymbols(queryText), [queryText]);
  const iconSymbols = useMemo(
    () => FORM_SYMBOLS.filter((symbol) => symbol.kind === "icon"),
    [],
  );
  const emojiSymbols = useMemo(
    () => FORM_SYMBOLS.filter((symbol) => symbol.kind === "emoji"),
    [],
  );
  const recentEmojiSymbols = recentEmoji
    .map((value) => FORM_SYMBOLS.find((symbol) => symbol.value === value))
    .filter((symbol): symbol is FormSymbol => Boolean(symbol));

  function persist(next: { icon?: string | null; color?: string | null }) {
    const icon = next.icon ?? localIcon;
    const color = next.color ?? localColor;
    const previousIcon = localIcon;
    const previousColor = localColor;
    setLocalIcon(icon);
    setLocalColor(color);
    setError(null);
    startTransition(async () => {
      const res = await updateFormAppearanceAction(form.id, {
        icon,
        icon_color: color,
      });
      if (!res.ok) {
        setLocalIcon(previousIcon);
        setLocalColor(previousColor);
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function selectSymbol(symbol: FormSymbol) {
    persist({
      icon: symbol.value,
      color: localColor ?? FORM_TINTS[0].key,
    });
    if (symbol.kind === "emoji") {
      const next = [symbol.value, ...recentEmoji.filter((value) => value !== symbol.value)].slice(0, 12);
      setRecentEmoji(next);
      try {
        window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
      } catch {
        setRecentEmoji([]);
      }
    }
  }

  function selectColor(color: string) {
    const nextTint = resolveTintValue(color, form.id);
    setCustomHex(nextTint.fg);
    setHexError(null);
    persist({
      icon: localIcon ?? "icon:form",
      color,
    });
  }

  function applyCustomHex(value = customHex, closePopover = false) {
    const normalized = normalizeHexColor(value);
    if (!normalized) {
      setHexError("Enter a 6 digit hex color.");
      return;
    }
    setCustomHex(normalized);
    setHexError(null);
    selectColor(normalized);
    if (closePopover) setColorPopoverOpen(false);
  }

  function handleHexKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    applyCustomHex();
  }

  function handleColorPopoverKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    setColorPopoverOpen(false);
  }

  return (
    <section className={styles.card} aria-label="Brand Studio">
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Brand Studio</h3>
          <p className={styles.sub}>
            Choose a fast local icon or emoji, then tint the form everywhere it appears.
          </p>
        </div>
        <span
          className={styles.previewChip}
          style={{ background: appearance.bg, color: appearance.fg }}
          aria-label={`Current symbol: ${appearance.label}`}
        >
          {appearance.kind === "emoji" && appearance.emoji ? (
            <span className={styles.previewEmoji}>{appearance.emoji}</span>
          ) : (
            <appearance.Icon size={23} weight="duotone" />
          )}
        </span>
      </div>

      <div className={styles.colorPanel}>
        <div className={styles.tintRow} aria-label="Accent color presets">
          {FORM_TINTS.map((tint) => {
            const selected = selectedTint.key === tint.key;
            return (
              <button
                key={tint.key}
                type="button"
                className={`${styles.swatch} ${selected ? styles.swatchSelected : ""}`}
                style={{ background: tint.fg, color: tint.fg }}
                aria-label={`${tint.label} accent`}
                aria-pressed={selected}
                onClick={() => selectColor(tint.key)}
              />
            );
          })}
        </div>

        <div className={styles.customColor}>
          <div className={styles.pickerShell}>
            <button
              type="button"
              className={styles.colorPicker}
              aria-label="Pick custom accent color"
              aria-expanded={colorPopoverOpen}
              aria-haspopup="dialog"
              onClick={() => setColorPopoverOpen((open) => !open)}
            >
              <span className={styles.customSwatch} style={{ background: customPreview }} />
            </button>
            {colorPopoverOpen && (
              <div
                className={styles.colorPopover}
                role="dialog"
                aria-label="Custom accent color picker"
                onKeyDown={handleColorPopoverKeyDown}
              >
                <div className={styles.popoverHead}>
                  <div>
                    <span className={styles.popoverKicker}>Accent color</span>
                    <strong>Brand tint</strong>
                  </div>
                  <button
                    type="button"
                    className={styles.popoverClose}
                    aria-label="Close color picker"
                    onClick={() => setColorPopoverOpen(false)}
                  >
                    <X size={13} weight="bold" />
                  </button>
                </div>
                <div className={styles.popoverPreview}>
                  <span
                    className={styles.popoverPreviewSwatch}
                    style={{ background: customPreview }}
                  />
                  <span>{customPreview}</span>
                </div>
                <div className={styles.popoverSwatches} aria-label="Brand color options">
                  {FORM_TINTS.map((tint) => (
                    <button
                      key={tint.key}
                      type="button"
                      className={styles.popoverSwatch}
                      style={{ background: tint.fg, color: tint.fg }}
                      aria-label={`Use ${tint.label}`}
                      onClick={() => {
                        selectColor(tint.key);
                        setColorPopoverOpen(false);
                      }}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className={styles.popoverApply}
                  disabled={!normalizeHexColor(customHex)}
                  onClick={() => applyCustomHex(customHex, true)}
                >
                  Apply custom hex
                </button>
              </div>
            )}
          </div>
          <label className={styles.hexField}>
            <span>Custom hex</span>
            <input
              value={customHex}
              onChange={(event) => {
                setCustomHex(event.target.value);
                setHexError(null);
              }}
              onBlur={() => applyCustomHex()}
              onKeyDown={handleHexKeyDown}
              placeholder="#1b77be"
              spellCheck={false}
            />
          </label>
          <button
            type="button"
            className={styles.hexApply}
            aria-label="Apply custom hex"
            disabled={!normalizeHexColor(customHex)}
            onClick={() => applyCustomHex()}
          >
            <Check size={14} weight="bold" />
          </button>
        </div>
        {hexError && <p className={styles.hexError}>{hexError}</p>}
      </div>

      <label className={styles.search}>
        <MagnifyingGlass size={15} weight="bold" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search icons and emoji"
        />
        {query && (
          <button type="button" className={styles.clearSearch} onClick={() => setQuery("")}>
            <X size={13} weight="bold" />
          </button>
        )}
      </label>

      {queryText ? (
        <div className={styles.libraryPanel}>
          <SymbolSection
            title="Matching symbols"
            symbols={searchResults}
            selectedValue={appearance.symbolValue}
            selectedTint={selectedTint}
            emptyLabel="No matching symbols"
            onSelect={selectSymbol}
          />
        </div>
      ) : (
        <div className={styles.sectionStack}>
          <section className={styles.symbolSection}>
            <h4 className={`${styles.sectionTitle} ${styles.suggestedTitle}`}>
              <Sparkle size={12} weight="bold" />
              Suggested
            </h4>
            <SymbolGrid
              symbols={suggestedSymbols}
              selectedValue={appearance.symbolValue}
              selectedTint={selectedTint}
              emptyLabel="No suggestions yet"
              rail
              onSelect={selectSymbol}
            />
          </section>

          <div className={styles.libraryTabs} role="tablist" aria-label="Symbol library">
            <button
              id="brand-studio-icons-tab"
              type="button"
              role="tab"
              aria-selected={libraryTab === "icons"}
              aria-controls="brand-studio-icons-panel"
              className={`${styles.libraryTab} ${
                libraryTab === "icons" ? styles.libraryTabActive : ""
              }`}
              onClick={() => setLibraryTab("icons")}
            >
              Icons
            </button>
            <button
              id="brand-studio-emoji-tab"
              type="button"
              role="tab"
              aria-selected={libraryTab === "emoji"}
              aria-controls="brand-studio-emoji-panel"
              className={`${styles.libraryTab} ${
                libraryTab === "emoji" ? styles.libraryTabActive : ""
              }`}
              onClick={() => setLibraryTab("emoji")}
            >
              Emojis
            </button>
          </div>

          <div
            id={
              libraryTab === "icons"
                ? "brand-studio-icons-panel"
                : "brand-studio-emoji-panel"
            }
            className={styles.libraryPanel}
            role="tabpanel"
            aria-labelledby={
              libraryTab === "icons" ? "brand-studio-icons-tab" : "brand-studio-emoji-tab"
            }
          >
            {libraryTab === "icons" ? (
              <div className={styles.libraryGroup}>
                {CATEGORY_ORDER.map((category) => {
                  const symbols = iconSymbols.filter((symbol) => symbol.category === category);
                  if (symbols.length === 0) return null;
                  return (
                    <SymbolSection
                      key={category}
                      title={category}
                      symbols={symbols}
                      selectedValue={appearance.symbolValue}
                      selectedTint={selectedTint}
                      onSelect={selectSymbol}
                    />
                  );
                })}
              </div>
            ) : (
              <div className={styles.libraryGroup}>
                {recentEmojiSymbols.length > 0 && (
                  <SymbolSection
                    title="Recent"
                    symbols={recentEmojiSymbols}
                    selectedValue={appearance.symbolValue}
                    selectedTint={selectedTint}
                    onSelect={selectSymbol}
                  />
                )}
                <SymbolSection
                  title="All emoji"
                  symbols={emojiSymbols}
                  selectedValue={appearance.symbolValue}
                  selectedTint={selectedTint}
                  onSelect={selectSymbol}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}
    </section>
  );
}

function SymbolSection({
  title,
  symbols,
  selectedValue,
  selectedTint,
  emptyLabel,
  onSelect,
}: {
  title: string;
  symbols: FormSymbol[];
  selectedValue: FormSymbolValue;
  selectedTint: { bg: string; fg: string };
  emptyLabel?: string;
  onSelect: (symbol: FormSymbol) => void;
}) {
  return (
    <section className={styles.symbolSection}>
      <h4 className={styles.sectionTitle}>{title}</h4>
      <SymbolGrid
        symbols={symbols}
        selectedValue={selectedValue}
        selectedTint={selectedTint}
        emptyLabel={emptyLabel}
        onSelect={onSelect}
      />
    </section>
  );
}

function SymbolGrid({
  symbols,
  selectedValue,
  selectedTint,
  emptyLabel,
  rail = false,
  onSelect,
}: {
  symbols: FormSymbol[];
  selectedValue: FormSymbolValue;
  selectedTint: { bg: string; fg: string };
  emptyLabel?: string;
  rail?: boolean;
  onSelect: (symbol: FormSymbol) => void;
}) {
  const [tooltip, setTooltip] = useState<SymbolTooltip | null>(null);

  if (symbols.length === 0) {
    return <p className={styles.empty}>{emptyLabel ?? "No symbols here yet"}</p>;
  }

  function showTooltip(target: HTMLButtonElement, label: string) {
    const rect = target.getBoundingClientRect();
    const placement = rect.top > 42 ? "above" : "below";
    setTooltip({
      label,
      left: rect.left + rect.width / 2,
      top: placement === "above" ? rect.top - 8 : rect.bottom + 8,
      placement,
    });
  }

  return (
    <>
      <div className={`${styles.grid} ${rail ? styles.rail : ""}`}>
        {symbols.map((symbol) => {
          const selected = symbol.value === selectedValue;
          return (
            <button
              key={symbol.value}
              type="button"
              className={`${styles.symbolBtn} ${selected ? styles.symbolBtnSelected : ""}`}
              style={
                selected
                  ? { background: selectedTint.bg, color: selectedTint.fg }
                  : { color: selectedTint.fg }
              }
              data-label={symbol.label}
              aria-label={`${symbol.label} ${symbol.kind}`}
              aria-pressed={selected}
              onBlur={() => setTooltip(null)}
              onClick={() => {
                setTooltip(null);
                onSelect(symbol);
              }}
              onFocus={(event) => showTooltip(event.currentTarget, symbol.label)}
              onMouseEnter={(event) => showTooltip(event.currentTarget, symbol.label)}
              onMouseLeave={() => setTooltip(null)}
            >
              <span className={styles.symbolGlyph}>
                {symbol.kind === "emoji" ? (
                  <span className={styles.emojiGlyph}>{emojiFromCodepoints(symbol.codepoints)}</span>
                ) : (
                  <symbol.Icon size={18} weight={selected ? "duotone" : "regular"} />
                )}
              </span>
            </button>
          );
        })}
      </div>
      {tooltip
        ? createPortal(
            <span
              className={`${styles.symbolTooltip} ${
                tooltip.placement === "below" ? styles.symbolTooltipBelow : ""
              }`}
              role="tooltip"
              style={{ left: tooltip.left, top: tooltip.top }}
            >
              {tooltip.label}
            </span>,
            document.body,
          )
        : null}
    </>
  );
}
