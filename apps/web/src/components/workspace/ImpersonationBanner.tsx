"use client";

import { useTransition } from "react";
import { X, Eye } from "@phosphor-icons/react";
import { clearViewingAs } from "@/app/(workspace)/workspace/viewing-as-actions";

export function ImpersonationBanner({ ownerName }: { ownerName: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div
      className="relative flex shrink-0 items-center px-4 py-2 sm:px-6 lg:px-10"
      style={{ backgroundColor: "#c2410c" }}
    >
      {/* Left: semi-transparent circle with close icon */}
      <button
        type="button"
        onClick={() => startTransition(() => clearViewingAs())}
        disabled={isPending}
        title="Exit this view"
        aria-label="Exit this view"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-80 disabled:opacity-40"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.20)" }}
      >
        <X size={15} weight="bold" color="#ffffff" />
      </button>

      {/* Center: label */}
      <div className="absolute inset-0 flex items-center justify-center gap-2 pointer-events-none">
        <Eye size={15} weight="duotone" style={{ color: "rgba(255, 255, 255, 0.70)" }} />
        <span className="text-sm font-medium" style={{ color: "rgba(255, 255, 255, 0.75)" }}>
          Viewing{" "}
          <strong className="font-semibold" style={{ color: "#ffffff" }}>
            {`${ownerName}'s`}
          </strong>
          {" "}portal
        </span>
      </div>

      {/* Right: invisible spacer to keep label optically centered */}
      <div className="ml-auto h-7 w-7 shrink-0" aria-hidden />
    </div>
  );
}
