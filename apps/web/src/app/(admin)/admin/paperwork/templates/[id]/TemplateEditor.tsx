"use client";

/**
 * TemplateEditor — Plate v53 rich-text editor for HTML-authored document
 * templates. Rendered on the "Write" tab only. The "Fields" tab (DocuSeal
 * builder) handles all signature/field placement after content is saved here.
 *
 * Save flow:
 *  1. valueToHtml(editor.children) -> a clean, semantic HTML fragment.
 *  2. saveTemplateHtmlAction wraps the fragment in the document shell and mints
 *     a fresh DocuSeal template, storing source_html + docuseal_template_id.
 *  3. router.refresh() so the parent sees the new DocuSeal id (Fields tab opens).
 *
 * Every save mints a new DocuSeal template, which resets field positions, so a
 * warning banner appears whenever there are unsaved changes over an existing
 * signing layout.
 *
 * v1 scope: headings, bold/italic/underline, bulleted + numbered lists. Tables
 * are supported by the serializer/loader but are not yet a toolbar action.
 */

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import type { Value } from "platejs";
import {
  Plate,
  PlateContent,
  PlateElement,
  ParagraphPlugin,
  usePlateEditor,
  useEditorSelector,
} from "platejs/react";
import {
  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,
  H1Plugin,
  H2Plugin,
  H3Plugin,
} from "@platejs/basic-nodes/react";
import {
  ListPlugin,
  BulletedListPlugin,
  NumberedListPlugin,
  ListItemPlugin,
  ListItemContentPlugin,
} from "@platejs/list-classic/react";
import {
  TextB,
  TextItalic,
  TextUnderline,
  ListBullets,
  ListNumbers,
  FloppyDisk,
  Warning,
  SpinnerGap,
} from "@phosphor-icons/react";
import { valueToHtml, type SerializableNode } from "./html-serialize";
import { saveTemplateHtmlAction } from "../html-actions";
import styles from "./TemplateEditor.module.css";

/* ---- Semantic element components -------------------------------------- *
 * v53 plugins ship no default visual component, so we attach minimal ones
 * that render real HTML tags. This keeps the on-screen document semantic and
 * lets the page CSS (which targets h1/p/ul/li) style it like the final PDF. */

type ElProps = ComponentProps<typeof PlateElement>;

const H1El = (props: ElProps) => <PlateElement as="h1" {...props} />;
const H2El = (props: ElProps) => <PlateElement as="h2" {...props} />;
const H3El = (props: ElProps) => <PlateElement as="h3" {...props} />;
const PEl = (props: ElProps) => <PlateElement as="p" {...props} />;
const UlEl = (props: ElProps) => <PlateElement as="ul" {...props} />;
const OlEl = (props: ElProps) => <PlateElement as="ol" {...props} />;
const LiEl = (props: ElProps) => <PlateElement as="li" {...props} />;
const LicEl = (props: ElProps) => <PlateElement as="div" {...props} />;

const EDITOR_PLUGINS = [
  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,
  ParagraphPlugin.withComponent(PEl),
  H1Plugin.withComponent(H1El),
  H2Plugin.withComponent(H2El),
  H3Plugin.withComponent(H3El),
  ListPlugin,
  BulletedListPlugin.withComponent(UlEl),
  NumberedListPlugin.withComponent(OlEl),
  ListItemPlugin.withComponent(LiEl),
  ListItemContentPlugin.withComponent(LicEl),
];

const EMPTY_VALUE: Value = [{ type: "p", children: [{ text: "" }] }];

/**
 * Builds the editor. Extracted so its concrete return type (which carries the
 * plugin-injected transforms like tf.h1 / tf.bold / tf.ul) can be named and
 * passed to the toolbar. useEditorRef() would erase those plugin transforms.
 */
function useTemplateEditor() {
  return usePlateEditor({ plugins: EDITOR_PLUGINS, value: EMPTY_VALUE });
}

type TemplateEditorInstance = ReturnType<typeof useTemplateEditor>;

/* ---- Toolbar ---------------------------------------------------------- *
 * Lives inside <Plate> so it can read live formatting state via
 * useEditorSelector. Actions run through the fully-typed editor passed in. */

function ToolbarButton({
  active,
  label,
  wide,
  onToggle,
  children,
}: {
  active: boolean;
  label: string;
  wide?: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`${styles.btn} ${wide ? styles.btnWide : ""} ${active ? styles.btnActive : ""}`}
      aria-label={label}
      aria-pressed={active}
      title={label}
      // Prevent the mousedown from stealing selection/focus from the editor.
      onMouseDown={(e) => {
        e.preventDefault();
        onToggle();
      }}
    >
      {children}
    </button>
  );
}

