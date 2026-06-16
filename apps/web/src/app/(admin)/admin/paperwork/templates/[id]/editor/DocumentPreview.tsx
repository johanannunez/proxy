"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { buildPreviewDocument } from "./preview-document";
import styles from "./DocumentPreview.module.css";

export interface DocumentPreviewHandle {
  /** Scroll the iframe to 1-based page index i. */
  scrollToPage(i: number): void;
}

interface Props {
  fragment: string;
  onPageCount?: (n: number) => void;
}

const DEBOUNCE_MS = 400;

export const DocumentPreview = forwardRef<DocumentPreviewHandle, Props>(
  function DocumentPreview({ fragment, onPageCount }, ref) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [rendered, setRendered] = useState(false);

    // Expose scrollToPage via ref — 1-based index matching the PagesRail buttons.
    useImperativeHandle(ref, () => ({
      scrollToPage(i: number) {
        const iframe = iframeRef.current;
        if (!iframe?.contentDocument) return;
        const pages = iframe.contentDocument.querySelectorAll(".pagedjs_page");
        const target = pages[i - 1] as HTMLElement | undefined;
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      },
    }));

    // Rebuild srcdoc whenever fragment changes, debounced to avoid thrash.
    useEffect(() => {
      const timer = setTimeout(() => {
        const iframe = iframeRef.current;
        if (!iframe) return;
        setRendered(false);
        iframe.srcdoc = buildPreviewDocument(fragment);
      }, DEBOUNCE_MS);
      return () => clearTimeout(timer);
    }, [fragment]);

    // Listen for the page count message posted by the preview document.
    useEffect(() => {
      function handleMessage(event: MessageEvent) {
        // srcdoc iframes post with origin null — match on type only.
        if (
          event.data &&
          typeof event.data === "object" &&
          event.data.type === "pagedjs-pages"
        ) {
          const count = event.data.count as number;
          setRendered(true);
          onPageCount?.(count);
        }
      }
      window.addEventListener("message", handleMessage);
      return () => window.removeEventListener("message", handleMessage);
    }, [onPageCount]);

    return (
      <div className={styles.container}>
        <iframe
          ref={iframeRef}
          title="Document preview"
          sandbox="allow-scripts allow-same-origin"
          className={styles.iframe}
        />
        <div
          className={styles.overlay}
          data-hidden={rendered ? "true" : "false"}
          aria-hidden={rendered}
        >
          <span className={styles.renderingLabel}>Rendering preview…</span>
        </div>
      </div>
    );
  },
);
