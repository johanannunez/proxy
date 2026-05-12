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
  X,
} from "@phosphor-icons/react";
import { useCallback, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CustomSelect } from "@/components/admin/CustomSelect";
import LinkInsertModal from "./LinkInsertModal";

type Props = {
  content?: string;
  placeholder?: string;
  onChange?: (html: string) => void;
  /** Dark theme for admin. */
  dark?: boolean;
};

const FONT_FAMILIES = [
  { label: "Default", value: "" },
  { label: "Serif", value: "Georgia, serif" },
  { label: "Mono", value: "ui-monospace, monospace" },
];

const FONT_SIZES = [
  { label: "12px", value: "12" },
  { label: "14px", value: "14" },
  { label: "16px", value: "16" },
  { label: "18px", value: "18" },
  { label: "20px", value: "20" },
  { label: "24px", value: "24" },
  { label: "28px", value: "28" },
  { label: "32px", value: "32" },
];

const DEFAULT_FONT_SIZE = "16";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const TextStyleWithFontSize = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: (element) => element.style.fontSize?.replace(/['"]+/g, "") || null,
        renderHTML: (attributes) => {
          if (!attributes.fontSize) return {};
          return { style: `font-size: ${attributes.fontSize}` };
        },
      },
    };
  },
});

type LinkModalState =
  | { open: false }
  | { open: true; initialUrl: string; initialText: string; hasSelection: boolean; isEditing: boolean };

type UploadState =
  | { phase: "idle" }
  | { phase: "uploading"; progress: number; fileName: string }
  | { phase: "error"; message: string };

