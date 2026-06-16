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
 *
 * The plugin set, semantic element components, and the toolbar live in ./editor.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type Ref,
} from "react";
import { useRouter } from "next/navigation";
import type { Value } from "platejs";
import { Plate, PlateContent, usePlateEditor } from "platejs/react";
import { CloudCheck, ArrowsClockwise, Warning, SpinnerGap } from "@phosphor-icons/react";
import { valueToHtml, type SerializableNode } from "./html-serialize";
import { saveTemplateDraftAction, publishTemplateAction } from "../draft-actions";
import { useAutosave, type SaveState } from "./editor/useAutosave";
import { EDITOR_PLUGINS } from "./editor/editor-plugins";
import { EditorToolbar } from "./editor/Toolbar";
import styles from "./TemplateEditor.module.css";

const EMPTY_VALUE: Value = [{ type: "p", children: [{ text: "" }] }];

/**
 * Builds the editor. The value is set at CREATION (not via setValue after mount):
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
      ? (editor) => editor.api.html.deserialize({ element: initialHtml }) as Value
      : EMPTY_VALUE,
  });
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

/** Imperative handle so the parent (Fields-tab switch / publish) can read the
 *  editor's live unpublished state and flush the latest draft before publishing,
 *  instead of relying on a server prop that goes stale after each autosave. */
export type TemplateEditorHandle = {
  flush: () => Promise<void>;
  hasUnpublishedChanges: () => boolean;
};

function TemplateEditorInner({
  templateId,
  initialHtml,
  publishedHtml,
  handleRef,
}: {
  templateId: string;
  initialHtml: string;
  publishedHtml: string;
  handleRef: Ref<TemplateEditorHandle>;
}) {
  const router = useRouter();
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Bound the editor to the viewport so the toolbar and all chrome above it stay
  // pinned and only the document canvas scrolls. Measuring the wrap's own top
  // adapts to any chrome height (responsive, topbar variants) with no magic
  // numbers, and is fully scoped here (the shared admin scroll chain is unsafe
  // to change globally).
  const wrapRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fit = () => {
      const top = el.getBoundingClientRect().top;
      el.style.height = `${Math.max(360, window.innerHeight - top)}px`;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

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

  // Live source of truth for the parent's publish flow (see TemplateEditorHandle).
  useImperativeHandle(
    handleRef,
    () => ({
      flush: () => autosave.flush(),
      hasUnpublishedChanges: () => {
        const cur = serialize();
        if (cur === publishedHtml) return false;
        // An effectively-empty document is not worth publishing.
        return cur.replace(/<p>\s*<\/p>/g, "").trim() !== "";
      },
    }),
    [autosave, serialize, publishedHtml],
  );

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
    <div ref={wrapRef} className={styles.editorWrap}>
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
          rightSlot={
            <div className={styles.saveArea}>
              <SaveStatus state={autosave.state} />
              <button
                type="button"
                className={styles.saveBtn}
                onClick={handleSync}
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
          }
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
export const TemplateEditor = forwardRef<
  TemplateEditorHandle,
  { templateId: string; initialHtml: string; publishedHtml: string }
>(function TemplateEditor(props, ref) {
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
  return <TemplateEditorInner {...props} handleRef={ref} />;
});
