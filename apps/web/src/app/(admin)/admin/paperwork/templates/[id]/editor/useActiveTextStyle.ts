"use client";

import { useEffect, useState } from "react";
import { useEditorSelector } from "platejs/react";
import { FONTS } from "./fonts";
import { pxToPt, matchComputedFontId } from "./text-style";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EditorHandle = { api: any };

export type ActiveTextStyle = { fontId: string; size: string; weight: string };

/**
 * Mark-first, computed-fallback text style for the toolbar selects. When the
 * selection carries an explicit fontFamily / fontSize / fontWeight mark, that
 * wins; otherwise we read the rendered style off the DOM (so a CSS-styled
 * heading reports e.g. Arial / 17pt / 700 instead of blank). Recomputes
 * whenever the selection changes.
 */
export function useActiveTextStyle(editor: EditorHandle): ActiveTextStyle {
  const selKey = useEditorSelector(
    (ed: { selection: unknown }) => JSON.stringify(ed.selection ?? null),
    [],
  );
  const [style, setStyle] = useState<ActiveTextStyle>({
    fontId: "",
    size: "",
    weight: "",
  });

  useEffect(() => {
    const marks = (editor.api.marks() ?? {}) as Record<string, unknown>;
    const markFontId = marks.fontFamily
      ? (FONTS.find((f) => f.stack === marks.fontFamily)?.id ?? "")
      : "";
    const markSize = (marks.fontSize as string | undefined) ?? "";
    const markWeight = (marks.fontWeight as string | undefined) ?? "";

    // Computed fallback from the DOM selection's focus node.
    let csFontId = "";
    let csSize = "";
    let csWeight = "";
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    const node = sel?.focusNode ?? null;
    const el = node
      ? node.nodeType === 3
        ? node.parentElement
        : (node as Element)
      : null;
    if (el) {
      const cs = getComputedStyle(el);
      csFontId = matchComputedFontId(cs.fontFamily);
      csSize = pxToPt(cs.fontSize);
      csWeight = String(parseInt(cs.fontWeight, 10) || 400);
    }

    setStyle({
      fontId: markFontId || csFontId,
      size: markSize || csSize,
      weight: markWeight || csWeight,
    });
  }, [selKey, editor]);

  return style;
}