export function RichTextEditor({ content = "", placeholder = "Write a message...", onChange, dark = false }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [linkModal, setLinkModal] = useState<LinkModalState>({ open: false });
  const [upload, setUpload] = useState<UploadState>({ phase: "idle" });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextStyleWithFontSize,
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

  const openLinkModal = useCallback(() => {
    if (!editor) return;
    const { from, to, empty } = editor.state.selection;
    const existing = editor.getAttributes("link") as { href?: string };
    const selectedText = empty ? "" : editor.state.doc.textBetween(from, to, " ");
    setLinkModal({
      open: true,
      initialUrl: existing.href ?? "",
      initialText: selectedText,
      hasSelection: !empty,
      isEditing: Boolean(existing.href),
    });
  }, [editor]);

  const handleLinkSubmit = useCallback(
    ({ url, text }: { url: string; text: string | null }) => {
      if (!editor) return;
      setLinkModal({ open: false });

      const { from, to, empty } = editor.state.selection;
      if (empty) {
        const display = text && text.length > 0 ? text : url;
        editor
          .chain()
          .focus()
          .insertContent({
            type: "text",
            text: display,
            marks: [{ type: "link", attrs: { href: url } }],
          })
          .run();
        return;
      }

      if (text && text.trim().length > 0) {
        editor
          .chain()
          .focus()
          .deleteRange({ from, to })
          .insertContent({
            type: "text",
            text,
            marks: [{ type: "link", attrs: { href: url } }],
          })
          .run();
      } else {
        editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
      }
    },
    [editor],
  );

  const handleLinkCancel = useCallback(() => setLinkModal({ open: false }), []);

  const handleLinkRemove = useCallback(() => {
    if (!editor) return;
    setLinkModal({ open: false });
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
  }, [editor]);

  const openImagePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !editor) return;

      if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        setUpload({
          phase: "error",
          message: "That file type is not supported. Use a JPG, PNG, WebP, or GIF.",
        });
        return;
      }

      if (file.size > MAX_IMAGE_BYTES) {
        setUpload({
          phase: "error",
          message: `That image is too large. Maximum size is 10 MB.`,
        });
        return;
      }

      setUpload({ phase: "uploading", progress: 5, fileName: file.name });

      const supabase = createClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        setUpload({
          phase: "error",
          message: "Your session expired. Refresh the page and try again.",
        });
        return;
      }

      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${userData.user.id}/inline/${timestamp}-${safeName}`;

      setUpload({ phase: "uploading", progress: 35, fileName: file.name });

      const { error: uploadError } = await supabase.storage
        .from("message-attachments")
        .upload(path, file, { contentType: file.type, upsert: false });

      if (uploadError) {
        setUpload({
          phase: "error",
          message: `Upload failed: ${uploadError.message}`,
        });
        return;
      }

      setUpload({ phase: "uploading", progress: 90, fileName: file.name });

      const { data: urlData } = supabase.storage.from("message-attachments").getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      editor.chain().focus().setImage({ src: publicUrl, alt: file.name }).run();
      setUpload({ phase: "idle" });
    },
    [editor],
  );

  const dismissUploadError = useCallback(() => setUpload({ phase: "idle" }), []);

  if (!editor) return null;

  const bg = dark ? "var(--color-charcoal)" : "var(--color-white)";
  const border = dark ? "rgba(255,255,255,0.08)" : "var(--color-warm-gray-200)";
  const toolbarBg = dark ? "rgba(255,255,255,0.03)" : "var(--color-warm-gray-50)";
  const textColor = dark ? "white" : "var(--color-text-primary)";

  const activeFontFamily = (editor.getAttributes("textStyle").fontFamily as string | undefined) ?? "";
  const rawFontSize = (editor.getAttributes("textStyle").fontSize as string | undefined) ?? "";
  const activeFontSize = rawFontSize ? rawFontSize.replace(/px$/i, "") : DEFAULT_FONT_SIZE;
  const fontSizeValue = FONT_SIZES.find((s) => s.value === activeFontSize)?.value ?? DEFAULT_FONT_SIZE;

  return (
    <>
      <div
        className="overflow-hidden rounded-xl border"
        style={{ borderColor: border, backgroundColor: bg }}
      >
        {/* Toolbar Row 1: Font + Text Formatting */}
        <div
          className="flex flex-wrap items-center gap-1 border-b px-2 py-1.5"
          style={{ borderColor: border, backgroundColor: toolbarBg }}
        >
          <CustomSelect
            size="sm"
            width={96}
            transparentTrigger
            value={activeFontFamily}
            options={FONT_FAMILIES}
            onChange={(value) => {
              if (value) {
                editor.chain().focus().setFontFamily(value).run();
              } else {
                editor.chain().focus().unsetFontFamily().run();
              }
            }}
          />

          <CustomSelect
            size="sm"
            width={80}
            transparentTrigger
            value={fontSizeValue}
            options={FONT_SIZES}
            onChange={(value) => {
              editor
                .chain()
                .focus()
                .setMark("textStyle", { fontSize: `${value}px` })
                .run();
            }}
          />

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
              className="flex h-7 w-7 items-center justify-center rounded text-xs font-bold"
              style={{
                color: (editor.getAttributes("textStyle").color as string | undefined) ?? textColor,
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
              className="flex h-7 w-7 items-center justify-center rounded text-xs font-bold"
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
            onClick={openLinkModal}
            dark={dark}
            title={editor.isActive("link") ? "Edit link" : "Insert link"}
          />
          <ToolbarBtn
            icon={<ImageSquare size={16} />}
            active={false}
            onClick={openImagePicker}
            dark={dark}
            title="Insert image"
            disabled={upload.phase === "uploading"}
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

        {/* Upload status strip */}
        {upload.phase === "uploading" ? (
          <div
            aria-live="polite"
            style={{
              position: "relative",
              borderBottom: `1px solid ${border}`,
              backgroundColor: dark ? "rgba(2, 170, 235, 0.08)" : "rgba(2, 170, 235, 0.05)",
              padding: "8px 14px",
              fontSize: "12px",
              color: dark ? "rgba(255,255,255,0.75)" : "var(--color-text-secondary, #555)",
              overflow: "hidden",
            }}
          >
            <span>Uploading {upload.fileName}...</span>
            <div
              style={{
                position: "absolute",
                left: 0,
                bottom: 0,
                height: "2px",
                width: `${upload.progress}%`,
                background: "linear-gradient(90deg, #02AAEB, #1B77BE)",
                transition: "width 0.25s ease",
              }}
            />
          </div>
        ) : null}

        {upload.phase === "error" ? (
          <div
            role="alert"
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "12px",
              borderBottom: `1px solid ${border}`,
              backgroundColor: dark ? "rgba(220, 38, 38, 0.12)" : "rgba(220, 38, 38, 0.06)",
              padding: "10px 14px",
              fontSize: "12px",
              lineHeight: 1.45,
              color: dark ? "#fecaca" : "#b91c1c",
            }}
          >
            <span>{upload.message}</span>
            <button
              type="button"
              onClick={dismissUploadError}
              aria-label="Dismiss error"
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "inherit",
                opacity: 0.7,
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "opacity 0.12s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
            >
              <X size={14} weight="bold" />
            </button>
          </div>
        ) : null}

        {/* Editor Content */}
        <div style={{ color: textColor }}>
          <EditorContent editor={editor} />
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleImageUpload}
        />
      </div>

      <LinkInsertModal
        open={linkModal.open}
        initialUrl={linkModal.open ? linkModal.initialUrl : ""}
        initialText={linkModal.open ? linkModal.initialText : ""}
        hasSelection={linkModal.open ? linkModal.hasSelection : false}
        isEditing={linkModal.open ? linkModal.isEditing : false}
        onSubmit={handleLinkSubmit}
        onRemove={handleLinkRemove}
        onCancel={handleLinkCancel}
      />
    </>
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
        if (!active && !disabled) e.currentTarget.style.backgroundColor = hoverBg;
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
