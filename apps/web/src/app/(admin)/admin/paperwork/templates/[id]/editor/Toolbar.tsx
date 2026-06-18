"use client";

/**
 * EditorToolbar — comprehensive Plate v53 rich-text toolbar.
 *
 * Two structural concerns this file owns:
 *  - Responsive compaction: controls are a tiered, ordered item list. Tier-1
 *    (block type, B/I/U, font, size) and the right slot (Preview / Save / Sync)
 *    are always visible; Tier-2 controls fold into a portal "More" panel from
 *    the end as the toolbar narrows. A ResizeObserver on the measured region
 *    drives the split. The right slot lives OUTSIDE the measured region, so the
 *    Sync button can never be pushed off-screen.
 *  - Floating layers: every menu/popover (selects, color palettes, link, More)
 *    renders through EditorSelect / EditorPopover, which portal to document.body
 *    so nothing is clipped by the toolbar or stacks behind it.
 *
 * Editor prop type: the concrete plugin-transform type is only available where
 * the editor is created (TemplateEditor.tsx). We use a narrow interface covering
 * only the members this file calls to avoid a circular dependency.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useEditorSelector } from "platejs/react";
import {
  TextB,
  TextItalic,
  TextUnderline,
  TextStrikethrough,
  Code,
  TextSuperscript,
  TextSubscript,
  Highlighter,
  TextAlignLeft,
  TextAlignCenter,
  TextAlignRight,
  TextAlignJustify,
  ListBullets,
  ListNumbers,
  CheckSquare,
  LinkSimple,
  ImageSquare,
  Minus,
  FileDashed,
  DotsThreeVertical,
  ArrowUUpLeft,
  ArrowUUpRight,
  X,
} from "@phosphor-icons/react";
import { upsertLink } from "@platejs/link";
import { EditorSelect, type EditorSelectOption } from "./EditorSelect";
import { EditorPopover } from "./EditorPopover";
import { useActiveTextStyle } from "./useActiveTextStyle";
import { FONTS, FONT_SIZES, loadFont } from "./fonts";
import base from "../TemplateEditor.module.css";
import tStyles from "./Toolbar.module.css";

/**
 * Narrow editor interface covering only the members this file calls. The
 * concrete plugin-transform type (tf.bold, tf.h1, etc.) is only available where
 * the editor is created; accepting `any` here avoids a circular dependency
 * while keeping usage explicit.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EditorHandle = { tf: any; api: any; selection: unknown; undo: () => void; redo: () => void; history: { undos: unknown[]; redos: unknown[] } };

// ---- Overflow measurement constants ------------------------------------

/** Slack subtracted from the measured region width. */
const BUFFER = 8;
/** Width reserved for the "More" button + its preceding divider + gaps. */
const MORE_RESERVE = 52;

// ---- Static option lists ------------------------------------------------

const BLOCK_OPTIONS: EditorSelectOption[] = [
  { value: "p", label: "Paragraph" },
  { value: "h1", label: "Heading 1" },
  { value: "h2", label: "Heading 2" },
  { value: "h3", label: "Heading 3" },
  { value: "h4", label: "Heading 4" },
  { value: "h5", label: "Heading 5" },
  { value: "h6", label: "Heading 6" },
  { value: "blockquote", label: "Blockquote" },
  { value: "code_block", label: "Code block" },
];

const LINE_HEIGHT_OPTIONS: EditorSelectOption[] = [
  { value: "1", label: "Single" },
  { value: "1.15", label: "1.15" },
  { value: "1.5", label: "1.5" },
  { value: "2", label: "Double" },
];

const FONT_OPTIONS: EditorSelectOption[] = FONTS.map((f) => ({
  value: f.id,
  label: f.label,
}));

const SIZE_OPTIONS: EditorSelectOption[] = FONT_SIZES.map((n) => ({
  value: `${n}pt`,
  label: `${n}pt`,
}));

const WEIGHT_LABELS: Record<number, string> = {
  100: "Thin",
  200: "Extra Light",
  300: "Light",
  400: "Regular",
  500: "Medium",
  600: "Semibold",
  700: "Bold",
  800: "Extrabold",
  900: "Black",
};

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

// ---- Shared toolbar button ---------------------------------------------

