"use client";

import { useEffect, useRef, useState } from "react";
import { LinkSimple } from "@phosphor-icons/react";

type LinkInsertModalProps = {
  open: boolean;
  /** Optional initial URL. Pre-fills if the cursor is inside an existing link. */
  initialUrl?: string;
  /** Optional initial link text. Pre-fills from the editor's current selection. */
  initialText?: string;
  /** Tells the parent whether the editor had selected text. If true, the text input is hidden. */
  hasSelection?: boolean;
  /** True when editing an existing link. Shows the Remove link action. */
  isEditing?: boolean;
  onSubmit: (payload: { url: string; text: string | null }) => void;
  onRemove?: () => void;
  onCancel: () => void;
};

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^(https?:\/\/|mailto:|tel:)/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    if (!parsed.hostname && !withScheme.startsWith("mailto:") && !withScheme.startsWith("tel:")) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export default function LinkInsertModal({
  open,
  initialUrl = "",
  initialText = "",
  hasSelection = false,
  isEditing = false,
  onSubmit,
  onRemove,
  onCancel,
}: LinkInsertModalProps) {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [url, setUrl] = useState(initialUrl);
  const [text, setText] = useState(initialText);
  const [touched, setTouched] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setVisible(true);
      setAnimating(true);
      setUrl(initialUrl);
      setText(initialText);
      setTouched(false);
      dialogRef.current?.showModal();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimating(false);
          urlInputRef.current?.focus();
          urlInputRef.current?.select();
        });
      });
    } else if (visible) {
      setAnimating(true);
      const timeout = setTimeout(() => {
        dialogRef.current?.close();
        setVisible(false);
        setAnimating(false);
      }, 180);
      return () => clearTimeout(timeout);
    }
  }, [open, visible, initialUrl, initialText]);

  if (!visible) return null;

  const normalized = normalizeUrl(url);
  const showError = touched && url.trim().length > 0 && normalized === null;
  const canSubmit = normalized !== null;

  function handleSubmit() {
    setTouched(true);
    if (!normalized) {
      urlInputRef.current?.focus();
      return;
    }
    const finalText = text.trim() || null;
    onSubmit({ url: normalized, text: finalText });
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        margin: 0,
        padding: 0,
        width: "100vw",
        height: "100vh",
        maxWidth: "100vw",
        maxHeight: "100vh",
        border: "none",
        background: "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onCancel}
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(15, 10, 5, 0.35)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          opacity: open && !animating ? 1 : 0,
          transition: "opacity 0.18s ease",
        }}
      />

      {/* Card */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "420px",
          margin: "0 20px",
          backgroundColor: "var(--color-white, #fff)",
          borderRadius: "18px",
          border: "1px solid rgba(0, 0, 0, 0.06)",
          boxShadow:
            "0 24px 80px rgba(0, 0, 0, 0.12), 0 8px 24px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.03)",
          padding: "28px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          opacity: open && !animating ? 1 : 0,
          transform: open && !animating ? "scale(1) translateY(0)" : "scale(0.96) translateY(6px)",
          transition: "opacity 0.2s ease, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Icon + heading */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "11px",
              backgroundColor: "rgba(2, 170, 235, 0.08)",
              border: "1px solid rgba(2, 170, 235, 0.14)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <LinkSimple size={20} weight="bold" color="#02AAEB" />
          </div>
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: "16px",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "var(--color-text-primary, #1a1a1a)",
                lineHeight: 1.3,
              }}
            >
              {isEditing ? "Edit link" : "Insert link"}
            </h3>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: "13px",
                lineHeight: 1.55,
                color: "var(--color-text-secondary, #666)",
              }}
            >
              Paste any URL. We will add the protocol if it is missing.
            </p>
          </div>
        </div>

        {/* Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <FieldLabel htmlFor="link-insert-url">URL</FieldLabel>
          <input
            ref={urlInputRef}
            id="link-insert-url"
            type="text"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="theparcelco.com/help"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={() => setTouched(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSubmit();
              }
            }}
            aria-invalid={showError}
            aria-describedby={showError ? "link-insert-url-error" : undefined}
            style={inputStyle(showError)}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = showError ? "#ef4444" : "var(--color-brand)";
              e.currentTarget.style.boxShadow = showError
                ? "0 0 0 3px rgba(239, 68, 68, 0.12)"
                : "0 0 0 3px rgba(2, 170, 235, 0.12)";
            }}
          />
          {showError ? (
            <p
              id="link-insert-url-error"
              role="alert"
              style={{
                margin: "-6px 0 0",
                fontSize: "12px",
                lineHeight: 1.4,
                color: "#dc2626",
              }}
            >
              That does not look like a valid URL. Try something like theparcelco.com/help.
            </p>
          ) : null}

          {hasSelection ? null : (
            <>
              <FieldLabel htmlFor="link-insert-text">Link text (optional)</FieldLabel>
              <input
                id="link-insert-text"
                type="text"
                autoComplete="off"
                placeholder="Leave blank to use the URL"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                style={inputStyle(false)}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-brand)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(2, 170, 235, 0.12)";
                }}
              />
            </>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", justifyContent: "flex-end" }}>
          {isEditing && onRemove ? (
            <button
              type="button"
              onClick={onRemove}
              style={removeButtonStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(220, 38, 38, 0.06)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              Remove link
            </button>
          ) : null}
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={onCancel}
            style={cancelButtonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--color-warm-gray-50, #fafafa)";
              e.currentTarget.style.borderColor = "var(--color-warm-gray-300, #d4d4d4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--color-white, #fff)";
              e.currentTarget.style.borderColor = "var(--color-warm-gray-200, #e5e5e5)";
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              ...primaryButtonStyle,
              opacity: canSubmit ? 1 : 0.5,
              cursor: canSubmit ? "pointer" : "not-allowed",
            }}
            onMouseEnter={(e) => {
              if (!canSubmit) return;
              e.currentTarget.style.opacity = "0.9";
              e.currentTarget.style.boxShadow = "0 4px 14px rgba(2, 170, 235, 0.35)";
            }}
            onMouseLeave={(e) => {
              if (!canSubmit) return;
              e.currentTarget.style.opacity = "1";
              e.currentTarget.style.boxShadow = "0 2px 8px rgba(2, 170, 235, 0.25)";
            }}
          >
            Insert link
          </button>
        </div>
      </div>
    </dialog>
  );
}

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor: string }) {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        fontSize: "10px",
        fontWeight: 600,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "var(--color-text-tertiary, #888)",
        marginBottom: "-8px",
      }}
    >
      {children}
    </label>
  );
}

function inputStyle(hasError: boolean): React.CSSProperties {
  return {
    width: "100%",
    height: "44px",
    padding: "0 14px",
    borderRadius: "10px",
    border: `1.5px solid ${hasError ? "#ef4444" : "var(--color-warm-gray-200, #e5e5e5)"}`,
    backgroundColor: "var(--color-white, #fff)",
    fontSize: "14px",
    color: "var(--color-text-primary, #1a1a1a)",
    outline: "none",
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
    boxShadow: hasError ? "0 0 0 3px rgba(239, 68, 68, 0.10)" : "none",
  };
}

const cancelButtonStyle: React.CSSProperties = {
  padding: "9px 18px",
  borderRadius: "10px",
  border: "1.5px solid var(--color-warm-gray-200, #e5e5e5)",
  backgroundColor: "var(--color-white, #fff)",
  fontSize: "13px",
  fontWeight: 600,
  color: "var(--color-text-secondary, #666)",
  cursor: "pointer",
  transition: "background-color 0.12s ease, border-color 0.12s ease",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "9px 18px",
  borderRadius: "10px",
  border: "none",
  background: "linear-gradient(135deg, #02AAEB, #1B77BE)",
  fontSize: "13px",
  fontWeight: 600,
  color: "#fff",
  boxShadow: "0 2px 8px rgba(2, 170, 235, 0.25)",
  transition: "opacity 0.12s ease, box-shadow 0.12s ease",
};

const removeButtonStyle: React.CSSProperties = {
  padding: "9px 14px",
  borderRadius: "10px",
  border: "none",
  background: "transparent",
  fontSize: "13px",
  fontWeight: 600,
  color: "#b91c1c",
  cursor: "pointer",
  transition: "background-color 0.12s ease",
};
