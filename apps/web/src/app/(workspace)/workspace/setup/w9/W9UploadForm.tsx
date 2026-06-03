"use client";

import { useActionState, useRef, useState } from "react";
import { CloudArrowUp, FileText, X } from "@phosphor-icons/react";
import { uploadW9Action, type UploadW9State } from "./actions";

const INITIAL: UploadW9State = { status: "idle" };

export function W9UploadForm({
  defaultLegalName = "",
  ctaLabel = "Submit W-9",
}: {
  defaultLegalName?: string;
  ctaLabel?: string;
}) {
  const [state, formAction, isPending] = useActionState(uploadW9Action, INITIAL);
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function pickFile() {
    inputRef.current?.click();
  }

  function clearFile() {
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-5"
      encType="multipart/form-data"
    >
      <label className="flex flex-col gap-2">
        <span
          className="text-xs font-semibold uppercase tracking-[0.10em]"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          Legal name (as on Form W-9)
        </span>
        <input
          type="text"
          name="legal_name"
          defaultValue={defaultLegalName}
          autoComplete="name"
          className="rounded-lg border px-3 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2"
          style={{
            backgroundColor: "var(--color-white)",
            borderColor: "var(--color-warm-gray-200)",
            color: "var(--color-text-primary)",
          }}
          placeholder="e.g. Pat Smith, or Smith Real Estate LLC"
        />
      </label>

      <div className="flex flex-col gap-2">
        <span
          className="text-xs font-semibold uppercase tracking-[0.10em]"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          Completed W-9 form
        </span>

        <input
          ref={inputRef}
          type="file"
          name="file"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(event) => {
            const selected = event.target.files?.[0] ?? null;
            setFile(selected);
          }}
        />

        {file ? (
          <div
            className="flex items-center gap-3 rounded-2xl border p-4"
            style={{
              backgroundColor: "var(--color-white)",
              borderColor: "var(--color-warm-gray-200)",
            }}
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{
                backgroundColor: "rgba(2, 170, 235, 0.10)",
                color: "var(--color-brand)",
              }}
            >
              <FileText size={18} weight="duotone" />
            </span>
            <div className="min-w-0 flex-1">
              <p
                className="truncate text-sm font-semibold"
                style={{ color: "var(--color-text-primary)" }}
              >
                {file.name}
              </p>
              <p
                className="mt-0.5 text-xs"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <button
              type="button"
              onClick={clearFile}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors hover:bg-[var(--color-warm-gray-50)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-brand)]"
              style={{
                borderColor: "var(--color-warm-gray-200)",
                color: "var(--color-text-secondary)",
              }}
              aria-label="Remove file"
            >
              <X size={14} weight="bold" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={pickFile}
            className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed p-10 text-center transition-colors hover:bg-[var(--color-warm-gray-50)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-brand)]"
            style={{
              borderColor: "var(--color-warm-gray-200)",
              color: "var(--color-text-secondary)",
            }}
          >
            <CloudArrowUp size={28} weight="duotone" style={{ color: "var(--color-brand)" }} />
            <span
              className="text-sm font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              Choose a file
            </span>
            <span className="text-xs">PDF, PNG, JPEG, or WEBP. Up to 20 MB.</span>
          </button>
        )}
      </div>

      {state.status === "error" ? (
        <div
          className="rounded-lg border px-3 py-2 text-xs"
          role="alert"
          style={{
            backgroundColor: "rgba(220, 38, 38, 0.06)",
            borderColor: "rgba(220, 38, 38, 0.20)",
            color: "#b91c1c",
          }}
        >
          {state.message}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isPending || !file}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-brand)]"
        style={{
          backgroundColor: "var(--color-brand)",
          color: "var(--color-white)",
        }}
      >
        {isPending ? "Uploading..." : ctaLabel}
      </button>
    </form>
  );
}
