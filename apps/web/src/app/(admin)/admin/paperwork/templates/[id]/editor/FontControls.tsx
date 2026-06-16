"use client";

/**
 * FontControls — font family, size, weight dropdowns and text/highlight color
 * pickers for the document editor toolbar.
 *
 * Editor prop type: the concrete plugin-transform type is only available where
 * the editor is created (TemplateEditor.tsx). We accept a narrow interface that
 * covers only the members we call so this file stays importable without a
 * circular dependency.
 */

import { useRef, useState } from "react";
import { useEditorSelector } from "platejs/react";
import { CustomSelect } from "@/components/admin/CustomSelect";
import { FONTS, FONT_SIZES, loadFont } from "./fonts";
import tStyles from "./Toolbar.module.css";

/**
 * Narrow editor interface covering only the members this file calls.
 * The concrete plugin-transform type (tf.bold, tf.fontFamily, etc.) is only
 * available where the editor is created; accepting `any` here avoids a
 * circular dependency while keeping usage explicit.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EditorHandle = { tf: any; api: any };

// ---- Constants ----------------------------------------------------------

const FONT_OPTIONS = FONTS.map((f) => ({ value: f.id, label: f.label }));
const SIZE_OPTIONS = FONT_SIZES.map((n) => ({
  value: `${n}pt`,
  label: `${n}pt`,
}));

const TEXT_COLORS = [
  "#1a1a1a",
  "#1b77be",
  "#dc2626",
  "#16a34a",
  "#d97706",
  "#7c3aed",
  "#0891b2",
  "#475569",
  "#ffffff",
  "#6b7280",
];

const HIGHLIGHT_COLORS = [
  "#fef08a",
  "#bbf7d0",
  "#bfdbfe",
  "#fde68a",
  "#f5d0fe",
  "#fed7aa",
  "#fecaca",
  "#e0e7ff",
  "#d1fae5",
  "#cffafe",
];

// ---- Color swatch with inline palette popover --------------------------

function ColorSwatch({
  colors,
  currentColor,
  label,
  onPick,
  renderTrigger,
}: {
  colors: string[];
  currentColor: string;
  label: string;
  onPick: (hex: string) => void;
  renderTrigger: (open: boolean) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!ref.current?.contains(e.relatedTarget as Node)) {
      setOpen(false);
    }
  };

  return (
    <div
      ref={ref}
      className={tStyles.paletteAnchor}
      onBlur={handleBlur}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={label}
        className={tStyles.swatchBtn}
        onMouseDown={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
      >
        {renderTrigger(open)}
      </button>

      {open ? (
        <div
          className={tStyles.palette}
          role="listbox"
          aria-label={label}
        >
          {colors.map((hex) => (
            <button
              key={hex}
              type="button"
              role="option"
              aria-selected={hex === currentColor}
              aria-label={hex}
              title={hex}
              className={tStyles.paletteChip}
              style={{ backgroundColor: hex }}
              onMouseDown={(e) => {
                e.preventDefault();
                onPick(hex);
                setOpen(false);
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ---- FontControls -------------------------------------------------------

export function FontControls({ editor }: { editor: EditorHandle }) {
  // Read active mark values to reflect in the selects.
  const activeFontId = useEditorSelector((ed) => {
    const stack = ed.api.marks()?.fontFamily as string | undefined;
    if (!stack) return "";
    const found = FONTS.find((f) => f.stack === stack);
    return found?.id ?? "";
  }, []);

  const activeSize = useEditorSelector(
    (ed) => (ed.api.marks()?.fontSize as string | undefined) ?? "",
    [],
  );

  const activeWeight = useEditorSelector(
    (ed) => (ed.api.marks()?.fontWeight as string | undefined) ?? "",
    [],
  );

  const activeColor = useEditorSelector(
    (ed) => (ed.api.marks()?.color as string | undefined) ?? "#1a1a1a",
    [],
  );

  const activeBgColor = useEditorSelector(
    (ed) => (ed.api.marks()?.backgroundColor as string | undefined) ?? "",
    [],
  );

  // Derive weight options from the selected font (or fallback defaults).
  const selectedFont = FONTS.find((f) => f.id === activeFontId);
  const weightOptions = (selectedFont?.weights ?? [400, 500, 600, 700]).map(
    (w) => ({ value: String(w), label: String(w) }),
  );

  function handleFontChange(id: string) {
    const font = FONTS.find((f) => f.id === id);
    if (!font) return;
    loadFont(id);
    editor.tf.fontFamily.addMark(font.stack);
  }

  return (
    <>
      {/* Font family */}
      <div className={tStyles.selectWrap}>
        <CustomSelect
          value={activeFontId}
          options={FONT_OPTIONS}
          placeholder="Font"
          onChange={handleFontChange}
        />
      </div>

      {/* Font size */}
      <div className={tStyles.selectWrapSm}>
        <CustomSelect
          value={activeSize}
          options={SIZE_OPTIONS}
          placeholder="Size"
          onChange={(val) => editor.tf.fontSize.addMark(val)}
        />
      </div>

      {/* Font weight */}
      <div className={tStyles.selectWrapXs}>
        <CustomSelect
          value={activeWeight}
          options={weightOptions}
          placeholder="Wt"
          onChange={(val) => editor.tf.fontWeight.addMark(val)}
        />
      </div>

      {/* Text color swatch */}
      <ColorSwatch
        colors={TEXT_COLORS}
        currentColor={activeColor}
        label="Text color"
        onPick={(hex) => editor.tf.color.addMark(hex)}
        renderTrigger={() => (
          <>
            <span
              className={tStyles.swatchCircle}
              style={{ backgroundColor: activeColor }}
              aria-hidden
            />
            <span
              className={tStyles.swatchUnderline}
              style={{ backgroundColor: activeColor }}
              aria-hidden
            />
          </>
        )}
      />

      {/* Highlight color swatch */}
      <ColorSwatch
        colors={HIGHLIGHT_COLORS}
        currentColor={activeBgColor}
        label="Highlight color"
        onPick={(hex) => editor.tf.backgroundColor.addMark(hex)}
        renderTrigger={() => (
          <span
            className={tStyles.swatchCircle}
            style={{
              backgroundColor: activeBgColor || "#fef08a",
              borderStyle: activeBgColor ? "solid" : "dashed",
            }}
            aria-hidden
          />
        )}
      />
    </>
  );
}
