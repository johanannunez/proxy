"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { Plate, PlateContent, usePlateEditor, useEditorRef } from "platejs/react";
import {
  BaseBoldPlugin,
  BaseItalicPlugin,
  BaseUnderlinePlugin,
  BaseHeadingPlugin,
  BaseHorizontalRulePlugin,
} from "@platejs/basic-nodes";
import { MarkdownPlugin, deserializeMd, serializeMd } from "@platejs/markdown";
import remarkGfm from "remark-gfm";
import {
  TextB,
  TextItalic,
  TextUnderline,
  TextHOne,
  TextHTwo,
  TextHThree,
} from "@phosphor-icons/react";
import type { PlateEditor } from "platejs/react";
import type { SlateEditor } from "platejs";
import styles from "./DocumentEditor.module.css";

export interface DocumentEditorHandle {
  getMarkdown: () => string;
}

interface Props {
  initialMarkdown?: string;
  placeholder?: string;
  /** "dark" blends the editor into a dark surface (e.g. the AI overlay). */
  theme?: "light" | "dark";
  /** Fires (debounced) with serialized markdown whenever the content changes. */
  onChange?: (markdown: string) => void;
}

const PLUGINS = [
  BaseBoldPlugin,
  BaseItalicPlugin,
  BaseUnderlinePlugin,
  BaseHeadingPlugin,
  BaseHorizontalRulePlugin,
  MarkdownPlugin.configure({
    options: {
      remarkPlugins: [remarkGfm],
    },
  }),
];

const EMPTY_VALUE = [{ type: "p", children: [{ text: "" }] }];

// The editor uses the headless basic-node plugins (no list plugin), so a real
// markdown list would deserialize into an unrendered block and lose its
// markers. Legal documents read fine as marker-prefixed paragraphs, so we
// normalize list items to plain paragraphs that keep "1." / "•" as literal
// text. Escaping the ordered marker stops remark from re-parsing it as a list.
function flattenMarkdownLists(md: string): string {
  return md
    .replace(/^(\s*)(\d+)\.[ \t]+/gm, "$1$2\\. ")
    .replace(/^(\s*)[-*+][ \t]+/gm, "$1• ");
}

// Reverse of flattenMarkdownLists, applied to anything we serialize OUT so the
// stored body stays clean canonical markdown ("1. " / "- "). Without this the
// re-escaped "1\." and literal "•" would leak into the DocuSeal plain-text
// document. The flatten is therefore display-only.
function unflattenMarkdownLists(md: string): string {
  return md
    .replace(/^(\s*)(\d+)\\\.([ \t])/gm, "$1$2.$3")
    .replace(/^(\s*)•[ \t]+/gm, "$1- ");
}

function ToolbarInner() {
  const editor = useEditorRef();

  function toggleMark(mark: string) {
    if (!editor) return;
    const marks = editor.api.marks() as Record<string, boolean> | null;
    const isActive = marks?.[mark] === true;
    if (isActive) {
      editor.tf.removeMark(mark);
    } else {
      editor.tf.addMark(mark, true);
    }
    editor.tf.focus();
  }

  function toggleHeading(level: number) {
    if (!editor) return;
    const block = editor.api.block();
    const currentType = (block?.[0] as { type?: string } | undefined)?.type ?? "p";
    const targetType = `h${level}`;
    editor.tf.setNodes({ type: currentType === targetType ? "p" : targetType });
    editor.tf.focus();
  }

  return (
    <div className={styles.toolbar}>
      <button
        type="button"
        className={styles.toolbarBtn}
        onMouseDown={(e) => { e.preventDefault(); toggleMark("bold"); }}
        title="Bold (⌘B)"
        aria-label="Bold"
      >
        <TextB size={14} weight="bold" />
      </button>
      <button
        type="button"
        className={styles.toolbarBtn}
        onMouseDown={(e) => { e.preventDefault(); toggleMark("italic"); }}
        title="Italic (⌘I)"
        aria-label="Italic"
      >
        <TextItalic size={14} weight="bold" />
      </button>
      <button
        type="button"
        className={styles.toolbarBtn}
        onMouseDown={(e) => { e.preventDefault(); toggleMark("underline"); }}
        title="Underline (⌘U)"
        aria-label="Underline"
      >
        <TextUnderline size={14} weight="bold" />
      </button>
      <span className={styles.toolbarDivider} />
      <button
        type="button"
        className={styles.toolbarBtn}
        onMouseDown={(e) => { e.preventDefault(); toggleHeading(1); }}
        title="Heading 1"
        aria-label="Heading 1"
      >
        <TextHOne size={14} weight="bold" />
      </button>
      <button
        type="button"
        className={styles.toolbarBtn}
        onMouseDown={(e) => { e.preventDefault(); toggleHeading(2); }}
        title="Heading 2"
        aria-label="Heading 2"
      >
        <TextHTwo size={14} weight="bold" />
      </button>
      <button
        type="button"
        className={styles.toolbarBtn}
        onMouseDown={(e) => { e.preventDefault(); toggleHeading(3); }}
        title="Heading 3"
        aria-label="Heading 3"
      >
        <TextHThree size={14} weight="bold" />
      </button>
    </div>
  );
}

function EditorContent({ placeholder }: { placeholder?: string }) {
  // The Base* plugins render nodes natively (slate-h1/h2/h3/p, <strong>/<em>/<u>).
  // Styling lives in the module CSS, scoped to .content via those output classes.
  return (
    <>
      <ToolbarInner />
      <PlateContent
        className={styles.content}
        placeholder={placeholder ?? "Start writing your document…"}
      />
    </>
  );
}

export const DocumentEditor = forwardRef<DocumentEditorHandle, Props>(
  function DocumentEditor({ initialMarkdown = "", placeholder, theme = "light", onChange }, ref) {
    const editor = usePlateEditor(
      {
        plugins: PLUGINS,
        value: (e: PlateEditor) => {
          if (!initialMarkdown) return EMPTY_VALUE;
          try {
            const nodes = deserializeMd(
              e as unknown as SlateEditor,
              flattenMarkdownLists(initialMarkdown),
            );
            return nodes && nodes.length > 0 ? nodes : EMPTY_VALUE;
          } catch {
            return EMPTY_VALUE;
          }
        },
      },
      [],
    );

    useImperativeHandle(ref, () => ({
      getMarkdown: () => {
        if (!editor) return "";
        try {
          return unflattenMarkdownLists(serializeMd(editor as unknown as SlateEditor));
        } catch {
          return "";
        }
      },
    }));

    // Debounced content-change -> markdown, so parents can keep state in sync.
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleValueChange = useCallback(() => {
      if (!onChangeRef.current || !editor) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        try {
          onChangeRef.current?.(
            unflattenMarkdownLists(serializeMd(editor as unknown as SlateEditor)),
          );
        } catch {
          /* serialization failure: keep last good value */
        }
      }, 300);
    }, [editor]);

    useEffect(() => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    }, []);

    if (!editor) return null;

    return (
      <div className={`${styles.wrapper} ${theme === "dark" ? styles.dark : ""}`}>
        <Plate editor={editor} onValueChange={onChange ? handleValueChange : undefined}>
          <EditorContent placeholder={placeholder} />
        </Plate>
      </div>
    );
  }
);
