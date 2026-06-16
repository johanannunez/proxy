"use client";

/**
 * Remembers a hub's cards/list view per browser so each Paperwork hub reopens
 * the way it was left. Read happens after mount (SSR-safe; brief one-frame
 * fallback before the stored value applies, which is fine for a view toggle).
 */

import { useEffect, useState } from "react";
import type { HubView } from "@/components/admin/paperwork/HubChrome";

const storageKey = (hub: string) => `paperwork.view.${hub}`;
const VALID: HubView[] = ["cards", "list"];

export function readStickyView(hub: string, fallback: HubView): HubView {
  if (typeof window === "undefined") return fallback;
  const stored = window.localStorage.getItem(storageKey(hub));
  return stored && (VALID as string[]).includes(stored) ? (stored as HubView) : fallback;
}

export function writeStickyView(hub: string, view: HubView): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(hub), view);
}

export function useStickyView(
  hub: string,
  fallback: HubView,
): [HubView, (next: HubView) => void] {
  const [view, setView] = useState<HubView>(fallback);

  useEffect(() => {
    setView(readStickyView(hub, fallback));
    // fallback is a stable literal at the call sites; keying on hub is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hub]);

  const update = (next: HubView) => {
    setView(next);
    writeStickyView(hub, next);
  };

  return [view, update];
}
