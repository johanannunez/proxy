"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { startSignature } from "./signing-actions";
import {
  ArrowRight,
  CheckCircle,
  Clock,
  DownloadSimple,
  Lock,
  PencilSimple,
  Signature,
  UploadSimple,
  ShieldCheck,
  Warning,
} from "@phosphor-icons/react";
import { FileCard, type FormatFileProps } from "@/components/ui/file-card-collections";
import type { DocumentHub, HubItem, HubAction } from "@/lib/documents/workspace";
import type { DocumentDisplayStatus } from "@/lib/documents/status";
import type { WorkspaceDocumentKey } from "@/lib/admin/documents-hub-shared";
import { WORKSPACE_DOCUMENT_DEFINITIONS } from "@/lib/admin/documents-hub-shared";

// ─── Utilities ────────────────────────────────────────────────────────────────

function safeHref(url: string | null | undefined): string {
  if (!url) return "#";
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? url : "#";
  } catch {
    return "#";
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FORMAT_BY_KEY: Partial<Record<WorkspaceDocumentKey, FormatFileProps>> = {
  host_rental_agreement: "doc",
  w9: "txt",
  identity: "img",
  paid_onboarding_fee: "xls",
  ach_authorization: "xls",
  card_authorization: "pdf",
  property_setup: "csv",
  wifi_info: "json",
  guidebook: "md",
  block_dates_calendar: "xls",
  str_permit: "pdf",
  hoa_info: "doc",
  insurance_certificate: "pdf",
  platform_authorization: "code",
};

const PREVIEW_BADGE: Partial<Record<WorkspaceDocumentKey, string>> = {
  host_rental_agreement: "Agreement",
  w9: "W-9",
  identity: "ID",
  paid_onboarding_fee: "Fee",
  ach_authorization: "ACH",
  card_authorization: "Card",
  property_setup: "Setup",
  wifi_info: "Wi-Fi",
  guidebook: "Guide",
  block_dates_calendar: "Dates",
  str_permit: "Permit",
  hoa_info: "HOA",
  insurance_certificate: "Insurance",
  platform_authorization: "Platforms",
};

const STATUS_TONE: Record<DocumentDisplayStatus, { bg: string; fg: string }> = {
  needed: { bg: "rgba(245, 158, 11, 0.14)", fg: "#b45309" },
  action_required: { bg: "rgba(220, 38, 38, 0.12)", fg: "#b91c1c" },
  expired: { bg: "rgba(220, 38, 38, 0.12)", fg: "#b91c1c" },
  locked: { bg: "var(--color-warm-gray-100)", fg: "var(--color-text-tertiary)" },
  sent: { bg: "rgba(2, 170, 235, 0.12)", fg: "#0c6fae" },
  signed: { bg: "rgba(2, 170, 235, 0.12)", fg: "#0c6fae" },
  awaiting_countersignature: { bg: "rgba(99, 102, 241, 0.12)", fg: "#4f46e5" },
  submitted: { bg: "rgba(2, 170, 235, 0.10)", fg: "#0c6fae" },
  under_review: { bg: "rgba(99, 102, 241, 0.12)", fg: "#4f46e5" },
  on_file: { bg: "rgba(22, 163, 74, 0.12)", fg: "#15803d" },
};

const STATUS_LABELS: Record<DocumentDisplayStatus, string> = {
  needed: "Needed",
  action_required: "Action required",
  expired: "Expired",
  locked: "Locked",
  sent: "Ready to sign",
  signed: "Signed",
  awaiting_countersignature: "With Proxy",
  submitted: "Under review",
  under_review: "Under review",
  on_file: "On file",
};

const DOT_COLOR: Record<DocumentDisplayStatus, string> = {
  action_required: "#dc2626",
  expired: "#dc2626",
  needed: "#d97706",
  sent: "#0c6fae",
  signed: "#0c6fae",
  awaiting_countersignature: "#0c6fae",
  submitted: "#4f46e5",
  under_review: "#4f46e5",
  on_file: "#15803d",
  locked: "var(--color-warm-gray-300)",
};

const ACTION_META: Record<HubAction, { label: string; icon: typeof UploadSimple }> = {
  upload: { label: "Upload", icon: UploadSimple },
  fill: { label: "Complete form", icon: PencilSimple },
  sign: { label: "Review & sign", icon: Signature },
  view: { label: "View", icon: ArrowRight },
  waiting: { label: "With Proxy", icon: Clock },
};

const GROUP_ORDER = ["Owner package", "Payment setup", "Property setup"] as const;
type GroupLabel = (typeof GROUP_ORDER)[number];

// ─── Journey Stepper ──────────────────────────────────────────────────────────

type JourneyKind = "signature" | "upload" | "form" | "fee";

function getJourneyKind(key: WorkspaceDocumentKey | null): JourneyKind {
  if (!key) return "form";
  const def = WORKSPACE_DOCUMENT_DEFINITIONS[key];
  if (!def) return "form";
  if (key === "paid_onboarding_fee") return "fee";
  if (def.kind === "secure_doc") return "signature";
  if (def.kind === "upload") return "upload";
  return "form";
}

const JOURNEY_STEPS: Record<JourneyKind, string[]> = {
  signature: ["Ready to sign", "Signed", "With Proxy", "On file"],
  upload: ["Upload", "Under review", "On file"],
  form: ["Fill in", "Under review", "On file"],
  fee: ["With Proxy", "On file"],
};

function getActiveStep(kind: JourneyKind, status: DocumentDisplayStatus): number {
  if (status === "on_file") return 999;
  switch (kind) {
    case "signature":
      if (status === "signed") return 1;
      if (status === "awaiting_countersignature") return 2;
      return 0;
    case "upload":
    case "form":
      if (status === "submitted" || status === "under_review") return 1;
      return 0;
    case "fee":
      return 0;
  }
}

function JourneyStepper({ item }: { item: HubItem }) {
  const kind = getJourneyKind(item.documentKey);
  const steps = JOURNEY_STEPS[kind];
  const activeStep = getActiveStep(kind, item.displayStatus);
  const allDone = item.displayStatus === "on_file";

  return (
    <div className="flex items-start">
      {steps.flatMap((label, i) => {
        const isComplete = allDone || i < activeStep;
        const isActive = !allDone && i === activeStep;
        const isLast = i === steps.length - 1;

        const circleColor = isComplete
          ? "#15803d"
          : isActive
            ? "var(--color-brand)"
            : "transparent";

        const elems: React.ReactNode[] = [
          <div
            key={label}
            className="flex flex-col items-center"
            style={{ flex: "0 0 auto", width: 60 }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                backgroundColor: circleColor,
                border:
                  isComplete || isActive
                    ? "none"
                    : "2px solid var(--color-warm-gray-300)",
                transition: "background-color 300ms",
              }}
            >
              {isComplete && (
                <CheckCircle size={13} weight="fill" className="text-white" />
              )}
              {isActive && (
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: "white",
                  }}
                />
              )}
            </div>
            <span
              className="mt-2 text-center leading-tight"
              style={{
                fontSize: 10,
                fontWeight: isActive ? 600 : 400,
                color: isActive
                  ? "var(--color-brand)"
                  : isComplete
                    ? "#15803d"
                    : "var(--color-text-tertiary)",
                maxWidth: 52,
              }}
            >
              {label}
            </span>
          </div>,
        ];

        if (!isLast) {
          elems.push(
            <div
              key={`line-${i}`}
              style={{
                flex: 1,
                height: 2,
                alignSelf: "flex-start",
                marginTop: 11,
                backgroundColor: isComplete
                  ? "#15803d"
                  : "var(--color-warm-gray-200)",
                transition: "background-color 300ms",
              }}
            />,
          );
        }

        return elems;
      })}
    </div>
  );
}

