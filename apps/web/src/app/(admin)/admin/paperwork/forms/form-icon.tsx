"use client";

/**
 * Compatibility adapter for form appearance. Brand Studio stores namespaced
 * `icon:*` and `emoji:*` values, while older rows may still store bare icon
 * keys like `wifi`.
 */

import {
  FORM_ICONS,
  FORM_TINTS,
  emojiFromCodepoints,
  resolveSymbolValue,
  resolveTintValue,
  type FormSymbol,
  type FormSymbolValue,
} from "./form-symbols";
import type { Icon } from "@phosphor-icons/react";

export {
  FORM_ICONS,
  FORM_ICON_SYMBOLS,
  FORM_SYMBOLS,
  FORM_TINTS,
  emojiFromCodepoints,
  getSymbolByValue,
  isHexColor,
  normalizeHexColor,
  normalizeSymbolValue,
  resolveSymbolValue,
  resolveTintValue,
  type FormEmojiSymbol,
  type FormIconKey,
  type FormIconSymbol,
  type FormSymbol,
  type FormSymbolCategory,
  type FormSymbolKind,
  type FormSymbolValue,
  type FormTint,
  type FormTintKey,
} from "./form-symbols";

export interface ResolvedFormAppearance {
  Icon: Icon;
  bg: string;
  emoji: string | null;
  fg: string;
  kind: FormSymbol["kind"];
  label: string;
  symbol: FormSymbol;
  symbolValue: FormSymbolValue;
}

export function resolveFormAppearance(form: {
  id: string;
  icon: string | null;
  icon_color: string | null;
}): ResolvedFormAppearance {
  const symbol = resolveSymbolValue(form.icon);
  const tint = resolveTintValue(form.icon_color, form.id);
  const fallbackIcon = FORM_ICONS[0].Icon;
  return {
    Icon: symbol.kind === "icon" ? symbol.Icon : fallbackIcon,
    bg: tint.bg,
    emoji: symbol.kind === "emoji" ? emojiFromCodepoints(symbol.codepoints) : null,
    fg: tint.fg,
    kind: symbol.kind,
    label: symbol.label,
    symbol,
    symbolValue: symbol.value,
  };
}
