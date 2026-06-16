"use client";

/**
 * Form appearance catalog — the curated icon + accent palette an admin can
 * assign per form. Shared by the Forms library row, the cards, and the icon
 * picker so they never drift.
 *
 * A form's stored `icon` string can be one of three things, resolved here:
 *   - a legacy FormIconKey from the table below (e.g. "clipboard")
 *   - a "ph:Name" reference into the larger searchable Phosphor catalog
 *   - a literal emoji glyph (e.g. "🏠")
 * `resolveFormAppearance` normalizes all three. `icon_color` stays a FormTintKey.
 */

import type { Icon } from "@phosphor-icons/react";
import { ICON_BY_NAME } from "@/components/admin/icon-picker-data";
import {
  Rows,
  House,
  WifiHigh,
  Key,
  FileText,
  ClipboardText,
  CalendarBlank,
  CreditCard,
  IdentificationCard,
  Camera,
  Wrench,
  Sparkle,
  Confetti,
  MapPin,
  Bed,
  Bathtub,
  Car,
  PawPrint,
  Lightbulb,
  ShieldCheck,
  Receipt,
  Notebook,
  ChatCircle,
  Star,
  Broom,
} from "@phosphor-icons/react";

export type FormIconKey =
  | "form"
  | "house"
  | "wifi"
  | "key"
  | "file"
  | "clipboard"
  | "calendar"
  | "card"
  | "id"
  | "camera"
  | "wrench"
  | "sparkle"
  | "confetti"
  | "pin"
  | "bed"
  | "bath"
  | "car"
  | "paw"
  | "bulb"
  | "shield"
  | "receipt"
  | "notebook"
  | "chat"
  | "star"
  | "broom";

export const FORM_ICONS: Array<{ key: FormIconKey; label: string; Icon: Icon }> = [
  { key: "form", label: "Form", Icon: Rows },
  { key: "house", label: "Property", Icon: House },
  { key: "wifi", label: "Wi-Fi", Icon: WifiHigh },
  { key: "key", label: "Access", Icon: Key },
  { key: "file", label: "Document", Icon: FileText },
  { key: "clipboard", label: "Checklist", Icon: ClipboardText },
  { key: "calendar", label: "Calendar", Icon: CalendarBlank },
  { key: "card", label: "Payment", Icon: CreditCard },
  { key: "id", label: "Identity", Icon: IdentificationCard },
  { key: "camera", label: "Photos", Icon: Camera },
  { key: "wrench", label: "Maintenance", Icon: Wrench },
  { key: "sparkle", label: "Cleaning", Icon: Sparkle },
  { key: "confetti", label: "Welcome", Icon: Confetti },
  { key: "pin", label: "Location", Icon: MapPin },
  { key: "bed", label: "Bedrooms", Icon: Bed },
  { key: "bath", label: "Bathrooms", Icon: Bathtub },
  { key: "car", label: "Parking", Icon: Car },
  { key: "paw", label: "Pets", Icon: PawPrint },
  { key: "bulb", label: "Tips", Icon: Lightbulb },
  { key: "shield", label: "Insurance", Icon: ShieldCheck },
  { key: "receipt", label: "Fees", Icon: Receipt },
  { key: "notebook", label: "Notes", Icon: Notebook },
  { key: "chat", label: "Survey", Icon: ChatCircle },
  { key: "star", label: "Review", Icon: Star },
  { key: "broom", label: "Turnover", Icon: Broom },
];

const ICON_BY_KEY = new Map(FORM_ICONS.map((entry) => [entry.key, entry.Icon]));

export type FormTintKey =
  | "blue" | "teal" | "violet" | "amber" | "rose" | "pine" | "indigo" | "slate"
  | "sky" | "emerald" | "lime" | "orange" | "red" | "fuchsia" | "purple" | "cyan";