// ─── Status Pill ──────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: DocumentDisplayStatus }) {
  const tone = STATUS_TONE[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
      style={{ backgroundColor: tone.bg, color: tone.fg }}
    >
      {status === "on_file" && <CheckCircle size={12} weight="fill" />}
      {status === "locked" && <Lock size={11} weight="bold" />}
      {(status === "action_required" || status === "expired") && (
        <Warning size={12} weight="fill" />
      )}
      {STATUS_LABELS[status]}
    </span>
  );
}

// ─── Nav Item ─────────────────────────────────────────────────────────────────

function DocNavItem({
  item,
  isSelected,
  onClick,
}: {
  item: HubItem;
  isSelected: boolean;
  onClick: () => void;
}) {
  const locked = item.displayStatus === "locked";
  const done = item.displayStatus === "on_file";

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors duration-150 hover:bg-[var(--color-warm-gray-50)]"
      style={{
        backgroundColor: isSelected ? "var(--color-warm-gray-100)" : undefined,
        opacity: locked ? 0.55 : 1,
      }}
    >
      {isSelected && (
        <div
          className="absolute left-0 top-1/2 h-[18px] w-[3px] -translate-y-1/2 rounded-full"
          style={{ backgroundColor: "var(--color-brand)" }}
        />
      )}

      <div
        className="h-[7px] w-[7px] shrink-0 rounded-full"
        style={{ backgroundColor: DOT_COLOR[item.displayStatus] }}
      />

      <span
        className="flex-1 truncate text-[13px]"
        style={{
          color: isSelected
            ? "var(--color-text-primary)"
            : "var(--color-text-secondary)",
          fontWeight: isSelected ? 600 : 400,
        }}
      >
        {item.title}
      </span>

      {done && (
        <CheckCircle
          size={13}
          weight="fill"
          style={{ color: "#15803d", flexShrink: 0 }}
        />
      )}
      {locked && (
        <Lock
          size={12}
          weight="bold"
          style={{ color: "var(--color-text-tertiary)", flexShrink: 0 }}
        />
      )}
    </button>
  );
}