function Btn({
  active,
  disabled,
  label,
  onAction,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  label: string;
  onAction: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={[base.btn, active ? base.btnActive : ""].filter(Boolean).join(" ")}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      title={label}
      // onMouseDown + preventDefault keeps the editor selection alive so the
      // mark applies to the live text instead of a lost selection.
      onMouseDown={(e) => {
        e.preventDefault();
        if (!disabled) onAction();
      }}
    >
      {children}
    </button>
  );
}

// ---- Color swatch with portal palette ----------------------------------

function ColorSwatch({
  colors,
  currentColor,
  label,
  onPick,
  onClear,
  renderTrigger,
}: {
  colors: string[];
  currentColor: string;
  label: string;
  onPick: (hex: string) => void;
  onClear: () => void;
  renderTrigger: () => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={label}
        className={tStyles.swatchBtn}
        onMouseDown={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
      >
        {renderTrigger()}
      </button>

      <EditorPopover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        ariaLabel={label}
      >
        <div className={tStyles.palette} role="listbox" aria-label={label}>
          <button
            type="button"
            role="option"
            aria-selected={false}
            aria-label="None"
            title="None"
            className={tStyles.paletteNone}
            onMouseDown={(e) => {
              e.preventDefault();
              onClear();
              setOpen(false);
            }}
          />
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
      </EditorPopover>
    </>
  );
}

// ---- Link control with portal popover ----------------------------------

function LinkControl({ editor }: { editor: EditorHandle }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("https://");
  const anchorRef = useRef<HTMLButtonElement>(null);
  // The popover input blurs the editor and collapses its selection; remember
  // where the selection was when the popover opened.
  const savedSelection = useRef<unknown>(null);

  function toggle() {
    if (!open) savedSelection.current = editor.selection ?? null;
    setOpen((v) => !v);
  }

  function commit() {
    const href = url.trim();
    if (!href || href === "https://") {
      setOpen(false);
      return;
    }
    // Restore the selection captured on open, then wrap it in a link. A
    // non-collapsed selection turns the selected text into the link; a
    // collapsed selection inserts the URL as the link text.
    if (savedSelection.current) editor.tf.select(savedSelection.current);
    // editor is the real Plate editor; the narrow EditorHandle omits the fields
    // upsertLink reads, so cast to its expected editor type.
    upsertLink(editor as unknown as Parameters<typeof upsertLink>[0], { url: href });
    setOpen(false);
    setUrl("https://");
  }

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className={[base.btn, open ? base.btnActive : ""].filter(Boolean).join(" ")}
        aria-label="Insert link"
        aria-pressed={open}
        title="Insert link"
        onMouseDown={(e) => {
          e.preventDefault();
          toggle();
        }}
      >
        <LinkSimple size={15} weight="bold" />
      </button>

      <EditorPopover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        ariaLabel="Insert link"
      >
        <div className={tStyles.linkPopover}>
          <input
            className={tStyles.linkInput}
            type="url"
            value={url}
            placeholder="https://"
            aria-label="URL"
            autoFocus
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") setOpen(false);
            }}
          />
          <button
            type="button"
            className={tStyles.linkConfirm}
            onMouseDown={(e) => {
              e.preventDefault();
              commit();
            }}
          >
            Insert
          </button>
          <button
            type="button"
            className={tStyles.linkCancel}
            aria-label="Cancel"
            onMouseDown={(e) => {
              e.preventDefault();
              setOpen(false);
            }}
          >
            <X size={13} weight="bold" />
          </button>
        </div>
      </EditorPopover>
    </>
  );
}

// ---- "More" overflow button --------------------------------------------

