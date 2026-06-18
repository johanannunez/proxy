"use client";

/**
 * EditorPopover — a portal-rendered floating panel anchored to a trigger. Used
 * by the toolbar's color palettes, the link popover, and the "More" overflow
 * panel. Renders to document.body so it cannot be clipped by the toolbar.
 */

import { useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import {
  useFloatingPosition,
  useFloatingDismiss,
  type FloatingAlign,
} from "./floating";
import styles from "./EditorPopover.module.css";

export function EditorPopover({
  open,
  onClose,
  anchorRef,
  align = "start",
  width,
  ariaLabel,
  children,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  align?: FloatingAlign;
  width?: number;
  ariaLabel?: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const coords = useFloatingPosition(anchorRef, panelRef, open, { align });
  useFloatingDismiss(open, onClose, [anchorRef]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={panelRef}
      className={styles.panel}
      data-editor-floating
      role="dialog"
      aria-label={ariaLabel}
      style={{
        top: coords?.top ?? 0,
        left: coords?.left ?? 0,
        width,
        visibility: coords ? "visible" : "hidden",
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
