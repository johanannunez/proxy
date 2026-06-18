"use client";

import { useTransition } from "react";
import { Power } from "@phosphor-icons/react";
import { signOut } from "./actions";

export function SignOutButton({ iconOnly = false }: { iconOnly?: boolean }) {
  const [pending, startTransition] = useTransition();

  if (iconOnly) {
    return (
      <button
        type="button"
        disabled={pending}
        title="Sign out"
        onClick={() => startTransition(() => signOut())}
        className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-red-50 dark:hover:bg-red-950/20"
        style={{ color: pending ? "var(--color-text-tertiary)" : "var(--color-error, #dc2626)" }}
      >
        <Power size={17} weight="duotone" className="shrink-0" />
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => signOut())}
      className="sidebar-footer-row sidebar-footer-signout"
    >
      <Power size={18} weight="duotone" className="shrink-0" />
      {pending ? "Signing out..." : "Sign out"}
    </button>
  );
}