export const FORM_TINTS: Array<{ key: FormTintKey; bg: string; fg: string }> = [
  { key: "blue", bg: "rgba(27, 119, 190, 0.12)", fg: "#1b77be" },
  { key: "sky", bg: "rgba(2, 132, 199, 0.12)", fg: "#0284c7" },
  { key: "cyan", bg: "rgba(8, 145, 178, 0.12)", fg: "#0891b2" },
  { key: "teal", bg: "rgba(13, 148, 136, 0.12)", fg: "#0d9488" },
  { key: "pine", bg: "rgba(15, 118, 110, 0.12)", fg: "#0f766e" },
  { key: "emerald", bg: "rgba(5, 150, 105, 0.12)", fg: "#059669" },
  { key: "lime", bg: "rgba(101, 163, 13, 0.13)", fg: "#65a30d" },
  { key: "amber", bg: "rgba(202, 138, 4, 0.14)", fg: "#b27908" },
  { key: "orange", bg: "rgba(234, 88, 12, 0.13)", fg: "#ea580c" },
  { key: "red", bg: "rgba(220, 38, 38, 0.12)", fg: "#dc2626" },
  { key: "rose", bg: "rgba(219, 75, 109, 0.12)", fg: "#d04268" },
  { key: "fuchsia", bg: "rgba(192, 38, 211, 0.12)", fg: "#c026d3" },
  { key: "purple", bg: "rgba(147, 51, 234, 0.12)", fg: "#9333ea" },
  { key: "violet", bg: "rgba(124, 92, 217, 0.12)", fg: "#6d4ad1" },
  { key: "indigo", bg: "rgba(67, 97, 209, 0.12)", fg: "#4361d1" },
  { key: "slate", bg: "rgba(71, 85, 105, 0.12)", fg: "#475569" },
];

const TINT_BY_KEY = new Map(FORM_TINTS.map((entry) => [entry.key, entry]));

/** Stable hash so an unstyled form keeps the same fallback tint every render. */
function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

export function isHexColor(value: string): boolean {
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

/** Resolve a stored icon_color into bg + fg. Accepts a named FormTintKey, a
 * literal hex (custom / brand color), or falls back to a deterministic tint. */
function resolveTint(id: string, iconColor: string | null): { bg: string; fg: string } {
  if (iconColor && TINT_BY_KEY.has(iconColor as FormTintKey)) {
    const t = TINT_BY_KEY.get(iconColor as FormTintKey)!;
    return { bg: t.bg, fg: t.fg };
  }
  if (iconColor && isHexColor(iconColor)) {
    return { bg: `color-mix(in srgb, ${iconColor} 13%, transparent)`, fg: iconColor };
  }
  const t = FORM_TINTS[hash(id) % FORM_TINTS.length];
  return { bg: t.bg, fg: t.fg };
}

export interface ResolvedFormAppearance {
  Icon: Icon;
  bg: string;
  fg: string;
  /** Set when the form's icon is a literal emoji; render this instead of Icon. */
  emoji: string | null;
}

/** Resolve a form's icon + accent. Handles legacy FormIconKeys, "ph:Name"
 * references, and literal emoji, falling back to a deterministic tint and the
 * default glyph when the admin has not chosen one. */
export function resolveFormAppearance(form: {
  id: string;
  icon: string | null;
  icon_color: string | null;
}): ResolvedFormAppearance {
  let Icon: Icon = Rows;
  let emoji: string | null = null;

  const raw = form.icon;
  if (raw) {
    if (raw.startsWith("ph:")) {
      Icon = ICON_BY_NAME[raw.slice(3)] ?? Rows;
    } else if (ICON_BY_KEY.has(raw as FormIconKey)) {
      Icon = ICON_BY_KEY.get(raw as FormIconKey) ?? Rows;
    } else {
      // Not a known key or Phosphor ref — treat as a chosen emoji glyph.
      emoji = raw;
    }
  }

  const tint = resolveTint(form.id, form.icon_color);

  return { Icon, bg: tint.bg, fg: tint.fg, emoji };
}

/** Render a resolved appearance's glyph (emoji or Phosphor icon) inline.
 * Single source of truth so every form-icon surface renders emoji the same. */
export function FormGlyph({
  appearance,
  size = 18,
  weight = "duotone",
}: {
  appearance: ResolvedFormAppearance;
  size?: number;
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone";
}) {
  if (appearance.emoji) {
    return <span style={{ fontSize: size, lineHeight: 1 }}>{appearance.emoji}</span>;
  }
  const { Icon } = appearance;
  return <Icon size={size} weight={weight} />;
}
