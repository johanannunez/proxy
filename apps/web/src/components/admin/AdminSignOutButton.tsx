"use client";

import { useTransition } from "react";
import { Power } from "@phosphor-icons/react";
import { signOut } from "@/app/(workspace)/workspace/actions";

export function AdminSignOutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => signOut())}
      className="admin-footer-row admin-footer-signout"
      data-admin-signout
    >
      <Power size={15} weight="regular" className="shrink-0" />
      {pending ? "Signing out..." : "Sign out"}
    </button>
  );
}
