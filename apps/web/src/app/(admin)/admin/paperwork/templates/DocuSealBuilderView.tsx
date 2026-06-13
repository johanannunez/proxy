"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "@phosphor-icons/react";
import styles from "./DocuSealBuilderView.module.css";

declare module "react" {
  // The JSX namespace augmentation is the only supported way to register a
  // custom element (<docuseal-builder>) with TypeScript's JSX type checker.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "docuseal-builder": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          token?: string;
          "template-id"?: string;
          host?: string;
        },
        HTMLElement
      >;
    }
  }
}

type Props = {
  templateId: number;
  templateName: string;
  onSave: () => void;
  onBack: () => void;
};

export function DocuSealBuilderView({ templateId, templateName, onSave, onBack }: Props) {
  const [session, setSession] = useState<{ token: string; host: string } | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const builderRef = useRef<HTMLElement>(null);

  useEffect(() => {
    fetch(`/api/admin/docuseal/builder-session?templateId=${templateId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Session fetch failed");
        return r.json() as Promise<{ token: string; host: string }>;
      })
      .then(setSession)
      .catch(() =>
        setFetchError("Could not load the template builder. Check DOCUSEAL_API_TOKEN in Doppler."),
      );
  }, [templateId]);

  useEffect(() => {
    if (!session) return;
    if (document.getElementById("docuseal-builder-script")) return;
    const script = document.createElement("script");
    script.id = "docuseal-builder-script";
    script.src = "https://cdn.docuseal.com/js/builder.js";
    script.async = true;
    document.head.appendChild(script);
  }, [session]);

  useEffect(() => {
    const el = builderRef.current;
    if (!el || !session) return;
    const handler = () => {
      setSaving(true);
      onSave();
    };
    el.addEventListener("save", handler);
    return () => el.removeEventListener("save", handler);
  }, [session, onSave]);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack}>
          <ArrowLeft size={15} weight="bold" />
          <span>Back</span>
        </button>
        <div className={styles.headerCenter}>
          <span className={styles.title}>{templateName}</span>
          <span className={styles.hint}>Adjust signature field placements, then save.</span>
        </div>
      </div>

      <div className={styles.builderArea}>
        {fetchError && <p className={styles.error}>{fetchError}</p>}
        {!session && !fetchError && (
          <div className={styles.loading}>
            <span className={styles.loadingDot} />
            <span className={styles.loadingDot} />
            <span className={styles.loadingDot} />
          </div>
        )}
        {session && (
          <docuseal-builder
            ref={builderRef}
            token={session.token}
            template-id={String(templateId)}
            host={session.host}
          />
        )}
      </div>

      {saving && (
        <div className={styles.savingOverlay}>
          <span>Saving template…</span>
        </div>
      )}
    </div>
  );
}