function EditorToolbar({
  editor,
  dirty,
  saving,
  onSave,
}: {
  editor: TemplateEditorInstance;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
}) {
  const isBold = useEditorSelector((ed) => Boolean(ed.api.marks()?.bold), []);
  const isItalic = useEditorSelector((ed) => Boolean(ed.api.marks()?.italic), []);
  const isUnderline = useEditorSelector((ed) => Boolean(ed.api.marks()?.underline), []);
  const isH1 = useEditorSelector((ed) => ed.api.some({ match: { type: "h1" } }), []);
  const isH2 = useEditorSelector((ed) => ed.api.some({ match: { type: "h2" } }), []);
  const isH3 = useEditorSelector((ed) => ed.api.some({ match: { type: "h3" } }), []);
  const isUl = useEditorSelector((ed) => ed.api.some({ match: { type: "ul" } }), []);
  const isOl = useEditorSelector((ed) => ed.api.some({ match: { type: "ol" } }), []);

  return (
    <div className={styles.toolbar}>
      <div className={styles.group}>
        <ToolbarButton wide label="Heading 1" active={isH1} onToggle={() => editor.tf.h1.toggle()}>
          H1
        </ToolbarButton>
        <ToolbarButton wide label="Heading 2" active={isH2} onToggle={() => editor.tf.h2.toggle()}>
          H2
        </ToolbarButton>
        <ToolbarButton wide label="Heading 3" active={isH3} onToggle={() => editor.tf.h3.toggle()}>
          H3
        </ToolbarButton>
      </div>

      <span className={styles.divider} aria-hidden />

      <div className={styles.group}>
        <ToolbarButton label="Bold" active={isBold} onToggle={() => editor.tf.bold.toggle()}>
          <TextB size={15} weight="bold" />
        </ToolbarButton>
        <ToolbarButton label="Italic" active={isItalic} onToggle={() => editor.tf.italic.toggle()}>
          <TextItalic size={15} weight="bold" />
        </ToolbarButton>
        <ToolbarButton
          label="Underline"
          active={isUnderline}
          onToggle={() => editor.tf.underline.toggle()}
        >
          <TextUnderline size={15} weight="bold" />
        </ToolbarButton>
      </div>

      <span className={styles.divider} aria-hidden />

      <div className={styles.group}>
        <ToolbarButton label="Bulleted list" active={isUl} onToggle={() => editor.tf.ul.toggle()}>
          <ListBullets size={15} weight="bold" />
        </ToolbarButton>
        <ToolbarButton label="Numbered list" active={isOl} onToggle={() => editor.tf.ol.toggle()}>
          <ListNumbers size={15} weight="bold" />
        </ToolbarButton>
      </div>

      <span className={styles.spacer} />

      <div className={styles.saveArea}>
        {dirty && <span className={styles.dirtyDot} aria-label="Unsaved changes" />}
        <button
          type="button"
          className={styles.saveBtn}
          onClick={onSave}
          disabled={saving || !dirty}
        >
          {saving ? (
            <>
              <SpinnerGap size={14} weight="bold" className={styles.spin} />
              Saving
            </>
          ) : (
            <>
              <FloppyDisk size={14} weight="bold" />
              Save document
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export function TemplateEditor({
  templateId,
  initialHtml,
  hasExistingDocusealId,
}: {
  templateId: string;
  initialHtml: string;
  hasExistingDocusealId: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedOnce, setSavedOnce] = useState(false);

  // The editor starts empty (SSR-safe: no DOM access during render). Existing
  // HTML is loaded after mount, on the client, where deserialize has a DOM.
  const editor = useTemplateEditor();

  // Gate dirty-tracking until after the programmatic load so neither the load
  // nor any mount-time normalization marks the document dirty.
  const trackEdits = useRef(false);

  useEffect(() => {
    if (initialHtml) {
      // History-safe load: withoutSaving keeps the loaded content off the undo
      // stack, so the user's first Ctrl+Z cannot wipe the document.
      editor.tf.withoutSaving(() => {
        // deserialize returns Descendant[]; the top-level editor value is a
        // Value (TElement[]). The cast bridges the two compatible shapes.
        const value = editor.api.html.deserialize({ element: initialHtml }) as Value;
        editor.tf.setValue(value);
      });
    }
    const id = window.setTimeout(() => {
      trackEdits.current = true;
    }, 0);
    return () => window.clearTimeout(id);
    // Mount-only: editor is stable and initialHtml is fixed for this template.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const html = valueToHtml(editor.children as unknown as SerializableNode[]);
      const result = await saveTemplateHtmlAction(templateId, html);
      if (!result.ok) {
        setSaveError(result.error);
        return;
      }
      setDirty(false);
      setSavedOnce(true);
      // Re-fetch the server component so the new DocuSeal id flows in and the
      // Fields tab unlocks.
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  // Saving always resets the DocuSeal field layout once a signing template
  // exists (first save here, or one created earlier).
  const showResetWarning = (hasExistingDocusealId || savedOnce) && dirty;

  return (
    <div className={styles.editorWrap}>
      <Plate
        editor={editor}
        onChange={() => {
          if (trackEdits.current) setDirty(true);
        }}
      >
        <EditorToolbar editor={editor} dirty={dirty} saving={saving} onSave={handleSave} />

        {(showResetWarning || saveError) && (
          <div className={styles.notices}>
            {showResetWarning && (
              <div className={styles.warning} role="status">
                <Warning size={15} weight="fill" />
                <span>
                  Saving replaces the signing layout. Re-check the Fields tab and
                  re-place any fields after you save.
                </span>
              </div>
            )}
            {saveError && (
              <div className={styles.error} role="alert">
                <Warning size={15} weight="fill" />
                <span>{saveError}</span>
              </div>
            )}
          </div>
        )}

        <div className={styles.canvas}>
          <div className={styles.page}>
            <PlateContent
              className={styles.editable}
              placeholder="Start writing the document…"
              aria-label="Document content"
            />
          </div>
        </div>
      </Plate>
    </div>
  );
}