function MoreButton({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className={[base.btn, open ? base.btnActive : ""].filter(Boolean).join(" ")}
        aria-label="More formatting options"
        aria-expanded={open}
        title="More formatting options"
        onMouseDown={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
      >
        <DotsThreeVertical size={17} weight="bold" />
      </button>

      <EditorPopover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        align="end"
        ariaLabel="More formatting options"
      >
        <div className={tStyles.morePanel}>{children}</div>
      </EditorPopover>
    </>
  );
}

// ---- EditorToolbar (main export) ----------------------------------------

type ToolbarItem = { id: string; group: string; node: ReactNode };

export function EditorToolbar({
  editor,
  rightSlot,
  onImageUpload,
}: {
  editor: EditorHandle;
  rightSlot?: ReactNode;
  /** Uploads the picked file and resolves to its public URL (or null on error,
   *  which the caller surfaces). */
  onImageUpload?: (file: File) => Promise<string | null>;
}) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !onImageUpload) return;
    const url = await onImageUpload(file);
    if (url) {
      editor.tf.insertNodes({ type: "img", url, children: [{ text: "" }] });
    }
  }

  // ---- Active mark states ----
  const isBold = useEditorSelector((ed) => Boolean(ed.api.marks()?.bold), []);
  const isItalic = useEditorSelector((ed) => Boolean(ed.api.marks()?.italic), []);
  const isUnderline = useEditorSelector(
    (ed) => Boolean(ed.api.marks()?.underline),
    [],
  );
  const isStrikethrough = useEditorSelector(
    (ed) => Boolean(ed.api.marks()?.strikethrough),
    [],
  );
  const isCode = useEditorSelector((ed) => Boolean(ed.api.marks()?.code), []);
  const isSuperscript = useEditorSelector(
    (ed) => Boolean(ed.api.marks()?.superscript),
    [],
  );
  const isSubscript = useEditorSelector(
    (ed) => Boolean(ed.api.marks()?.subscript),
    [],
  );
  const isHighlight = useEditorSelector(
    (ed) => Boolean(ed.api.marks()?.highlight),
    [],
  );

  // ---- Active block states ----
  const isH1 = useEditorSelector((ed) => ed.api.some({ match: { type: "h1" } }), []);
  const isH2 = useEditorSelector((ed) => ed.api.some({ match: { type: "h2" } }), []);
  const isH3 = useEditorSelector((ed) => ed.api.some({ match: { type: "h3" } }), []);
  const isH4 = useEditorSelector((ed) => ed.api.some({ match: { type: "h4" } }), []);
  const isH5 = useEditorSelector((ed) => ed.api.some({ match: { type: "h5" } }), []);
  const isH6 = useEditorSelector((ed) => ed.api.some({ match: { type: "h6" } }), []);
  const isBlockquote = useEditorSelector(
    (ed) => ed.api.some({ match: { type: "blockquote" } }),
    [],
  );
  const isCodeBlock = useEditorSelector(
    (ed) => ed.api.some({ match: { type: "code_block" } }),
    [],
  );
  const isUl = useEditorSelector((ed) => ed.api.some({ match: { type: "ul" } }), []);
  const isOl = useEditorSelector((ed) => ed.api.some({ match: { type: "ol" } }), []);

  const blockType = isH1
    ? "h1"
    : isH2
      ? "h2"
      : isH3
        ? "h3"
        : isH4
          ? "h4"
          : isH5
            ? "h5"
            : isH6
              ? "h6"
              : isBlockquote
                ? "blockquote"
                : isCodeBlock
                  ? "code_block"
                  : "p";

  const activeLineHeight = useEditorSelector(
    (ed) => (ed.api.marks()?.lineHeight as string | undefined) ?? "1",
    [],
  );

  // ---- Active font states: explicit mark first, else the selection's real
  // computed style (so a CSS-styled heading reports Arial/17pt/Bold, not blank).
  const { fontId: activeFontId, size: activeSize, weight: activeWeight } =
    useActiveTextStyle(editor);
  const activeColor = useEditorSelector(
    (ed) => (ed.api.marks()?.color as string | undefined) ?? "#1a1a1a",
    [],
  );
  const activeBgColor = useEditorSelector(
    (ed) => (ed.api.marks()?.backgroundColor as string | undefined) ?? "",
    [],
  );

  // ---- Undo / redo availability ----
  const canUndo = useEditorSelector((ed) => ed.history.undos.length > 0, []);
  const canRedo = useEditorSelector((ed) => ed.history.redos.length > 0, []);

  const selectedFont = FONTS.find((f) => f.id === activeFontId);
  const weightOptions: EditorSelectOption[] = (
    selectedFont?.weights ?? [400, 500, 600, 700]
  ).map((w) => ({ value: String(w), label: WEIGHT_LABELS[w] ?? String(w) }));

  // ---- Handlers ----
  function handleBlockChange(val: string) {
    switch (val) {
      case "p":
        editor.tf.setNodes({ type: "p" });
        break;
      case "h1":
        editor.tf.h1.toggle();
        break;
      case "h2":
        editor.tf.h2.toggle();
        break;
      case "h3":
        editor.tf.h3.toggle();
        break;
      case "h4":
        editor.tf.h4.toggle();
        break;
      case "h5":
        editor.tf.h5.toggle();
        break;
      case "h6":
        editor.tf.h6.toggle();
        break;
      case "blockquote":
        editor.tf.blockquote.toggle();
        break;
      case "code_block":
        editor.tf.code_block.toggle();
        break;
      default:
        break;
    }
  }

  function handleFontChange(id: string) {
    const font = FONTS.find((f) => f.id === id);
    if (!font) return;
    loadFont(id);
    editor.tf.fontFamily.addMark(font.stack);
  }

  // ---- Tiered item lists (display order = priority; Tier-2 folds from end) ----
  const tier1Items: ToolbarItem[] = [
    {
      id: "undo",
      group: "history",
      node: (
        <Btn label="Undo" disabled={!canUndo} onAction={() => editor.undo()}>
          <ArrowUUpLeft size={15} weight="bold" />
        </Btn>
      ),
    },
    {
      id: "redo",
      group: "history",
      node: (
        <Btn label="Redo" disabled={!canRedo} onAction={() => editor.redo()}>
          <ArrowUUpRight size={15} weight="bold" />
        </Btn>
      ),
    },
    {
      id: "block",
      group: "block",
      node: (
        <EditorSelect
          value={blockType}
          options={BLOCK_OPTIONS}
          onChange={handleBlockChange}
          width={140}
          ariaLabel="Paragraph style"
        />
      ),
    },
    {
      id: "bold",
      group: "marks",
      node: (
        <Btn active={isBold} label="Bold" onAction={() => editor.tf.bold.toggle()}>
          <TextB size={15} weight="bold" />
        </Btn>
      ),
    },
    {
      id: "italic",
      group: "marks",
      node: (
        <Btn active={isItalic} label="Italic" onAction={() => editor.tf.italic.toggle()}>
          <TextItalic size={15} weight="bold" />
        </Btn>
      ),
    },
    {
      id: "underline",
      group: "marks",
      node: (
        <Btn
          active={isUnderline}
          label="Underline"
          onAction={() => editor.tf.underline.toggle()}
        >
          <TextUnderline size={15} weight="bold" />
        </Btn>
      ),
    },
    {
      id: "font",
      group: "font",
      node: (
        <EditorSelect
          value={activeFontId}
          options={FONT_OPTIONS}
          onChange={handleFontChange}
          placeholder="Font"
          width={156}
          ariaLabel="Font family"
        />
      ),
    },
    {
      id: "size",
      group: "font",
      node: (
        <EditorSelect
          value={activeSize}
          options={SIZE_OPTIONS}
          onChange={(val) => editor.tf.fontSize.addMark(val)}
          placeholder="Size"
          width={74}
          ariaLabel="Font size"
        />
      ),
    },
  ];

  const tier2Items: ToolbarItem[] = [
    {
      id: "weight",
      group: "font",
      node: (
        <EditorSelect
          value={activeWeight}
          options={weightOptions}
          onChange={(val) => editor.tf.fontWeight.addMark(val)}
          placeholder="Weight"
          width={112}
          ariaLabel="Font weight"
        />
      ),
    },
    {
      id: "textColor",
      group: "color",
      node: (
        <ColorSwatch
          colors={TEXT_COLORS}
          currentColor={activeColor}
          label="Text color"
          onPick={(hex) => editor.tf.color.addMark(hex)}
          onClear={() => editor.tf.removeMark("color")}
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
      ),
    },
    {
      id: "hlColor",
      group: "color",
      node: (
        <ColorSwatch
          colors={HIGHLIGHT_COLORS}
          currentColor={activeBgColor}
          label="Highlight color"
          onPick={(hex) => editor.tf.backgroundColor.addMark(hex)}
          onClear={() => editor.tf.removeMark("backgroundColor")}
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
      ),
    },
    {
      id: "strike",
      group: "marks2",
      node: (
        <Btn
          active={isStrikethrough}
          label="Strikethrough"
          onAction={() => editor.tf.strikethrough.toggle()}
        >
          <TextStrikethrough size={15} weight="bold" />
        </Btn>
      ),
    },
    {
      id: "highlight",
      group: "marks2",
      node: (
        <Btn
          active={isHighlight}
          label="Highlight"
          onAction={() => editor.tf.highlight.toggle()}
        >
          <Highlighter size={15} weight="bold" />
        </Btn>
      ),
    },
    {
      id: "code",
      group: "marks2",
      node: (
        <Btn active={isCode} label="Inline code" onAction={() => editor.tf.code.toggle()}>
          <Code size={15} weight="bold" />
        </Btn>
      ),
    },
    {
      id: "sup",
      group: "marks2",
      node: (
        <Btn
          active={isSuperscript}
          label="Superscript"
          onAction={() => editor.tf.superscript.toggle()}
        >
          <TextSuperscript size={15} weight="bold" />
        </Btn>
      ),
    },
    {
      id: "sub",
      group: "marks2",
      node: (
        <Btn
          active={isSubscript}
          label="Subscript"
          onAction={() => editor.tf.subscript.toggle()}
        >
          <TextSubscript size={15} weight="bold" />
        </Btn>
      ),
    },
    {
      id: "alignLeft",
      group: "align",
      node: (
        <Btn label="Align left" onAction={() => editor.tf.textAlign.setNodes("left")}>
          <TextAlignLeft size={15} weight="bold" />
        </Btn>
      ),
    },
    {
      id: "alignCenter",
      group: "align",
      node: (
        <Btn label="Align center" onAction={() => editor.tf.textAlign.setNodes("center")}>
          <TextAlignCenter size={15} weight="bold" />
        </Btn>
      ),
    },
    {
      id: "alignRight",
      group: "align",
      node: (
        <Btn label="Align right" onAction={() => editor.tf.textAlign.setNodes("right")}>
          <TextAlignRight size={15} weight="bold" />
        </Btn>
      ),
    },
    {
      id: "justify",
      group: "align",
      node: (
        <Btn label="Justify" onAction={() => editor.tf.textAlign.setNodes("justify")}>
          <TextAlignJustify size={15} weight="bold" />
        </Btn>
      ),
    },
    {
      id: "ul",
      group: "list",
      node: (
        <Btn active={isUl} label="Bulleted list" onAction={() => editor.tf.ul.toggle()}>
          <ListBullets size={15} weight="bold" />
        </Btn>
      ),
    },
    {
      id: "ol",
      group: "list",
      node: (
        <Btn active={isOl} label="Numbered list" onAction={() => editor.tf.ol.toggle()}>
          <ListNumbers size={15} weight="bold" />
        </Btn>
      ),
    },
    {
      id: "checklist",
      group: "list",
      node: (
        <Btn label="Checklist" onAction={() => editor.tf.taskList.toggle()}>
          <CheckSquare size={15} weight="bold" />
        </Btn>
      ),
    },
    {
      id: "lineHeight",
      group: "spacing",
      node: (
        <EditorSelect
          value={activeLineHeight}
          options={LINE_HEIGHT_OPTIONS}
          onChange={(val) => editor.tf.lineHeight.setNodes(val)}
          placeholder="Spacing"
          width={92}
          ariaLabel="Line spacing"
        />
      ),
    },
    {
      id: "link",
      group: "insert",
      node: <LinkControl editor={editor} />,
    },
    {
      id: "hr",
      group: "insert",
      node: (
        <Btn
          label="Horizontal rule"
          onAction={() => editor.tf.insertNodes({ type: "hr", children: [{ text: "" }] })}
        >
          <Minus size={15} weight="bold" />
        </Btn>
      ),
    },
    ...(onImageUpload
      ? [
          {
            id: "image",
            group: "insert",
            node: (
              <Btn
                label="Insert image"
                onAction={() => imageInputRef.current?.click()}
              >
                <ImageSquare size={15} weight="bold" />
              </Btn>
            ),
          },
        ]
      : []),
    {
      id: "pageBreak",
      group: "insert",
      node: (
        <Btn
          label="Page break"
          onAction={() =>
            editor.tf.insertNodes({ type: "page_break", children: [{ text: "" }] })
          }
        >
          <FileDashed size={15} weight="bold" />
        </Btn>
      ),
    },
  ];

  // ---- Responsive overflow machinery ----
  const primaryRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map());
  const rightEdge = useRef<Map<string, number>>(new Map());
  const tier2IdsRef = useRef<string[]>([]);
  tier2IdsRef.current = tier2Items.map((it) => it.id);

  const [measured, setMeasured] = useState(false);
  const [visibleCount, setVisibleCount] = useState(tier2Items.length);

  const setItemRef = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      if (el) itemRefs.current.set(id, el);
      else itemRefs.current.delete(id);
    },
    [],
  );

  // Measure each Tier-2 item's right edge (relative to the measured region's
  // left) once, from the initial all-inline render. Right edges include the
  // Tier-1 controls and group dividers ahead of each item, so the split point
  // is divider-accurate. Widths are fixed by design, so no re-measure is needed.
  useLayoutEffect(() => {
    if (measured) return;
    const primary = primaryRef.current;
    if (!primary) return;
    const pLeft = primary.getBoundingClientRect().left;
    for (const id of tier2IdsRef.current) {
      const el = itemRefs.current.get(id);
      if (el) rightEdge.current.set(id, el.getBoundingClientRect().right - pLeft);
    }
    setMeasured(true);
    // Mount-only: the item set and its widths are fixed for this editor.
  }, [measured]);

  const recompute = useCallback(() => {
    const primary = primaryRef.current;
    if (!primary) return;
    const ids = tier2IdsRef.current;
    if (ids.length === 0) return;
    const available = primary.clientWidth - BUFFER;
    const lastEdge = rightEdge.current.get(ids[ids.length - 1]);
    // Before measurement, edges are absent → keep everything inline.
    if (lastEdge === undefined) {
      setVisibleCount(ids.length);
      return;
    }
    if (lastEdge <= available) {
      setVisibleCount(ids.length);
      return;
    }
    let count = 0;
    for (const id of ids) {
      const e = rightEdge.current.get(id) ?? 0;
      if (e + MORE_RESERVE > available) break;
      count++;
    }
    setVisibleCount(count);
  }, []);

  useLayoutEffect(() => {
    if (measured) recompute();
  }, [measured, recompute]);

  useEffect(() => {
    const primary = primaryRef.current;
    if (!primary) return;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      // Defer to the next frame so the observer cannot loop on its own
      // mutations and the "ResizeObserver loop" warning cannot fire.
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(recompute);
    });
    ro.observe(primary);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [recompute]);

  // ---- Render helpers ----
  function renderInlineSequence(seq: ToolbarItem[]): ReactNode[] {
    const out: ReactNode[] = [];
    let prevGroup: string | undefined;
    for (const it of seq) {
      if (prevGroup !== undefined && it.group !== prevGroup) {
        out.push(<span key={`div-${it.id}`} className={base.divider} aria-hidden />);
      }
      out.push(
        <div key={it.id} ref={setItemRef(it.id)} className={tStyles.item}>
          {it.node}
        </div>,
      );
      prevGroup = it.group;
    }
    return out;
  }

  const inlineItems = [...tier1Items, ...tier2Items.slice(0, visibleCount)];
  const overflowItems = tier2Items.slice(visibleCount);

  return (
    <div className={tStyles.wrap}>
      <div ref={primaryRef} className={tStyles.primary}>
        {renderInlineSequence(inlineItems)}
        {overflowItems.length > 0 && (
          <>
            <span className={base.divider} aria-hidden />
            <MoreButton>
              {overflowItems.map((it) => (
                <div key={it.id} ref={setItemRef(it.id)} className={tStyles.item}>
                  {it.node}
                </div>
              ))}
            </MoreButton>
          </>
        )}
      </div>

      <div className={tStyles.rightSlot}>{rightSlot}</div>

      {onImageUpload ? (
        <input
          ref={imageInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          hidden
          onChange={handleImagePick}
        />
      ) : null}
    </div>
  );
}