// ─── Nav Group ────────────────────────────────────────────────────────────────

function DocNavGroup({
  title,
  items,
  selectedId,
  onSelect,
}: {
  title: string;
  items: HubItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="px-3 pb-1 pt-5">
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.1em]"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          {title}
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        {items.map((item) => (
          <DocNavItem
            key={item.id}
            item={item}
            isSelected={selectedId === item.id}
            onClick={() => onSelect(item.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DocDetailPanel({
  item,
  allItems,
  onSign,
  onSelectId,
}: {
  item: HubItem;
  allItems: Record<string, HubItem>;
  onSign: (item: HubItem) => void;
  onSelectId: (id: string) => void;
}) {
  const def = item.documentKey
    ? WORKSPACE_DOCUMENT_DEFINITIONS[item.documentKey]
    : null;
  const format =
    (item.documentKey && FORMAT_BY_KEY[item.documentKey]) ?? "doc";
  const badge =
    (item.documentKey && PREVIEW_BADGE[item.documentKey]) ?? "Doc";
  const meta = ACTION_META[item.action];
  const ActionIcon = meta.icon;
  const locked = item.displayStatus === "locked";
  const done = item.displayStatus === "on_file";
  const waiting = item.action === "waiting" && !locked;

  const isExpiringSoon = item.expiresAt
    ? (new Date(item.expiresAt).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24) <=
      60
    : false;

  const prerequisite = locked
    ? Object.values(allItems)
        .filter(
          (d) =>
            d.gateStep < item.gateStep &&
            d.displayStatus !== "on_file" &&
            d.displayStatus !== "locked",
        )
        .sort((a, b) => a.gateStep - b.gateStep)[0] ?? null
    : null;

  return (
    <motion.div
      key={item.id}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className="flex h-full flex-col"
    >
      {/* Header */}
      <div
        className="flex flex-wrap items-start gap-5 border-b px-6 py-5"
        style={{
          borderColor: "var(--color-warm-gray-200)",
          backgroundColor: "var(--color-white)",
        }}
      >
        <div className="shrink-0" style={{ opacity: locked ? 0.45 : 1 }}>
          <FileCard formatFile={format} badgeLabel={badge} />
        </div>
        <div className="min-w-0 flex-1 pt-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2
              className="text-base font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              {item.title}
            </h2>
            <StatusPill status={item.displayStatus} />
          </div>
          <div
            className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            <span>{item.propertyLabel ?? "Account-level"}</span>
            {item.expiresAt && (
              <>
                <span>·</span>
                <span
                  className="inline-flex items-center gap-1"
                  style={{
                    color: isExpiringSoon
                      ? "#d97706"
                      : "var(--color-text-tertiary)",
                  }}
                >
                  {isExpiringSoon && <Warning size={11} weight="fill" />}
                  Expires{" "}
                  {new Date(item.expiresAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </>
            )}
            {done && item.completedAt && (
              <>
                <span>·</span>
                <span>
                  Completed{" "}
                  {new Date(item.completedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-7 overflow-y-auto p-6">
        {/* Journey stepper */}
        {!locked && !waiting && (
          <div>
            <p
              className="mb-4 text-[10px] font-semibold uppercase tracking-[0.1em]"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              Progress
            </p>
            <JourneyStepper item={item} />
          </div>
        )}

        {/* Description */}
        {def?.description && (
          <div>
            <p
              className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em]"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              About this document
            </p>
            <p
              className="text-sm leading-relaxed"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {def.description}
            </p>
          </div>
        )}

        {/* Locked explanation */}
        {locked && (
          <div
            className="rounded-2xl border p-5"
            style={{
              borderColor: "var(--color-warm-gray-200)",
              backgroundColor: "var(--color-white)",
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: "var(--color-warm-gray-100)" }}
              >
                <Lock
                  size={16}
                  weight="duotone"
                  style={{ color: "var(--color-text-tertiary)" }}
                />
              </div>
              <div className="min-w-0">
                <p
                  className="text-sm font-semibold"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  Not yet available
                </p>
                <p
                  className="mt-0.5 text-sm leading-relaxed"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {item.lockedReason ??
                    "Complete the earlier steps to unlock this document."}
                </p>
                {prerequisite && (
                  <button
                    type="button"
                    onClick={() => onSelectId(prerequisite.id)}
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold"
                    style={{ color: "var(--color-brand)" }}
                  >
                    Go to {prerequisite.title}
                    <ArrowRight size={14} weight="bold" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Waiting state */}
        {waiting && (
          <div
            className="rounded-2xl border p-5"
            style={{
              borderColor: "var(--color-warm-gray-200)",
              backgroundColor: "var(--color-white)",
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: "var(--color-warm-gray-100)" }}
              >
                <Clock
                  size={16}
                  weight="duotone"
                  style={{ color: "var(--color-text-tertiary)" }}
                />
              </div>
              <div>
                <p
                  className="text-sm font-semibold"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  With Proxy
                </p>
                <p
                  className="mt-0.5 text-sm leading-relaxed"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  This is being handled on our end. No action needed from you
                  right now.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* On file confirmation */}
        {done && (
          <div
            className="flex items-center gap-3 rounded-2xl border p-4"
            style={{
              borderColor: "rgba(22, 163, 74, 0.25)",
              backgroundColor: "rgba(22, 163, 74, 0.05)",
            }}
          >
            <ShieldCheck
              size={18}
              weight="duotone"
              style={{ color: "#15803d", flexShrink: 0 }}
            />
            <p
              className="text-sm font-medium"
              style={{ color: "var(--color-text-primary)" }}
            >
              This document is complete and on file.
            </p>
          </div>
        )}

        {/* CTA */}
        {!locked && (
          <div>
            {done && item.fileUrl ? (
              <a
                href={safeHref(item.fileUrl)}
                className="inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors duration-150 hover:bg-[var(--color-warm-gray-50)]"
                style={{
                  borderColor: "var(--color-warm-gray-200)",
                  color: "var(--color-text-secondary)",
                }}
              >
                <DownloadSimple size={15} weight="bold" />
                Download
              </a>
            ) : item.action === "sign" ? (
              <button
                type="button"
                onClick={() => onSign(item)}
                className="inline-flex h-10 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white transition-transform duration-150 active:scale-[0.98]"
                style={{ backgroundColor: "var(--color-brand)" }}
              >
                <Signature size={15} weight="bold" />
                Review & sign
              </button>
            ) : item.href &&
              (item.action === "upload" || item.action === "fill") ? (
              <Link
                href={item.href}
                className="inline-flex h-10 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white transition-transform duration-150 active:scale-[0.98]"
                style={{ backgroundColor: "var(--color-brand)" }}
              >
                <ActionIcon size={15} weight="bold" />
                {meta.label}
              </Link>
            ) : null}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Request Banner ───────────────────────────────────────────────────────────

type RequestContext = {
  id: string;
  items: Array<{ label: string; status: string }>;
};

function RequestBanner({ requestContext }: { requestContext: RequestContext }) {
  const openItems = requestContext.items.filter(
    (i) => i.status !== "completed",
  );
  if (openItems.length === 0) return null;
  return (
    <div
      className="flex items-start gap-3 rounded-2xl border p-5"
      style={{
        borderColor: "rgba(2,170,235,0.25)",
        backgroundColor: "rgba(2,170,235,0.05)",
      }}
    >
      <span
        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"
        style={{ background: "linear-gradient(135deg, #02aaeb, #1b77be)" }}
      >
        <Signature size={16} weight="fill" />
      </span>
      <div className="min-w-0">
        <p
          className="text-sm font-semibold"
          style={{ color: "var(--color-text-primary)" }}
        >
          Proxy requested {openItems.length}{" "}
          {openItems.length === 1 ? "document" : "documents"} from you
        </p>
        <p
          className="mt-0.5 text-sm"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {openItems.map((i) => i.label).join(", ")}.{" "}
          {openItems.length === 1 ? "It's" : "They're"} ready below.
        </p>
      </div>
    </div>
  );
}

// ─── Sign Drawer ──────────────────────────────────────────────────────────────

function SignDrawer({
  item,
  onClose,
}: {
  item: HubItem;
  onClose: () => void;
}) {
  const [state, setState] = useState<{
    loading: boolean;
    embedUrl: string | null;
    error: string | null;
  }>({
    loading: true,
    embedUrl: null,
    error: null,
  });

  useEffect(() => {
    let active = true;
    startSignature(item.id).then((res) => {
      if (!active) return;
      setState({
        loading: false,
        embedUrl: res.embedUrl,
        error: res.ok ? null : (res.error ?? null),
      });
    });
    return () => {
      active = false;
    };
  }, [item.id]);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div
        className="relative flex h-full w-full max-w-2xl flex-col border-l shadow-2xl"
        style={{
          backgroundColor: "var(--color-white)",
          borderColor: "var(--color-warm-gray-200)",
        }}
      >
        <div
          className="flex items-center justify-between border-b p-5"
          style={{ borderColor: "var(--color-warm-gray-200)" }}
        >
          <div>
            <div
              className="text-sm font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              {item.title}
            </div>
            <div
              className="text-xs"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              {item.propertyLabel ?? "Account-level"}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-sm font-medium"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Close
          </button>
        </div>

        {state.embedUrl ? (
          <iframe
            src={state.embedUrl}
            title={`Sign ${item.title}`}
            className="h-full w-full flex-1 border-0"
            allow="camera; microphone; clipboard-write"
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <Signature
              size={40}
              weight="duotone"
              style={{ color: "var(--color-brand)" }}
            />
            <div
              className="text-sm font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              {state.loading
                ? "Preparing your document…"
                : "Sign right here, on Proxy"}
            </div>
            <p
              className="text-sm"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {state.error
                ? state.error
                : "You'll review and sign here without leaving Proxy, and we'll countersign on our end."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Hub ─────────────────────────────────────────────────────────────────

export function DocumentsHub({
  hub,
  requestContext = null,
}: {
  hub: DocumentHub;
  requestContext?: RequestContext | null;
}) {
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [signItem, setSignItem] = useState<HubItem | null>(null);

  // Flat lookup of all items
  const allItems = useMemo(() => {
    const list = [
      ...hub.needed,
      ...hub.signature,
      ...hub.locked,
      ...hub.filed,
    ];
    return Object.fromEntries(list.map((i) => [i.id, i]));
  }, [hub]);

  // Property-filtered flat list (preserves ordering from allItems merge)
  const filteredList = useMemo(() => {
    const list = [
      ...hub.needed,
      ...hub.signature,
      ...hub.locked,
      ...hub.filed,
    ];
    return propertyFilter === "all"
      ? list
      : list.filter(
          (i) => i.propertyId === null || i.propertyId === propertyFilter,
        );
  }, [hub, propertyFilter]);

  // Grouped by definition group for nav
  const groupedItems = useMemo(() => {
    const groups: Record<GroupLabel, HubItem[]> = {
      "Owner package": [],
      "Payment setup": [],
      "Property setup": [],
    };
    for (const item of filteredList) {
      const def = item.documentKey
        ? WORKSPACE_DOCUMENT_DEFINITIONS[item.documentKey]
        : null;
      const g = def?.group;
      const key: GroupLabel =
        g === "Owner package" || g === "Payment setup" || g === "Property setup"
          ? g
          : "Property setup";
      groups[key].push(item);
    }
    return groups;
  }, [filteredList]);

  // Auto-select first actionable item on mount
  useEffect(() => {
    if (selectedId && allItems[selectedId]) return;
    const first =
      hub.needed[0] ??
      hub.signature[0] ??
      hub.filed[0] ??
      hub.locked[0] ??
      null;
    if (first) setSelectedId(first.id);
  }, [hub, selectedId, allItems]);

  const selectedItem = selectedId ? (allItems[selectedId] ?? null) : null;
  const allDone =
    hub.progress.complete === hub.progress.total && hub.progress.total > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {requestContext && (
        <div className="px-4 pt-4 sm:px-6 sm:pt-5">
          <RequestBanner requestContext={requestContext} />
        </div>
      )}

      {/* Two-panel viewer — edge-to-edge, fills remaining height */}
      <div
        className="flex min-h-0 flex-1 flex-col border-t md:flex-row"
        style={{ borderColor: "var(--color-warm-gray-200)" }}
      >
        {/* Left panel — Navigator */}
        <div
          className="flex w-full shrink-0 flex-col border-b md:w-[260px] md:border-b-0 md:border-r"
          style={{
            borderColor: "var(--color-warm-gray-200)",
            backgroundColor: "var(--color-white)",
            overflow: "hidden",
          }}
        >
          {/* Progress header */}
          <div
            className="border-b p-4"
            style={{ borderColor: "var(--color-warm-gray-200)" }}
          >
            <div className="mb-2 flex items-center justify-between">
              <span
                className="text-xs font-semibold"
                style={{ color: "var(--color-text-primary)" }}
              >
                {allDone
                  ? "All complete"
                  : `${hub.progress.complete} of ${hub.progress.total} complete`}
              </span>
              <span
                className="text-xs font-bold"
                style={{ color: allDone ? "#15803d" : "var(--color-brand)" }}
              >
                {hub.progress.pct}%
              </span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full"
              style={{ backgroundColor: "var(--color-warm-gray-100)" }}
            >
              <div
                className="h-full rounded-full transition-[width] duration-700"
                style={{
                  width: `${hub.progress.pct}%`,
                  backgroundColor: allDone ? "#15803d" : "var(--color-brand)",
                }}
              />
            </div>
            {hub.properties.length > 1 && (
              <div
                className="mt-3 flex items-center gap-1 overflow-x-auto rounded-lg p-1"
                style={{ backgroundColor: "var(--color-warm-gray-50)" }}
              >
                {[{ id: "all", label: "All" }, ...hub.properties].map((p) => {
                  const active = propertyFilter === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPropertyFilter(p.id)}
                      className="whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors duration-150"
                      style={{
                        backgroundColor: active
                          ? "var(--color-white)"
                          : "transparent",
                        color: active
                          ? "var(--color-text-primary)"
                          : "var(--color-text-secondary)",
                        boxShadow: active
                          ? "0 1px 2px rgba(16,24,40,0.06)"
                          : "none",
                      }}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Mobile: horizontal pill scroll */}
          <div
            className="flex gap-1.5 overflow-x-auto p-3 md:hidden"
            style={{
              borderBottom: `1px solid var(--color-warm-gray-100)`,
            }}
          >
            {filteredList.map((item) => {
              const shortLabel =
                (item.documentKey &&
                  WORKSPACE_DOCUMENT_DEFINITIONS[item.documentKey]
                    ?.shortLabel) ??
                item.title;
              const isSelected = selectedId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-150"
                  style={{
                    backgroundColor: isSelected
                      ? "var(--color-warm-gray-100)"
                      : "transparent",
                    border: `1px solid ${isSelected ? "var(--color-warm-gray-300)" : "var(--color-warm-gray-200)"}`,
                    color: isSelected
                      ? "var(--color-text-primary)"
                      : "var(--color-text-secondary)",
                  }}
                >
                  <div
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: DOT_COLOR[item.displayStatus],
                    }}
                  />
                  {shortLabel}
                </button>
              );
            })}
          </div>

          {/* Desktop: group nav */}
          <div className="hidden flex-1 overflow-y-auto px-2 pb-4 md:block">
            {GROUP_ORDER.map((group) => (
              <DocNavGroup
                key={group}
                title={group}
                items={groupedItems[group] ?? []}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            ))}
          </div>
        </div>

        {/* Right panel — Detail */}
        <div
          className="flex min-w-0 flex-1 flex-col"
          style={{ backgroundColor: "var(--color-warm-gray-50)" }}
        >
          <AnimatePresence mode="wait">
            {selectedItem ? (
              <DocDetailPanel
                key={selectedItem.id}
                item={selectedItem}
                allItems={allItems}
                onSign={setSignItem}
                onSelectId={setSelectedId}
              />
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center"
              >
                <p
                  className="text-sm"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  Select a document
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {signItem && (
        <SignDrawer item={signItem} onClose={() => setSignItem(null)} />
      )}
    </div>
  );
}
