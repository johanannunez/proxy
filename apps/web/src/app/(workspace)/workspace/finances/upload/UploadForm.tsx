"use client";

import { useRef, useState } from "react";
import { Camera, CheckCircle, ArrowCounterClockwise, WarningCircle } from "@phosphor-icons/react";
import { uploadReceipt } from "../receipts-actions";

type UploadState =
  | { status: "idle" }
  | { status: "selected"; file: File; preview: string | null }
  | { status: "uploading" }
  | { status: "success"; vendor: string }
  | { status: "error"; message: string };

function Spinner() {
  return (
    <span
      style={{
        display: "inline-block",
        width: "28px",
        height: "28px",
        borderRadius: "50%",
        border: "3px solid rgba(27, 119, 190, 0.20)",
        borderTopColor: "var(--color-brand)",
        animation: "spin 700ms linear infinite",
        flexShrink: 0,
      }}
    />
  );
}

export function UploadForm() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>({ status: "idle" });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setState({ status: "selected", file, preview: ev.target?.result as string });
      };
      reader.readAsDataURL(file);
    } else {
      setState({ status: "selected", file, preview: null });
    }
    e.target.value = "";
  }

  async function handleSubmit() {
    if (state.status !== "selected") return;
    const { file } = state;
    setState({ status: "uploading" });

    const formData = new FormData();
    formData.append("file", file);

    const result = await uploadReceipt(formData);

    if ("error" in result) {
      setState({ status: "error", message: result.error });
    } else if ("duplicate" in result) {
      setState({ status: "success", vendor: result.existingReceipt.vendor });
    } else {
      setState({ status: "success", vendor: result.receipt.vendor });
    }
  }

  function reset() {
    setState({ status: "idle" });
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        backgroundColor: "var(--color-warm-gray-50)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: "32px 20px 48px",
      }}
    >
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.88); } to { opacity: 1; transform: scale(1); } }
      `}</style>

      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0px",
        }}
      >
        <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "40px" }}>
          <span
            style={{
              fontFamily: "var(--font-sora)",
              fontWeight: 700,
              fontSize: "18px",
              color: "var(--color-brand)",
              letterSpacing: "-0.02em",
            }}
          >
            Proxy
          </span>
        </div>

        {state.status === "idle" && (
          <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: "24px", animation: "fadeUp 250ms ease" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", textAlign: "center" }}>
              <h1
                style={{
                  fontFamily: "var(--font-sora)",
                  fontSize: "22px",
                  fontWeight: 700,
                  color: "var(--color-text-primary)",
                  letterSpacing: "-0.02em",
                  margin: 0,
                }}
              >
                Upload a receipt
              </h1>
              <p style={{ fontSize: "14px", color: "var(--color-text-secondary)", margin: 0, lineHeight: "1.5" }}>
                Photograph or upload a financial document to add it to your account.
              </p>
            </div>

            <label
              htmlFor="receipt-file-input"
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "14px",
                width: "min(80vw, 320px)",
                height: "min(80vw, 320px)",
                border: "2px dashed var(--color-brand)",
                borderRadius: "20px",
                backgroundColor: "rgba(27, 119, 190, 0.04)",
                cursor: "pointer",
                transition: "background-color 120ms ease, border-color 120ms ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLLabelElement).style.backgroundColor = "rgba(27, 119, 190, 0.08)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLLabelElement).style.backgroundColor = "rgba(27, 119, 190, 0.04)";
              }}
            >
              <Camera size={48} weight="duotone" color="var(--color-brand)" />
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", textAlign: "center", padding: "0 16px" }}>
                <span style={{ fontSize: "15px", fontWeight: 600, color: "var(--color-text-primary)" }}>
                  Tap to photograph a receipt
                </span>
                <span style={{ fontSize: "12px", color: "var(--color-text-tertiary)" }}>
                  Or drag a file here
                </span>
              </div>

              <input
                id="receipt-file-input"
                ref={inputRef}
                type="file"
                accept="image/*,application/pdf"
                capture="environment"
                onChange={handleFileChange}
                style={{
                  position: "absolute",
                  inset: 0,
                  opacity: 0,
                  cursor: "pointer",
                  width: "100%",
                  height: "100%",
                }}
              />
            </label>

            <p style={{ fontSize: "12px", color: "var(--color-text-tertiary)", margin: 0 }}>
              Accepts JPG, PNG, HEIC, PDF up to 50 MB
            </p>
          </div>
        )}

        {state.status === "selected" && (
          <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: "20px", animation: "scaleIn 220ms ease" }}>
            <div
              style={{
                width: "min(80vw, 320px)",
                minHeight: "200px",
                border: "1px solid var(--color-warm-gray-200)",
                borderRadius: "16px",
                backgroundColor: "var(--color-white)",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "var(--shadow-card)",
              }}
            >
              {state.preview ? (
                <img
                  src={state.preview}
                  alt="Receipt preview"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", padding: "32px", textAlign: "center" }}>
                  <Camera size={36} weight="duotone" color="var(--color-brand)" />
                  <span style={{ fontSize: "13px", color: "var(--color-text-secondary)", fontWeight: 500 }}>
                    {state.file.name}
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--color-text-tertiary)" }}>
                    {(state.file.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                </div>
              )}
            </div>

            <div style={{ width: "100%", maxWidth: "320px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                type="button"
                onClick={handleSubmit}
                style={{
                  width: "100%",
                  minHeight: "52px",
                  borderRadius: "12px",
                  border: "none",
                  background: "linear-gradient(135deg, #02aaeb, #1b77be)",
                  color: "var(--color-white)",
                  fontSize: "15px",
                  fontWeight: 700,
                  cursor: "pointer",
                  letterSpacing: "-0.01em",
                  transition: "opacity 120ms ease, transform 100ms ease",
                  boxShadow: "0 2px 12px rgba(27, 119, 190, 0.30)",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.90"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
              >
                Upload Receipt
              </button>

              <button
                type="button"
                onClick={reset}
                style={{
                  width: "100%",
                  minHeight: "48px",
                  borderRadius: "12px",
                  border: "1px solid var(--color-warm-gray-200)",
                  backgroundColor: "var(--color-white)",
                  color: "var(--color-text-secondary)",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "border-color 100ms ease, color 100ms ease",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-warm-gray-300, #d1d5db)";
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-primary)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-warm-gray-200)";
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-secondary)";
                }}
              >
                Choose different file
              </button>
            </div>
          </div>
        )}

        {state.status === "uploading" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "20px",
              paddingTop: "40px",
              animation: "fadeUp 200ms ease",
            }}
          >
            <Spinner />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", textAlign: "center" }}>
              <span style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-text-primary)" }}>
                Uploading and analyzing...
              </span>
              <span style={{ fontSize: "13px", color: "var(--color-text-tertiary)" }}>
                This usually takes a few seconds.
              </span>
            </div>
          </div>
        )}

        {state.status === "success" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "20px",
              paddingTop: "32px",
              animation: "scaleIn 280ms ease",
            }}
          >
            <div
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                backgroundColor: "rgba(22, 163, 74, 0.10)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CheckCircle size={40} weight="duotone" color="#16a34a" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", textAlign: "center" }}>
              <span style={{ fontSize: "20px", fontWeight: 700, color: "var(--color-text-primary)", letterSpacing: "-0.02em" }}>
                Receipt added!
              </span>
              <span style={{ fontSize: "14px", color: "var(--color-text-secondary)" }}>
                {state.vendor} was added to your account.
              </span>
            </div>

            <button
              type="button"
              onClick={reset}
              style={{
                minHeight: "52px",
                paddingLeft: "28px",
                paddingRight: "28px",
                borderRadius: "12px",
                border: "none",
                background: "linear-gradient(135deg, #02aaeb, #1b77be)",
                color: "var(--color-white)",
                fontSize: "15px",
                fontWeight: 700,
                cursor: "pointer",
                letterSpacing: "-0.01em",
                transition: "opacity 120ms ease",
                boxShadow: "0 2px 12px rgba(27, 119, 190, 0.30)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.90"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
            >
              <ArrowCounterClockwise size={16} weight="bold" />
              Add another
            </button>
          </div>
        )}

        {state.status === "error" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "20px",
              paddingTop: "32px",
              animation: "fadeUp 200ms ease",
            }}
          >
            <div
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                backgroundColor: "rgba(220, 38, 38, 0.10)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <WarningCircle size={40} weight="duotone" color="#dc2626" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", textAlign: "center" }}>
              <span style={{ fontSize: "18px", fontWeight: 700, color: "var(--color-text-primary)", letterSpacing: "-0.01em" }}>
                Upload failed
              </span>
              <span style={{ fontSize: "13px", color: "var(--color-text-secondary)", maxWidth: "280px", lineHeight: "1.5" }}>
                {state.message}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%", maxWidth: "280px" }}>
              <button
                type="button"
                onClick={reset}
                style={{
                  minHeight: "52px",
                  width: "100%",
                  borderRadius: "12px",
                  border: "none",
                  background: "linear-gradient(135deg, #02aaeb, #1b77be)",
                  color: "var(--color-white)",
                  fontSize: "15px",
                  fontWeight: 700,
                  cursor: "pointer",
                  letterSpacing: "-0.01em",
                  transition: "opacity 120ms ease",
                  boxShadow: "0 2px 12px rgba(27, 119, 190, 0.30)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.90"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
              >
                <ArrowCounterClockwise size={16} weight="bold" />
                Try again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
