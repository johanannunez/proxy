"use client";

import { useEffect, useRef, useState } from "react";
import { pushTemplateNameToDocuSeal } from "./template-actions";
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
          "data-with-title"?: string;
        },
        HTMLElement
      >;
    }
  }
}

type Props = {
  templateId: number;
  dbTemplateId: string;
};

/**
 * Pure builder canvas. The toolbar (document name, Done) lives in the page's
 * single tab-bar row; this component only loads and renders the embedded
 * DocuSeal field builder.
 */
export function DocuSealBuilderView({ templateId, dbTemplateId }: Props) {
  const [session, setSession] = useState<{ token: string; host: string } | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const builderRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;
    setFetchError(null);
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
  // display_name into DocuSeal so the document name matches our chrome.
  useEffect(() => {
    if (!session) return;
    void pushTemplateNameToDocuSeal(dbTemplateId);
  }, [session, dbTemplateId]);

  return (
    <div className={styles.builderArea}>
      {fetchError && (
        <div className={styles.error}>
          <p className={styles.errorText}>{fetchError}</p>
          <button
            type="button"
            className={styles.retryBtn}
            onClick={() => setReloadKey((k) => k + 1)}
          >
            Retry
          </button>
        </div>
      )}
      {!session && !fetchError && (
        <div className={styles.loading}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-mark-v2.png" alt="Loading" className={styles.loadingLogo} />
        </div>
      )}
      {session && (
        // Web component attributes are data-token / data-host (NOT token /
        // host). The template to open is carried inside the JWT payload.
        // data-with-title hides DocuSeal's own document-title editor so the
        // name can only be changed in our editor (single source of truth).
        <docuseal-builder
          ref={builderRef}
          data-token={session.token}
          data-with-title="false"
        />
      )}
    </div>
  );
}
