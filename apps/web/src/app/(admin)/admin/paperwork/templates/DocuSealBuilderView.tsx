"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, PencilSimple, X } from "@phosphor-icons/react";
import {
  pushTemplateNameToDocuSeal,
  pullTemplateNameFromDocuSeal,
  updateTemplateMeta,
} from "./template-actions";
import styles from "./DocuSealBuilderView.module.css";

declare module "react" {
  // The JSX namespace augmentation is the only supported way to register a
  // custom element (<docuseal-builder>) with TypeScript's JSX type checker.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "docuseal-builder": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          "data-token"?: string;
          "data-host"?: string;
        },
        HTMLElement
      >;
    }
  }
}

type Props = {
  templateId: number;
  dbTemplateId: string;
  templateName: string;
  onSave: () => Promise<{ ok: boolean; error?: string } | void>;
  onBack: () => void;
};

export function DocuSealBuilderView({
  templateId,
  dbTemplateId,
  templateName,
  onSave,
  onBack,
}: Props) {
  const [session, setSession] = useState<{ token: string; host: string } | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // The document name is one thing shown in two places (our header + DocuSeal's
  // inline editor). Local state lets the header live-update when a rename inside
  // the builder is pulled back.
  const [name, setName] = useState(templateName);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(templateName);
  const [savingName, setSavingName] = useState(false);
  const builderRef = useRef<HTMLElement>(null);

  async function saveName() {
    const next = draftName.trim();
    if (!next || next === name) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    // Our display_name is the single source of truth; this updates it and
    // pushes the new name into DocuSeal so the document name matches everywhere.
    const res = await updateTemplateMeta(dbTemplateId, { display_name: next });
    setSavingName(false);
    if (res.ok) {
      setName(next);
      setEditingName(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/docuseal/builder-session?templateId=${templateId}`, {
      // Bail out if the session never comes back so the builder shows a clear
      // error and a retry instead of spinning on its loading state forever.
      signal: AbortSignal.timeout(15000),
    })
      .then(async (r) => {
        if (!r.ok) {
          const body = (await r.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "Session fetch failed");
        }
        return r.json() as Promise<{ token: string; host: string }>;
      })
      .then((s) => {
        if (!cancelled) setSession(s);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const timedOut = err instanceof DOMException && err.name === "TimeoutError";
        setFetchError(
          timedOut
            ? "The template builder is taking too long to load. This is usually a slow dev server or DocuSeal API. Retry, or restart the dev server."
            : err instanceof Error && err.message !== "Session fetch failed"
              ? err.message
              : "Could not load the template builder. Check DOCUSEAL_API_TOKEN in Doppler.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [templateId, reloadKey]);

  useEffect(() => {
    if (!session) return;
    if (document.getElementById("docuseal-builder-script")) return;
    const script = document.createElement("script");
    script.id = "docuseal-builder-script";
    script.src = "https://cdn.docuseal.com/js/builder.js";
    script.async = true;
    document.head.appendChild(script);
  }, [session]);

  // Reconcile the document name in our favor when the builder opens: push our
  // display_name into DocuSeal so its inline name matches our chrome.
  useEffect(() => {
    if (!session) return;
    void pushTemplateNameToDocuSeal(dbTemplateId);
  }, [session, dbTemplateId]);

  // DocuSeal autosaves on every change and fires "save" each time. We do NOT
  // navigate on autosave (that was the endless-saving bug); we just show a
  // transient "Saved" indicator and, debounced, pull the document name back so
  // renaming inside the builder updates our name too. Finishing is explicit.
  useEffect(() => {
    const el = builderRef.current;
    if (!el || !session) return;
    let pullTimer: ReturnType<typeof setTimeout> | undefined;
    const handler = () => {
      setSavedAt(Date.now());
      // Pull the (possibly renamed) document name back near-instantly so the
      // header reflects a rename made inside the builder right away.
      clearTimeout(pullTimer);
      pullTimer = setTimeout(async () => {
        const { name: synced } = await pullTemplateNameFromDocuSeal(dbTemplateId);
        if (synced) setName(synced);
      }, 300);
    };
    el.addEventListener("save", handler);
    return () => {
      el.removeEventListener("save", handler);
      clearTimeout(pullTimer);
    };
  }, [session, dbTemplateId]);

  async function handleFinish() {
    setFinishing(true);
    setFinishError(null);
    try {
      const result = await onSave();
      // Readiness gate can refuse activation (a signer has no field). Surface
      // its message inline and re-enable the button so the admin can fix it.
      if (result && result.ok === false) {
        setFinishError(result.error ?? "Could not finish. Try again.");
        setFinishing(false);
        return;
      }
      // On success, onSave navigates away; leave the button in its finishing
      // state so it doesn't flash back before the route changes.
    } catch {
      // Never leave the button stuck on "Finishing…" if activation throws.
      setFinishError("Could not finish. Try again.");
      setFinishing(false);
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack}>
          <ArrowLeft size={15} weight="bold" />
          <span>Back</span>
        </button>
        <div className={styles.headerCenter}>
          {editingName ? (
            <span className={styles.nameEdit}>
              <input
                className={styles.nameInput}
                value={draftName}
                autoFocus
                disabled={savingName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveName();
                  if (e.key === "Escape") {
                    setDraftName(name);
                    setEditingName(false);
                  }
                }}
              />
              <button
                type="button"
                className={styles.nameAction}
                onClick={saveName}
                disabled={savingName}
                aria-label="Save name"
              >
                <Check size={14} weight="bold" />
              </button>
              <button
                type="button"
                className={styles.nameAction}
                onClick={() => {
                  setDraftName(name);
                  setEditingName(false);
                }}
                aria-label="Cancel"
              >
                <X size={14} weight="bold" />
              </button>
            </span>
          ) : (
            <button
              type="button"
              className={styles.nameButton}
              onClick={() => {
                setDraftName(name);
                setEditingName(true);
              }}
              title="Rename document"
            >
              <span className={styles.title}>{name}</span>
              <PencilSimple size={14} weight="bold" className={styles.namePencil} />
            </button>
          )}
          <span className={styles.hint}>Drag fields onto the document. Changes save automatically.</span>
        </div>
        <div className={styles.headerRight}>
          {savedAt !== null && !finishing && (
            <span className={styles.savedPill}>
              <Check size={12} weight="bold" />
              Saved
            </span>
          )}
          <button
            type="button"
            className={styles.doneBtn}
            onClick={handleFinish}
            disabled={finishing}
          >
            {finishing ? "Finishing…" : "Done"}
          </button>
        </div>
      </div>

      <div className={styles.builderArea}>
        {fetchError && (
          <div className={styles.error} style={{ flexDirection: "column", gap: 14, textAlign: "center", padding: "0 24px" }}>
            <p style={{ maxWidth: 460 }}>{fetchError}</p>
            <button
              type="button"
              className={styles.doneBtn}
              onClick={() => {
                setFetchError(null);
                setReloadKey((k) => k + 1);
              }}
            >
              Retry
            </button>
          </div>
        )}
        {finishError && <p className={styles.error}>{finishError}</p>}
        {!session && !fetchError && (
          <div className={styles.loading}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo-mark-v2.png"
              alt="Loading"
              className={styles.loadingLogo}
            />
          </div>
        )}
        {session && (
          // Web component attributes are data-token / data-host (NOT token /
          // host). The template to open is carried inside the JWT payload.
          <docuseal-builder ref={builderRef} data-token={session.token} />
        )}
      </div>
    </div>
  );
}
