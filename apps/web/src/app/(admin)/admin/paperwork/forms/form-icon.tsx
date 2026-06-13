"use client";

/**
 * Form appearance catalog — the curated icon + accent palette an admin can
 * assign per form. Shared by the Forms library row and the appearance picker
 * so the two never drift. SVG glyphs only (no emoji), drawn from Phosphor.
 */

import type { Icon } from "@phosphor-icons/react";
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

export type FormTintKey = "blue" | "teal" | "violet" | "amber" | "rose" | "pine" | "indigo" | "slate";

export const FORM_TINTS: Array<{ key: FormTintKey; bg: string; fg: string }> = [
  { key: "blue", bg: "rgba(27, 119, 190, 0.12)", fg: "#1b77be" },
  { key: "teal", bg: "rgba(13, 148, 136, 0.12)", fg: "#0d9488" },
  { key: "violet", bg: "rgba(124, 92, 217, 0.12)", fg: "#6d4ad1" },
  { key: "amber", bg: "rgba(202, 138, 4, 0.14)", fg: "#b27908" },
  { key: "rose", bg: "rgba(219, 75, 109, 0.12)", fg: "#d04268" },
  { key: "pine", bg: "rgba(15, 118, 110, 0.12)", fg: "#0f766e" },
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

export interface ResolvedFormAppearance {
  Icon: Icon;
  bg: string;
  fg: string;
}

/** Resolve a form's icon + accent, falling back to a deterministic tint and
 * the default glyph when the admin has not chosen one. */
export function resolveFormAppearance(form: {
  id: string;
  icon: string | null;
  icon_color: string | null;
}): ResolvedFormAppearance {
  const Icon = (form.icon && ICON_BY_KEY.get(form.icon as FormIconKey)) || Rows;
  const tint =
    (form.icon_color && TINT_BY_KEY.get(form.icon_color as FormTintKey)) ||
    FORM_TINTS[hash(form.id) % FORM_TINTS.length];
  return { Icon, bg: tint.bg, fg: tint.fg };
}
