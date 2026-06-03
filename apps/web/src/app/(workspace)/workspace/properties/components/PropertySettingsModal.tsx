"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { X, Image as ImageIcon, MapPin, NavigationArrow, Warning } from "@phosphor-icons/react";
import type { ImageSource } from "../actions";
import { updatePropertyImageSource } from "../actions";

type Props = {
  propertyId: string;
  address: string;
  currentSource: ImageSource;
  streetViewAvailable: boolean;
  onClose: () => void;
  onSourceChange: (src: ImageSource) => void;
};

const SOURCE_OPTIONS: Array<{
  value: ImageSource;
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    value: "aerial",
    label: "Aerial view",
    description: "Satellite photo from Google Maps",
    icon: <NavigationArrow size={16} weight="duotone" />,
  },
  {
    value: "street",
    label: "Street view",
    description: "Street-level photo from Google Maps",
    icon: <MapPin size={16} weight="duotone" />,
  },
  {
    value: "photo",
    label: "Your photo",
    description: "Upload a custom cover image",
    icon: <ImageIcon size={16} weight="duotone" />,
  },
];

export function PropertySettingsModal({
  propertyId,
  address,
  currentSource,
  streetViewAvailable,
  onClose,
  onSourceChange,
}: Props) {
  const [selected, setSelected] = useState<ImageSource>(currentSource);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const firstRadioRef = useRef<HTMLButtonElement>(null);

  // Auto-focus first option on open
  useEffect(() => {
    firstRadioRef.current?.focus();
  }, []);

  // Escape closes
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function handleSave() {
    if (selected === currentSource) {
      onClose();
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updatePropertyImageSource(propertyId, selected);
      if (result.ok) {
        onSourceChange(selected);
        onClose();
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
      onMouseDown={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div
        className="relative flex w-full max-w-sm flex-col overflow-hidden rounded-2xl"
        style={{
          backgroundColor: "var(--color-white)",
          border: "1px solid var(--color-warm-gray-200)",
          boxShadow: "0 24px 64px -12px rgba(0,0,0,0.28)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between px-5 py-4"
          style={{
            borderBottom: "1px solid var(--color-warm-gray-200)",
            background: "linear-gradient(135deg, rgba(2,170,235,0.06) 0%, rgba(2,170,235,0) 100%)",
          }}
        >
          <div className="min-w-0 flex-1">
            <h2
              id="settings-modal-title"
              className="text-[15px] font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              Property settings
            </h2>
            <p
              className="mt-0.5 truncate text-[12px]"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              {address}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-[var(--color-warm-gray-100)]"
            style={{ color: "var(--color-text-tertiary)" }}
            aria-label="Close"
          >
            <X size={15} weight="bold" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-3 px-5 py-4">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Image source
          </p>

          <div className="flex flex-col gap-2" role="radiogroup" aria-label="Image source">
            {SOURCE_OPTIONS.map((opt, i) => {
              const isSelected = selected === opt.value;
              const isOptionDisabled =
                opt.value === "street" && !streetViewAvailable;
              return (
                <button
                  key={opt.value}
                  ref={i === 0 ? firstRadioRef : undefined}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => !isOptionDisabled && setSelected(opt.value)}
                  disabled={isOptionDisabled}
                  title={isOptionDisabled ? "No street view imagery available for this address" : undefined}
                  className="flex items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40"
                  style={{
                    backgroundColor: isSelected
                      ? "rgba(2, 170, 235, 0.07)"
                      : "var(--color-warm-gray-50)",
                    border: isSelected
                      ? "1.5px solid rgba(2, 170, 235, 0.4)"
                      : "1.5px solid transparent",
                  }}
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{
                      backgroundColor: isSelected
                        ? "rgba(2, 170, 235, 0.12)"
                        : "var(--color-warm-gray-100)",
                      color: isSelected ? "var(--color-brand)" : "var(--color-text-secondary)",
                    }}
                  >
                    {opt.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-[13px] font-semibold leading-tight"
                      style={{
                        color: isSelected
                          ? "var(--color-brand)"
                          : "var(--color-text-primary)",
                      }}
                    >
                      {opt.label}
                    </p>
                    <p
                      className="mt-0.5 text-[11px] leading-tight"
                      style={{ color: "var(--color-text-tertiary)" }}
                    >
                      {opt.value === "photo" && selected !== "photo"
                        ? "Upload after selecting"
                        : opt.description}
                    </p>
                  </div>
                  {/* Radio dot */}
                  <span
                    className="ml-auto flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors"
                    style={{
                      borderColor: isSelected ? "var(--color-brand)" : "var(--color-warm-gray-300)",
                      backgroundColor: isSelected ? "var(--color-brand)" : "transparent",
                    }}
                  >
                    {isSelected && (
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {selected === "photo" && (
            <p
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px]"
              style={{
                backgroundColor: "rgba(245, 158, 11, 0.08)",
                color: "#b45309",
                border: "1px solid rgba(245, 158, 11, 0.2)",
              }}
            >
              <Warning size={13} weight="fill" />
              Photo upload coming soon. Select aerial or street view for now.
            </p>
          )}

          {error && (
            <p
              className="rounded-lg px-3 py-2 text-[12px]"
              style={{
                backgroundColor: "rgba(220, 38, 38, 0.07)",
                color: "#b91c1c",
                border: "1px solid rgba(220, 38, 38, 0.15)",
              }}
            >
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-5 py-3"
          style={{ borderTop: "1px solid var(--color-warm-gray-200)" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-[13px] font-medium transition-colors hover:bg-[var(--color-warm-gray-100)]"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || selected === "photo"}
            className="rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: "var(--color-brand)" }}
          >
            {isPending ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
