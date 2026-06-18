"use client";

/**
 * PDFPreviewModal — full-screen preview of an on-file document. The owner
 * confirms what was submitted without downloading. Animated open/close,
 * focus trapped inside the dialog, Escape and backdrop click close.
 */
import { useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { DownloadSimple, X } from "@phosphor-icons/react";

export interface PDFPreviewModalProps {
  fileUrl: string;
  title: string;
  open: boolean;
  onClose: () => void;
}

function safeHref(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? url : "#";
  } catch {
    return "#";
  }
}

export function PDFPreviewModal({ fileUrl, title, open, onClose }: PDFPreviewModalProps) {
  const reduceMotion = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      // Keyboard trap: cycle Tab focus within the dialog.
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, handleKeyDown]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6"
          style={{ height: "100dvh" }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Preview: ${title}`}
            initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl"
            style={{
              backgroundColor: "var(--color-white)",
              boxShadow: "0 24px 64px rgba(15, 23, 42, 0.32)",
            }}
          >
            {/* Header */}
            <div
              className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3 sm:px-5"
              style={{ borderColor: "var(--color-warm-gray-200)" }}
            >
              <h2
                className="truncate text-sm font-semibold tracking-tight"
                style={{
                  color: "var(--color-text-primary)",
                  fontFamily: "var(--font-sora)",
                }}
              >
                {title}
              </h2>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={safeHref(fileUrl)}
                  download
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors duration-150 hover:bg-[var(--color-warm-gray-50)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)] active:bg-[var(--color-warm-gray-100)]"
                  style={{
                    borderColor: "var(--color-warm-gray-200)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  <DownloadSimple size={14} weight="bold" />
                  Download
                </a>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={onClose}
                  aria-label="Close preview"
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition-colors duration-150 hover:bg-[var(--color-warm-gray-100)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)] active:bg-[var(--color-warm-gray-200)]"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  <X size={17} weight="bold" />
                </button>
              </div>
            </div>

            {/* Document */}
            <div
              className="min-h-0 flex-1"
              style={{ backgroundColor: "var(--color-warm-gray-100)", overflow: "hidden" }}
            >
              <iframe
                src={safeHref(fileUrl)}
                title={title}
                className="h-full w-full border-0"
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
