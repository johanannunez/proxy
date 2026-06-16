"use client";

/**
 * EditorToolbar — comprehensive Plate v53 rich-text toolbar.
 *
 * Editor prop type: the concrete plugin-transform type is only available where
 * the editor is created (TemplateEditor.tsx), as it depends on the literal
 * plugin array passed to usePlateEditor. We use a narrow interface covering
 * only the members this file calls to avoid a circular dependency.
 */

import { useRef, useState } from "react";
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
  ArrowsOutLineVertical,
  X,
} from "@phosphor-icons/react";
import { CustomSelect } from "@/components/admin/CustomSelect";
import { FontControls } from "./FontControls";
import base from "../TemplateEditor.module.css";
import tStyles from "./Toolbar.module.css";

/**
 * Narrow editor interface covering only the members this file calls.
 * The concrete plugin-transform type (tf.bold, tf.h1, etc.) is only available
 * where the editor is created; accepting `any` here avoids a circular
 * dependency while keeping usage explicit.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EditorHandle = { tf: any; api: any };

// ---- Block type select -------------------------------------------------

const BLOCK_OPTIONS = [
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

// ---- Line-height select ------------------------------------------------

const LINE_HEIGHT_OPTIONS = [
  { value: "1", label: "Single" },
  { value: "1.15", label: "1.15" },
  { value: "1.5", label: "1.5" },
  { value: "2", label: "Double" },
];

// ---- Shared toolbar button ---------------------------------------------

function Btn({
  active,
  label,
  wide,
  onAction,
  children,
}: {
  active?: boolean;
  label: string;
  wide?: boolean;
  onAction: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={[
        base.btn,
        wide ? base.btnWide : "",
        active ? base.btnActive : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={label}
      aria-pressed={active}
      title={label}
      onMouseDown={(e) => {
        e.preventDefault();
        onAction();
      }}
    >
      {children}
    </button>
  );
}

// ---- Link popover -------------------------------------------------------

function LinkPopoverInner({
  editor,
  onClose,
}: {
  editor: EditorHandle;
  onClose: () => void;
}) {
  const [url, setUrl] = useState("https://");

  function commit() {
    const href = url.trim();
    if (!href || href === "https://") {
      onClose();
      return;
    }
    // Insert a link node containing the URL as its text. When text is
    // selected in the editor, the user should first copy the text, then
    // use this to wrap it — full selection-wrapping requires the link
    // plugin transform which varies by plugin setup.
    editor.tf.insertNodes({
      type: "a",
      url: href,
      children: [{ text: href }],
    });
    onClose();
  }

  return (
    <div className={tStyles.linkPopover} role="dialog" aria-label="Insert link">
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
          if (e.key === "Escape") onClose();
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
          onClose();
        }}
      >
        <X size={13} weight="bold" />
      </button>
    </div>
  );
}

// ---- EditorToolbar (main export) ----------------------------------------

export function EditorToolbar({
  editor,
  rightSlot,
  onImageUpload,
}: {
  editor: EditorHandle;
  rightSlot?: React.ReactNode;
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

  // Mark active states
  const isBold = useEditorSelector(
    (ed) => Boolean(ed.api.marks()?.bold),
    [],
  );
  const isItalic = useEditorSelector(
    (ed) => Boolean(ed.api.marks()?.italic),
    [],
  );
  const isUnderline = useEditorSelector(
    (ed) => Boolean(ed.api.marks()?.underline),
    [],
  );
  const isStrikethrough = useEditorSelector(
    (ed) => Boolean(ed.api.marks()?.strikethrough),
    [],
  );
  const isCode = useEditorSelector(
    (ed) => Boolean(ed.api.marks()?.code),
    [],
  );
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

  // Block type active states
  const isH1 = useEditorSelector(
    (ed) => ed.api.some({ match: { type: "h1" } }),
    [],
  );
  const isH2 = useEditorSelector(
    (ed) => ed.api.some({ match: { type: "h2" } }),
    [],
  );
  const isH3 = useEditorSelector(
    (ed) => ed.api.some({ match: { type: "h3" } }),
    [],
  );
  const isH4 = useEditorSelector(
    (ed) => ed.api.some({ match: { type: "h4" } }),
    [],
  );
  const isH5 = useEditorSelector(
    (ed) => ed.api.some({ match: { type: "h5" } }),
    [],
  );
  const isH6 = useEditorSelector(
    (ed) => ed.api.some({ match: { type: "h6" } }),
    [],
  );
  const isBlockquote = useEditorSelector(
    (ed) => ed.api.some({ match: { type: "blockquote" } }),
    [],
  );
  const isCodeBlock = useEditorSelector(
    (ed) => ed.api.some({ match: { type: "code_block" } }),
    [],
  );
  const isUl = useEditorSelector(
    (ed) => ed.api.some({ match: { type: "ul" } }),
    [],
  );
  const isOl = useEditorSelector(
    (ed) => ed.api.some({ match: { type: "ol" } }),
    [],
  );

  // Derive current block type value for the select
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

  // Active line height
  const activeLineHeight = useEditorSelector(
    (ed) => (ed.api.marks()?.lineHeight as string | undefined) ?? "1",
    [],
  );

  // Link popover state
  const [linkOpen, setLinkOpen] = useState(false);
  const linkAnchorRef = useRef<HTMLDivElement>(null);

  // Handle block type change from the select
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

  return (
    <div className={tStyles.wrap}>
      {/* Group 1: Block type */}
      <div className={base.group}>
        <div className={tStyles.selectWrap}>
          <CustomSelect
            value={blockType}
            options={BLOCK_OPTIONS}
            onChange={handleBlockChange}
          />
        </div>
      </div>

      <span className={base.divider} aria-hidden />

      {/* Group 2: Marks */}
      <div className={base.group}>
        <Btn active={isBold} label="Bold" onAction={() => editor.tf.bold.toggle()}>
          <TextB size={15} weight="bold" />
        </Btn>
        <Btn active={isItalic} label="Italic" onAction={() => editor.tf.italic.toggle()}>
          <TextItalic size={15} weight="bold" />
        </Btn>
        <Btn
          active={isUnderline}
          label="Underline"
          onAction={() => editor.tf.underline.toggle()}
        >
          <TextUnderline size={15} weight="bold" />
        </Btn>
        <Btn
          active={isStrikethrough}
          label="Strikethrough"
          onAction={() => editor.tf.strikethrough.toggle()}
        >
          <TextStrikethrough size={15} weight="bold" />
        </Btn>
        <Btn active={isCode} label="Inline code" onAction={() => editor.tf.code.toggle()}>
          <Code size={15} weight="bold" />
        </Btn>
        <Btn
          active={isSuperscript}
          label="Superscript"
          onAction={() => editor.tf.superscript.toggle()}
        >
          <TextSuperscript size={15} weight="bold" />
        </Btn>
        <Btn
          active={isSubscript}
          label="Subscript"
          onAction={() => editor.tf.subscript.toggle()}
        >
          <TextSubscript size={15} weight="bold" />
        </Btn>
        <Btn
          active={isHighlight}
          label="Highlight"
          onAction={() => editor.tf.highlight.toggle()}
        >
          <Highlighter size={15} weight="bold" />
        </Btn>
      </div>

      <span className={base.divider} aria-hidden />

      {/* Group 3: Font controls (family, size, weight, colors) */}
      <div className={base.group}>
        <FontControls editor={editor} />
      </div>

      <span className={base.divider} aria-hidden />

      {/* Group 4: Paragraph formatting */}
      <div className={base.group}>
        {/* Text alignment */}
        <Btn
          label="Align left"
          onAction={() => editor.tf.textAlign.setNodes("left")}
        >
          <TextAlignLeft size={15} weight="bold" />
        </Btn>
        <Btn
          label="Align center"
          onAction={() => editor.tf.textAlign.setNodes("center")}
        >
          <TextAlignCenter size={15} weight="bold" />
        </Btn>
        <Btn
          label="Align right"
          onAction={() => editor.tf.textAlign.setNodes("right")}
        >
          <TextAlignRight size={15} weight="bold" />
        </Btn>
        <Btn
          label="Justify"
          onAction={() => editor.tf.textAlign.setNodes("justify")}
        >
          <TextAlignJustify size={15} weight="bold" />
        </Btn>

        <span className={base.divider} aria-hidden style={{ height: 14 }} />

        {/* Lists */}
        <Btn
          active={isUl}
          label="Bulleted list"
          onAction={() => editor.tf.ul.toggle()}
        >
          <ListBullets size={15} weight="bold" />
        </Btn>
        <Btn
          active={isOl}
          label="Numbered list"
          onAction={() => editor.tf.ol.toggle()}
        >
          <ListNumbers size={15} weight="bold" />
        </Btn>
        <Btn
          label="Checklist"
          onAction={() => editor.tf.taskList.toggle()}
        >
          <CheckSquare size={15} weight="bold" />
        </Btn>

        <span className={base.divider} aria-hidden style={{ height: 14 }} />

        {/* Line height */}
        <div className={tStyles.selectWrapXs}>
          <CustomSelect
            value={activeLineHeight}
            options={LINE_HEIGHT_OPTIONS}
            placeholder="LH"
            onChange={(val) => editor.tf.lineHeight.setNodes(val)}
          />
        </div>
      </div>

      <span className={base.divider} aria-hidden />

      {/* Group 5: Insert */}
      <div className={base.group}>
        {/* Link — inline popover */}
        <div ref={linkAnchorRef} className={tStyles.linkAnchor}>
          <Btn
            active={linkOpen}
            label="Insert link"
            onAction={() => setLinkOpen((v) => !v)}
          >
            <LinkSimple size={15} weight="bold" />
          </Btn>
          {linkOpen ? (
            <LinkPopoverInner
              editor={editor}
              onClose={() => setLinkOpen(false)}
            />
          ) : null}
        </div>

        {/* Horizontal rule */}
        <Btn
          label="Horizontal rule"
          onAction={() =>
            editor.tf.insertNodes({ type: "hr", children: [{ text: "" }] })
          }
        >
          <Minus size={15} weight="bold" />
        </Btn>

        {/* Image — opens a file picker, uploads, inserts */}
        {onImageUpload ? (
          <>
            <Btn
              label="Insert image"
              onAction={() => imageInputRef.current?.click()}
            >
              <ImageSquare size={15} weight="bold" />
            </Btn>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              hidden
              onChange={handleImagePick}
            />
          </>
        ) : null}

        {/* Page break */}
        <Btn
          label="Page break"
          onAction={() =>
            editor.tf.insertNodes({
              type: "page_break",
              children: [{ text: "" }],
            })
          }
        >
          <FileDashed size={15} weight="bold" />
        </Btn>

        {/* Line-height icon — visual cue for the LH select */}
        <Btn
          label="Line spacing"
          onAction={() => {
            /* triggers the line-height select below visually — no-op */
          }}
        >
          <ArrowsOutLineVertical size={15} weight="bold" />
        </Btn>
      </div>

      {/* Right slot (e.g. save status + publish button from TemplateEditor) */}
      <span className={base.spacer} />
      {rightSlot}
    </div>
  );
}
