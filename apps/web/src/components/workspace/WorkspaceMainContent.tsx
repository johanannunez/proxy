"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { PullToRefresh } from "@/components/workspace/PullToRefresh";

/**
 * Wraps portal page content. Full-bleed pages (like Messages) skip the
 * padded wrapper and PullToRefresh, filling the entire main area instead.
 * Normal pages get the standard centered, padded layout with pull-to-refresh.
 */

const FULL_BLEED_ROUTES = ["/workspace/inbox", "/workspace/documents"];

export function WorkspaceMain({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isFullBleed = FULL_BLEED_ROUTES.some((r) => pathname.startsWith(r));

  if (isFullBleed) {
    return (
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto overflow-x-hidden pb-20 md:pb-0">
      <PullToRefresh>
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:px-10 lg:py-14">
          {children}
        </div>
      </PullToRefresh>
    </main>
  );
}
