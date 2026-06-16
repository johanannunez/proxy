"use client";

/**
 * TemplateEditor — Plate v53 rich-text editor for HTML-authored document
 * templates. Rendered on the "Write" tab only. The "Fields" tab (DocuSeal
 * builder) handles all signature/field placement.
 *
 * Save model (v2):
 *  - Draft autosave: edits serialize to HTML and persist to the database via
 *    saveTemplateDraftAction (debounced). Cheap, never loses work, no DocuSeal.
 *  - Publish ("Sync to fields"): publishTemplateAction (re)builds the DocuSeal
 *    template from the current draft and snapshots it. This resets field
 *    positions, so it is deliberate.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
} from "react";
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
  CloudCheck,
  ArrowsClockwise,
  Warning,
  SpinnerGap,
} from "@phosphor-icons/react";
import { valueToHtml, type SerializableNode } from "./html-serialize";
import { saveTemplateDraftAction, publishTemplateAction } from "../draft-actions";
import { useAutosave, type SaveState } from "./editor/useAutosave";
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
 *
 * The value is set at CREATION (not via setValue after mount) for two reasons:
 *  - setValue-after-mount mutates editor.children without re-rendering
 *    PlateContent, so loaded content never appears.
 *  - value-at-creation IS the editor's baseline, so nothing lands on the undo
 *    stack and the user's first Ctrl+Z cannot wipe the loaded document.
 * The deserialize callback runs client-side only: this hook is reached solely
 * from TemplateEditorInner, which renders after mount, so the DOM is available.
 */
function useTemplateEditor(initialHtml: string) {
  return usePlateEditor({
    plugins: EDITOR_PLUGINS,
    value: initialHtml
      ? (editor) =>
          editor.api.html.deserialize({ element: initialHtml }) as Value
      : EMPTY_VALUE,
  });
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

function SaveStatus({ state }: { state: SaveState }) {
  const tone =
    state === "saved" ? styles.saveStatusOk : state === "error" ? styles.saveStatusErr : "";
  return (
    <span className={`${styles.saveStatus} ${tone}`} role="status" aria-live="polite">
      {state === "saving" && (
        <>
          <SpinnerGap size={13} weight="bold" className={styles.spin} /> Saving…
        </>
      )}
      {state === "saved" && (
        <>
          <CloudCheck size={14} weight="fill" /> Saved
        </>
      )}
      {state === "error" && (
        <>
          <Warning size={13} weight="fill" /> Save failed
        </>
      )}
    </span>
  );
}

function EditorToolbar({
  editor,
  saveState,
  publishing,
  onSync,
}: {
  editor: TemplateEditorInstance;
  saveState: SaveState;
  publishing: boolean;
  onSync: () => void;
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
        <SaveStatus state={saveState} />
        <button
          type="button"
          className={styles.saveBtn}
          onClick={onSync}
          disabled={publishing}
          title="Rebuilds the document for signing. Resets field positions in the Fields tab."
        >
          {publishing ? (
            <>
              <SpinnerGap size={14} weight="bold" className={styles.spin} /> Publishing…
            </>
          ) : (
            <>
              <ArrowsClockwise size={14} weight="bold" /> Sync to fields
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function TemplateEditorInner({
  templateId,
  initialHtml,
}: {
  templateId: string;
  initialHtml: string;
}) {
  const router = useRouter();
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Value (including any loaded HTML) is set at creation inside the hook.
  const editor = useTemplateEditor(initialHtml);

  const serialize = useCallback(
    () => valueToHtml(editor.children as unknown as SerializableNode[]),
    [editor],
  );

  const autosave = useAutosave({
    serialize,
    save: (html) => saveTemplateDraftAction(templateId, html),
  });

  // Track edits that may not be flushed yet, for the leave guard.
  const pendingRef = useRef(false);
  useEffect(() => {
    if (autosave.state === "saved") pendingRef.current = false;
  }, [autosave.state]);

  // Ignore the editor's mount-time normalization onChange, and set the autosave
  // baseline to the current serialized content so loading does not autosave.
  const trackEdits = useRef(false);
  useEffect(() => {
    autosave.setBaseline(serialize());
    const id = window.setTimeout(() => {
      trackEdits.current = true;
    }, 0);
    return () => window.clearTimeout(id);
    // Mount-only: editor + initialHtml are fixed for this template.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warn (and flush) before leaving while a draft is unsaved or mid-save.
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (autosave.state !== "saving" && !pendingRef.current) return;
      void autosave.flush();
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [autosave]);

  async function handleSync() {
    setPublishing(true);
    setPublishError(null);
    try {
      // Persist the latest draft before publishing it.
      await autosave.flush();
      const result = await publishTemplateAction(templateId);
      if (!result.ok) {
        setPublishError(result.error);
        return;
      }
      // Re-fetch the server component so the new DocuSeal id flows in and the
      // Fields tab unlocks.
      router.refresh();
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className={styles.editorWrap}>
      <Plate
        editor={editor}
        onChange={() => {
          if (!trackEdits.current) return;
          // onChange also fires on pure cursor moves (set_selection ops). Only a
          // real content change should mark the draft dirty for autosave.
          if (editor.operations.some((op) => op.type !== "set_selection")) {
            pendingRef.current = true;
            autosave.markDirty();
          }
        }}
      >
        <EditorToolbar
          editor={editor}
          saveState={autosave.state}
          publishing={publishing}
          onSync={handleSync}
        />

        {publishError && (
          <div className={styles.notices}>
            <div className={styles.error} role="alert">
              <Warning size={15} weight="fill" />
              <span>{publishError}</span>
            </div>
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

/**
 * Client-only gate. The editor and its deserialize-at-creation value must run
 * only in the browser, where the DOM parser exists; gating on mount also avoids
 * an SSR hydration mismatch between an empty server render and a populated
 * client one. Until mounted, a matching page skeleton holds the layout.
 */
export function TemplateEditor(props: {
  templateId: string;
  initialHtml: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className={styles.editorWrap}>
        <div className={styles.canvas}>
          <div className={styles.page} aria-hidden />
        </div>
      </div>
    );
  }
  return <TemplateEditorInner {...props} />;
}
