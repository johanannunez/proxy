"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, FilePdf, FileImage, File } from "@phosphor-icons/react";

function getFileTypeIcon(file: File) {
  if (file.type === "application/pdf") return <FilePdf size={18} weight="duotone" color="#e05c4b" />;
  if (file.type.startsWith("image/")) return <FileImage size={18} weight="duotone" color="var(--color-brand-light)" />;
  return <File size={18} weight="duotone" color="var(--color-text-tertiary)" />;
}

export function ReceiptsDropZone({
  active,
  onDrop,
}: {
  active: boolean;
  onDrop: (files: File[]) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [dragFiles, setDragFiles] = useState<DataTransferItem[]>([]);
  const enterCountRef = useRef(0);

  useEffect(() => {
    if (!active) return;

    function onDragEnter(e: DragEvent) {
      e.preventDefault();
      enterCountRef.current++;
      if (enterCountRef.current === 1) {
        setDragFiles(Array.from(e.dataTransfer?.items ?? []));
        setVisible(true);
      }
    }

    function onDragOver(e: DragEvent) {
      e.preventDefault();
    }

    function onDragLeave(e: DragEvent) {
      e.preventDefault();
      enterCountRef.current--;
      if (enterCountRef.current === 0) {
        setVisible(false);
        setDragFiles([]);
      }
    }

    function onDropEvent(e: DragEvent) {
      e.preventDefault();
      enterCountRef.current = 0;
      setVisible(false);
      setDragFiles([]);
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length > 0) onDrop(files);
    }

    document.addEventListener("dragenter", onDragEnter);
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("dragleave", onDragLeave);
    document.addEventListener("drop", onDropEvent);

    return () => {
      document.removeEventListener("dragenter", onDragEnter);
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("dragleave", onDragLeave);
      document.removeEventListener("drop", onDropEvent);
    };
  }, [active, onDrop]);

  if (!visible) return null;

  const fileCount = dragFiles.length;

  return (
    <>
      <style>{`
        @keyframes receipt-ring-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.55; transform: scale(0.98); }
        }
        @keyframes receipt-ring-pulse-2 {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.2; transform: scale(0.96); }
        }
        @keyframes receipt-icon-bounce {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(248, 247, 246, 0.85)",
          backdropFilter: "blur(4px)",
          pointerEvents: "none",
        }}
      >
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div
            style={{
              position: "absolute",
              width: "280px",
              height: "280px",
              borderRadius: "50%",
              border: "2px dashed rgba(27, 119, 190, 0.15)",
              animation: "receipt-ring-pulse-2 2.4s ease-in-out infinite",
            }}
          />
          <div
            style={{
              position: "absolute",
              width: "220px",
              height: "220px",
              borderRadius: "50%",
              border: "2px dashed rgba(27, 119, 190, 0.25)",
              animation: "receipt-ring-pulse-2 2.4s ease-in-out infinite 0.4s",
            }}
          />
          <div
            style={{
              width: "160px",
              height: "160px",
              borderRadius: "50%",
              border: "2px dashed rgba(27, 119, 190, 0.5)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              animation: "receipt-ring-pulse 2s ease-in-out infinite",
              backgroundColor: "rgba(27, 119, 190, 0.04)",
            }}
          >
            <div style={{ animation: "receipt-icon-bounce 1.4s ease-in-out infinite" }}>
              <ArrowDown size={28} weight="bold" color="var(--color-brand)" />
            </div>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "var(--color-brand)",
                textAlign: "center",
                lineHeight: 1.3,
              }}
            >
              Drop to
              <br />
              analyze
            </span>
          </div>
        </div>

        {fileCount > 0 && (
          <div
            style={{
              position: "fixed",
              top: "20px",
              right: "20px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 14px",
              borderRadius: "10px",
              backgroundColor: "var(--color-white)",
              boxShadow: "var(--shadow-lg)",
              border: "1px solid var(--color-warm-gray-200)",
            }}
          >
            {dragFiles.slice(0, 3).map((item, i) => {
              const mockFile = { type: item.type } as File;
              return <span key={i}>{getFileTypeIcon(mockFile)}</span>;
            })}
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--color-text-secondary)",
              }}
            >
              {fileCount} {fileCount === 1 ? "file" : "files"}
            </span>
          </div>
        )}
      </div>
    </>
  );
}
