"use client";

import { useState } from "react";
import { Scales, X } from "@phosphor-icons/react";
import Link from "next/link";

interface AuthorityPromptBannerProps {
  workspaceMemberCount: number;
}

export function AuthorityPromptBanner({ workspaceMemberCount }: AuthorityPromptBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || workspaceMemberCount < 2) return null;

  return (
    <div
      className="flex items-start gap-3 rounded-xl border p-4"
      style={{
        backgroundColor: "rgba(2,170,235,0.04)",
        borderColor: "rgba(2,170,235,0.15)",
      }}
    >
      <div
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: "rgba(2,170,235,0.08)" }}
      >
        <Scales size={16} weight="duotone" style={{ color: "var(--color-brand)" }} />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className="text-sm font-semibold"
          style={{ color: "var(--color-text-primary)" }}
        >
          Define decision authority for your workspace
        </p>
        <p className="mt-0.5 text-xs" style={{ color: "var(--color-text-secondary)" }}>
          You share this workspace with another owner. Setting up a Decision Authority
          Addendum clarifies who handles documents, finances, and operations.
        </p>
        <Link
          href="/workspace/account#decision-authority"
          className="mt-2 inline-block text-xs font-semibold"
          style={{ color: "var(--color-brand)" }}
        >
          Set it up
        </Link>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="mt-0.5 shrink-0 rounded p-1"
        style={{ color: "var(--color-text-tertiary)" }}
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}
