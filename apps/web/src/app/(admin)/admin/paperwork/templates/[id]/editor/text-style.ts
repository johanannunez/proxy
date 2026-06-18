import { FONTS } from "./fonts";

/** Computed px font-size (e.g. "14.6667px" or a number) → "Npt" string. */
export function pxToPt(px: string | number): string {
  const n = typeof px === "number" ? px : parseFloat(px);
  if (!Number.isFinite(n)) return "";
  // 1pt = 1/72in, 1px = 1/96in → pt = px * 72/96 = px * 0.75.
  return `${Math.round(n * 0.75)}pt`;
}

/**
 * Maps a computed font-family string to a known font id. Only the PRIMARY
 * (first) family in the stack is matched, so fallback families do not cause a
 * mismatch (e.g. a Georgia body stack listing "Times New Roman" as a fallback
 * must resolve to Georgia, not Times New Roman). Matches the primary against
 * each font's googleFamily (explicit marks, e.g. "Montserrat") and its human
 * label (CSS defaults, e.g. "Arial"/"Georgia"). Returns "" when nothing matches.
 */
export function matchComputedFontId(family: string): string {
  if (!family) return "";
  const primary = family.split(",")[0].replace(/["']/g, "").trim().toLowerCase();
  if (!primary) return "";
  for (const font of FONTS) {
    if (
      font.googleFamily.toLowerCase() === primary ||
      font.label.toLowerCase() === primary
    ) {
      return font.id;
    }
  }
  return "";
}
