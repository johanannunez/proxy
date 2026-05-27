"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Color from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import {
  TextB,
  TextItalic,
  TextUnderline,
  TextStrikethrough,
  ListBullets,
  ListNumbers,
  TextAlignLeft,
  TextAlignCenter,
  TextAlignRight,
  LinkSimple,
  ImageSquare,
  ArrowCounterClockwise,
  ArrowClockwise,
  Quotes,
  TextHOne,
  TextHTwo,
  TextHThree,
  Minus,
} from "@phosphor-icons/react";
import { useCallback, useRef, useState } from "react";

type Props = {
  content?: string;
  placeholder?: string;
  onChange?: (html: string) => void;
  /** Dark theme for admin */
  dark?: boolean;
};

const FONT_FAMILIES = [
  { label: "Default", value: "" },
  { label: "Serif", value: "Georgia, serif" },
  { label: "Mono", value: "ui-monospace, monospace" },
];

const FONT_SIZES = ["12", "14", "16", "18", "20", "24", "28", "32"];

export function RichTextEditor({ content = "", placeholder = "Write a message...", onChange, dark = false }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextStyle,
      Color,
      FontFamily,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "underline text-[var(--color-brand-light)]" } }),
      Image.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate: ({ editor: e }) => {
      onChange?.(e.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[120px] px-4 py-3",
      },
    },
  });

  const addLink = useCallback(() => {
    if (!editor) return;
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
      setLinkUrl("");
      setShowLinkInput(false);
      return;
    }
    setShowLinkInput(true);
  }, [editor]);

  const applyLink = useCallback(() => {
    if (!editor) return;
    const url = linkUrl.trim();
    if (!url) return;
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    setLinkUrl("");
    setShowLinkInput(false);
  }, [editor, linkUrl]);

  const addImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !editor) return;

      // For now, convert to base64 data URL. In production this would upload to Supabase Storage.
      const reader = new FileReader();
      reader.onload = () => {
        const url = reader.result as string;
        editor.chain().focus().setImage({ src: url }).run();
      };
      reader.readAsDataURL(file);

      // Reset input so the same file can be selected again
      e.target.value = "";
    },
    [editor],
  );

  if (!editor) return null;

  const bg = dark ? "var(--color-charcoal)" : "var(--color-white)";
  const border = dark ? "rgba(255,255,255,0.08)" : "var(--color-warm-gray-200)";
  const toolbarBg = dark ? "rgba(255,255,255,0.03)" : "var(--color-warm-gray-50)";
  const textColor = dark ? "white" : "var(--color-text-primary)";
  const mutedColor = dark ? "rgba(255,255,255,0.5)" : "var(--color-text-tertiary)";

  return (
    <div
      className="overflow-hidden rounded-xl border"
      style={{ borderColor: border, backgroundColor: bg }}
    >
      {/* Toolbar Row 1: Font + Text Formatting */}
      <div
        className="flex flex-wrap items-center gap-1 border-b px-2 py-1.5"
        style={{ borderColor: border, backgroundColor: toolbarBg }}
      >
        {/* Font Family */}
        <select
          className="h-7 rounded border-none bg-transparent px-1.5 text-xs focus:outline-none"
          style={{ color: mutedColor }}
          value={editor.getAttributes("textStyle").fontFamily ?? ""}
          onChange={(e) => {
            if (e.target.value) {
              editor.chain().focus().setFontFamily(e.target.value).run();
            } else {
              editor.chain().focus().unsetFontFamily().run();
            }
          }}
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>

        {/* Font Size */}
        <select
          className="h-7 rounded border-none bg-transparent px-1.5 text-xs focus:outline-none"
          style={{ color: mutedColor }}
          onChange={(e) => {
            editor.chain().focus().setMark("textStyle", { fontSize: `${e.target.value}px` }).run();
          }}
          defaultValue="16"
        >
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}px
            </option>
          ))}
        </select>

        <ToolbarDivider dark={dark} />

        <ToolbarBtn
          icon={<TextB size={16} weight="bold" />}
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          dark={dark}
          title="Bold"
        />
        <ToolbarBtn
          icon={<TextItalic size={16} />}
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          dark={dark}
          title="Italic"
        />
        <ToolbarBtn
          icon={<TextUnderline size={16} />}
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          dark={dark}
          title="Underline"
        />
        <ToolbarBtn
          icon={<TextStrikethrough size={16} />}
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          dark={dark}
          title="Strikethrough"
        />

        <ToolbarDivider dark={dark} />

        {/* Text Color */}
        <label className="relative cursor-pointer" title="Text color">
          <input
            type="color"
            className="absolute inset-0 h-0 w-0 opacity-0"
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          />
          <span
            className="flex h-7 w-7 items-center justify-center rounded text-xs font-bold transition-colors"
            style={{
              color: editor.getAttributes("textStyle").color ?? textColor,
              backgroundColor: "transparent",
            }}
          >
            A
          </span>
        </label>

        {/* Highlight */}
        <label className="relative cursor-pointer" title="Highlight color">
          <input
            type="color"
            className="absolute inset-0 h-0 w-0 opacity-0"
            defaultValue="#fef08a"
            onChange={(e) => editor.chain().focus().toggleHighlight({ color: e.target.value }).run()}
          />
          <span
            className="flex h-7 w-7 items-center justify-center rounded text-xs font-bold transition-colors"
            style={{
              backgroundColor: "#fef08a",
              color: "var(--color-text-primary)",
              borderRadius: "4px",
            }}
          >
            H
          </span>
        </label>
      </div>

      {/* Toolbar Row 2: Structure + Media */}
      <div
        className="flex flex-wrap items-center gap-1 border-b px-2 py-1.5"
        style={{ borderColor: border, backgroundColor: toolbarBg }}
      >
        <ToolbarBtn
          icon={<TextHOne size={16} />}
          active={editor.isActive("heading", { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          dark={dark}
          title="Heading 1"
        />
        <ToolbarBtn
          icon={<TextHTwo size={16} />}
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          dark={dark}
          title="Heading 2"
        />
        <ToolbarBtn
          icon={<TextHThree size={16} />}
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          dark={dark}
          title="Heading 3"
        />

        <ToolbarDivider dark={dark} />

        <ToolbarBtn
          icon={<ListBullets size={16} />}
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          dark={dark}
          title="Bullet list"
        />
        <ToolbarBtn
          icon={<ListNumbers size={16} />}
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          dark={dark}
          title="Numbered list"
        />
        <ToolbarBtn
          icon={<Quotes size={16} />}
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          dark={dark}
          title="Blockquote"
        />

        <ToolbarDivider dark={dark} />

        <ToolbarBtn
          icon={<TextAlignLeft size={16} />}
          active={editor.isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          dark={dark}
          title="Align left"
        />
        <ToolbarBtn
          icon={<TextAlignCenter size={16} />}
          active={editor.isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          dark={dark}
          title="Align center"
        />
        <ToolbarBtn
          icon={<TextAlignRight size={16} />}
          active={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          dark={dark}
          title="Align right"
        />

        <ToolbarDivider dark={dark} />

        <ToolbarBtn
          icon={<LinkSimple size={16} />}
          active={editor.isActive("link")}
          onClick={addLink}
          dark={dark}
          title="Insert link"
        />
        {showLinkInput ? (
          <div className="flex items-center gap-1">
            <input
              type="url"
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyLink();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setShowLinkInput(false);
                  setLinkUrl("");
                }
              }}
              placeholder="https://"
              className="h-7 w-44 rounded border bg-transparent px-2 text-xs focus:outline-none"
              style={{ borderColor: border, color: textColor }}
            />
            <button
              type="button"
              onClick={applyLink}
              disabled={!linkUrl.trim()}
              className="h-7 rounded px-2 text-xs font-medium disabled:opacity-40"
              style={{ backgroundColor: toolbarBg, color: textColor }}
            >
              Apply
            </button>
          </div>
        ) : null}
        <ToolbarBtn
          icon={<ImageSquare size={16} />}
          active={false}
          onClick={addImage}
          dark={dark}
          title="Insert image"
        />
        <ToolbarBtn
          icon={<Minus size={16} />}
          active={false}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          dark={dark}
          title="Horizontal rule"
        />

        <ToolbarDivider dark={dark} />

        <ToolbarBtn
          icon={<ArrowCounterClockwise size={16} />}
          active={false}
          onClick={() => editor.chain().focus().undo().run()}
          dark={dark}
          title="Undo"
          disabled={!editor.can().undo()}
        />
        <ToolbarBtn
          icon={<ArrowClockwise size={16} />}
          active={false}
          onClick={() => editor.chain().focus().redo().run()}
          dark={dark}
          title="Redo"
          disabled={!editor.can().redo()}
        />
      </div>

      {/* Editor Content */}
      <div style={{ color: textColor }}>
        <EditorContent editor={editor} />
      </div>

      {/* Hidden file input for image uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />
    </div>
  );
}

function ToolbarBtn({
  icon,
  active,
  onClick,
  dark,
  title,
  disabled = false,
}: {
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  dark: boolean;
  title: string;
  disabled?: boolean;
}) {
  const activeBg = dark ? "rgba(255,255,255,0.1)" : "var(--color-warm-gray-200)";
  const hoverBg = dark ? "rgba(255,255,255,0.06)" : "var(--color-warm-gray-100)";
  const color = dark
    ? active ? "white" : "rgba(255,255,255,0.6)"
    : active ? "var(--color-text-primary)" : "var(--color-text-tertiary)";

  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded transition-colors disabled:opacity-30"
      style={{
        color,
        backgroundColor: active ? activeBg : "transparent",
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.backgroundColor = hoverBg;
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      {icon}
    </button>
  );
}

function ToolbarDivider({ dark }: { dark: boolean }) {
  return (
    <div
      className="mx-1 h-5 w-px"
      style={{ backgroundColor: dark ? "rgba(255,255,255,0.08)" : "var(--color-warm-gray-200)" }}
    />
  );
}
