"use client";

/**
 * Icon registry for the Status Board.
 * Maps all 16 req_keys from REQUIREMENT_CONFIG to DocIconConfig appearances.
 * The DocIconConfig and DocMotif types are defined and exported here.
 */

import {
  House,
  Bank,
  CreditCard,
  Certificate,
  ShieldCheck,
  FileText,
  IdentificationCard,
  PuzzlePiece,
  WifiHigh,
  Buildings,
  BookOpen,
  Wrench,
  CalendarX,
  ClipboardText,
  SignOut,
  CurrencyDollar,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

/* ─────────────────────────────────────────────────────────────
   Types (self-contained, no preview imports)
───────────────────────────────────────────────────────────── */

/** Motif describes the internal illustration pattern inside a FileCardTile. */
export type DocMotif =
  | "agreement"   // text lines + signature line
  | "bank"        // text lines + masked account hint
  | "card"        // small payment card rectangle
  | "grid"        // form-grid rows
  | "form"        // label + field-underline pairs
  | "seal"        // badge circle + lines
  | "shield"      // shield glyph + lines
  | "id";         // photo-box + short lines

export interface DocIconConfig {
  Icon: Icon;
  label: string;
  shortLabel: string;
  tintBg: string;
  tintFg: string;
  /** Short uppercase banner text, max 6 chars */
  banner: string;
  /** Internal illustration motif for FileCardTile */
  motif: DocMotif;
}

/* ─────────────────────────────────────────────────────────────
   Icon map
───────────────────────────────────────────────────────────── */

/**
 * Maps every status-board req_key to a DocIconConfig.
 * All 16 keys from REQUIREMENT_CONFIG are represented.
 * Banner text is max 6 chars.
 */
const STATUS_BOARD_ICON_MAP: Record<string, DocIconConfig> = {
  // ── Signatures ──
  host_rental_agreement: {
    Icon: House,
    label: "Host Rental Agreement",
    shortLabel: "Host Agmt",
    tintBg: "rgba(27, 119, 190, 0.12)",
    tintFg: "#1b77be",
    banner: "LEASE",
    motif: "agreement",
  },
  ach_authorization: {
    Icon: Bank,
    label: "ACH Authorization",
    shortLabel: "ACH Auth",
    tintBg: "rgba(13, 148, 136, 0.12)",
    tintFg: "#0d9488",
    banner: "ACH",
    motif: "bank",
  },
  card_authorization: {
    Icon: CreditCard,
    label: "Card Authorization",
    shortLabel: "Card Auth",
    tintBg: "rgba(202, 138, 4, 0.14)",
    tintFg: "#b27908",
    banner: "CARD",
    motif: "card",
  },

  // ── Upload-backed compliance docs (permit/cert/ID = forms; W-9/platform auth = signatures) ──
  str_permit: {
    Icon: Certificate,
    label: "STR Permit",
    shortLabel: "STR Permit",
    tintBg: "rgba(13, 148, 136, 0.12)",
    tintFg: "#0d9488",
    banner: "PERMIT",
    motif: "seal",
  },
  insurance_certificate: {
    Icon: ShieldCheck,
    label: "Insurance Certificate",
    shortLabel: "Insurance",
    tintBg: "rgba(2, 132, 199, 0.12)",
    tintFg: "#0284c7",
    banner: "INS",
    motif: "shield",
  },
  w9: {
    Icon: FileText,
    label: "W-9",
    shortLabel: "W-9",
    tintBg: "rgba(185, 28, 28, 0.10)",
    tintFg: "#b91c1c",
    banner: "W-9",
    motif: "grid",
  },
  identity: {
    Icon: IdentificationCard,
    label: "Identity",
    shortLabel: "Identity",
    tintBg: "rgba(71, 85, 105, 0.12)",
    tintFg: "#475569",
    banner: "ID",
    motif: "id",
  },
  platform_authorization: {
    Icon: PuzzlePiece,
    label: "Platform Authorization",
    shortLabel: "Platform",
    tintBg: "rgba(79, 70, 229, 0.12)",
    tintFg: "#4f46e5",
    banner: "PLAT",
    motif: "form",
  },

  // ── Forms ──
  wifi_info: {
    Icon: WifiHigh,
    label: "WiFi Info",
    shortLabel: "WiFi",
    tintBg: "rgba(13, 148, 136, 0.12)",
    tintFg: "#0d9488",
    banner: "WIFI",
    motif: "form",
  },
  hoa_info: {
    Icon: Buildings,
    label: "HOA Info",
    shortLabel: "HOA",
    tintBg: "rgba(109, 40, 217, 0.12)",
    tintFg: "#6d28d9",
    banner: "HOA",
    motif: "form",
  },
  guidebook: {
    Icon: BookOpen,
    label: "Guidebook",
    shortLabel: "Guidebook",
    tintBg: "rgba(21, 128, 61, 0.12)",
    tintFg: "#15803d",
    banner: "GUIDE",
    motif: "agreement",
  },
  property_setup: {
    Icon: Wrench,
    label: "Property Setup",
    shortLabel: "Setup",
    tintBg: "rgba(79, 70, 229, 0.12)",
    tintFg: "#4f46e5",
    banner: "SETUP",
    motif: "form",
  },
  block_dates_calendar: {
    Icon: CalendarX,
    label: "Block Dates",
    shortLabel: "Dates",
    tintBg: "rgba(202, 138, 4, 0.14)",
    tintFg: "#b27908",
    banner: "DATES",
    motif: "form",
  },
  onboarding_inspection: {
    Icon: ClipboardText,
    label: "Onboarding Inspection",
    shortLabel: "Inspection",
    tintBg: "rgba(2, 132, 199, 0.12)",
    tintFg: "#0284c7",
    banner: "INSP",
    motif: "form",
  },
  property_offboarding: {
    Icon: SignOut,
    label: "Offboarding",
    shortLabel: "Offboard",
    tintBg: "rgba(71, 85, 105, 0.12)",
    tintFg: "#475569",
    banner: "OFF",
    motif: "form",
  },
  paid_onboarding_fee: {
    Icon: CurrencyDollar,
    label: "Onboarding Fee",
    shortLabel: "Onb. Fee",
    tintBg: "rgba(21, 128, 61, 0.12)",
    tintFg: "#15803d",
    banner: "FEE",
    motif: "form",
  },
};

/** Default fallback for unknown req_keys */
const FALLBACK_ICON_CONFIG: DocIconConfig = {
  Icon: FileText,
  label: "Unknown",
  shortLabel: "Unknown",
  tintBg: "rgba(0, 0, 0, 0.06)",
  tintFg: "#6b7280",
  banner: "DOC",
  motif: "form",
};

/**
 * Returns the DocIconConfig for a given req_key.
 */
export function getReqKeyIconConfig(reqKey: string): DocIconConfig {
  return STATUS_BOARD_ICON_MAP[reqKey] ?? FALLBACK_ICON_CONFIG;
}
