"use client";

/**
 * Shared positioning + dismissal hooks for the editor's portal-based floating
 * layers (EditorSelect menus, EditorPopover panels, the toolbar "More" panel).
 *
 * Why portals: the toolbar sits in a clipping box, so any menu rendered inside
 * its own DOM subtree is clipped. These layers render to document.body with
 * position: fixed, so they cannot be clipped or trapped behind sibling content.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

export type FloatingAlign = "start" | "end";
export type FloatingCoords = { top: number; left: number };

const VIEWPORT_MARGIN = 8;

/**
 * Computes fixed-position coordinates for a floating layer anchored to a
 * trigger element. The floating node is measured from its own ref (it is
 * already committed to the DOM when this layout effect runs), so the very first
 * pass has its real size. Recomputes on scroll (capture) and resize so the
 * layer tracks its anchor. Returns null until the first measurement.
 */
export function useFloatingPosition(
  anchorRef: RefObject<HTMLElement | null>,
  floatingRef: RefObject<HTMLElement | null>,
  open: boolean,
  { align = "start", gap = 6 }: { align?: FloatingAlign; gap?: number } = {},
): FloatingCoords | null {
  const [coords, setCoords] = useState<FloatingCoords | null>(null);

  const compute = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const a = anchor.getBoundingClientRect();
    const f = floatingRef.current?.getBoundingClientRect();
    const fw = f?.width ?? a.width;
    const fh = f?.height ?? 0;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = align === "end" ? a.right - fw : a.left;
    left = Math.min(Math.max(VIEWPORT_MARGIN, left), vw - fw - VIEWPORT_MARGIN);

    let top = a.bottom + gap;
    // Flip above the anchor only if it would overflow the bottom and there is
    // genuinely more room above.
    if (top + fh > vh - VIEWPORT_MARGIN && a.top - gap - fh > VIEWPORT_MARGIN) {
      top = a.top - gap - fh;
    }
    // Skip the state update when nothing moved (the toolbar is pinned, so a
    // canvas scroll fires this listener without changing the anchor rect).
    setCoords((prev) =>
      prev && prev.top === top && prev.left === left ? prev : { top, left },
    );
  }, [anchorRef, floatingRef, align, gap]);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    compute();
    window.addEventListener("scroll", compute, true);
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", compute, true);
      window.removeEventListener("resize", compute);
    };
  }, [open, compute]);

  return coords;
}

/**
 * Dismisses a floating layer on outside mousedown or Escape. Clicks within ANY
 * element marked [data-editor-floating] are ignored, so a select opened inside
 * the "More" panel does not collapse the panel beneath it. The anchor (trigger)
 * is also ignored so its own toggle handler owns the open/close.
 */
export function useFloatingDismiss(
  open: boolean,
  onClose: () => void,
  ignoreRefs: Array<RefObject<HTMLElement | null>>,
): void {
  // Keep the latest onClose/ignoreRefs without re-subscribing every render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const ignoreRef = useRef(ignoreRefs);
  ignoreRef.current = ignoreRefs;

  useEffect(() => {
    if (!open) return;
    function handlePointer(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-editor-floating]")) return;
      for (const r of ignoreRef.current) {
        if (r.current && r.current.contains(target)) return;
      }
      onCloseRef.current();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);
}
