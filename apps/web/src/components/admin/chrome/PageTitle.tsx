"use client";

import { useEffect } from "react";
import type { PageTitleInfo } from "@/lib/admin/derive-page-title";

/**
 * Mount this from any admin page to override the top bar's title/subtitle.
 * Uses a CustomEvent bridge so the top bar can listen without prop drilling.
 */
export function PageTitle({ title, subtitle, backHref, backLabel }: PageTitleInfo) {
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("admin:page-title", {
        detail: { title, subtitle, backHref, backLabel },
      }),
    );
    return () => {
      window.dispatchEvent(new CustomEvent("admin:page-title", { detail: null }));
    };
  }, [title, subtitle, backHref, backLabel]);
  return null;
}
