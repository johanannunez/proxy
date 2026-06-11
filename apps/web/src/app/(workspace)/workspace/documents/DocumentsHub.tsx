"use client";

/**
 * DocumentsHub — the owner documents portal, organized as guided packets.
 * Urgency-first IA: "Action required" packets lead, then "In progress", then
 * "Complete" (collapsed). Each packet opens a full-screen stepper. When every
 * required document is on file the grid gives way to a completion celebration.
 */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import {
  CaretDown,
  CreditCard,
  FolderSimpleUser,
  HouseLine,
  ShieldCheck,
  Signature,
} from "@phosphor-icons/react";
import type { DocumentHub, HubItem } from "@/lib/documents/workspace";
import { DocumentPacket } from "@/components/workspace/documents/DocumentPacket";
import { PacketStepper } from "@/components/workspace/documents/PacketStepper";
import { PDFPreviewModal } from "@/components/workspace/documents/PDFPreviewModal";
import { CompletionCelebration } from "@/components/workspace/documents/CompletionCelebration";
import {
  isPacketItemComplete,
  packetAttentionCount,
  type PacketItem,
  type TimelineEvent,
} from "@/components/workspace/documents/packet-types";
import { startSignature } from "./signing-actions";

// ─── Packet definitions ───────────────────────────────────────────────────────

type PacketKey = "owner" | "payment" | "property" | "compliance";

const PACKET_DEFS: Array<{
  key: PacketKey;
  title: string;
  description: string;
  icon: typeof FolderSimpleUser;
  documentKeys: string[];
}> = [
  {
    key: "owner",
    title: "Owner Package",
    description: "Your core agreements: management agreement, W-9, and identity verification.",
    icon: FolderSimpleUser,
    documentKeys: ["host_rental_agreement", "w9", "identity"],
  },
  {
    key: "payment",
    title: "Payment Setup",
    description: "Onboarding fee, bank transfers, and the card we keep on file for expenses.",
    icon: CreditCard,
    documentKeys: ["paid_onboarding_fee", "ach_authorization", "card_authorization"],
  },
  {
    key: "property",
    title: "Property Setup",
    description: "Everything we need to run your property: access, Wi-Fi, guidebook, and calendar.",
    icon: HouseLine,
    documentKeys: [
      "property_setup",
      "wifi_info",
      "guidebook",
      "block_dates_calendar",
      "platform_authorization",
    ],
  },
  {
    key: "compliance",
    title: "Compliance",
    description: "Permits, HOA details, and insurance that keep your rental above board.",
    icon: ShieldCheck,
    documentKeys: ["str_permit", "hoa_info", "insurance_certificate"],
  },
];

const FALLBACK_PACKET: PacketKey = "property";

function packetKeyFor(documentKey: string | null): PacketKey {
  if (!documentKey) return FALLBACK_PACKET;
  for (const def of PACKET_DEFS) {
    if (def.documentKeys.includes(documentKey)) return def.key;
  }
  return FALLBACK_PACKET;
}

function toPacketItem(item: HubItem): PacketItem {
  return {
    status: item.displayStatus,
    document_key: item.documentKey,
    title: item.title,
    id: item.id,
    description: item.description,
    statusLabel: item.statusLabel,
    action: item.action,
    href: item.href,
    fileUrl: item.fileUrl,
    propertyLabel: item.propertyLabel,
    lockedReason: item.lockedReason,
    isUrgent: item.isUrgent,
    completedAt: item.completedAt,
    expiresAt: item.expiresAt,
    events: timelineEventsFor(item),
  };
}

/** Minimal per-item activity derived from the fields the read model exposes today. */
function timelineEventsFor(item: HubItem): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  if (item.completedAt) {
    events.push({ event: "on_file", timestamp: item.completedAt, actor: "Proxy" });
  }
  return events;
}

type Packet = {
  key: PacketKey;
  title: string;
  description: string;
  icon: typeof FolderSimpleUser;
  items: PacketItem[];
};

type PacketSection = "action" | "progress" | "complete";

function sectionFor(packet: Packet): PacketSection {
  const { items } = packet;
  if (items.length > 0 && items.every(isPacketItemComplete)) return "complete";
  if (packetAttentionCount(items) > 0) return "action";
  return "progress";
}

function firstIncompleteIndex(items: PacketItem[]): number {
  const index = items.findIndex((i) => !isPacketItemComplete(i));
  return index === -1 ? 0 : index;
}

// ─── Request banner ───────────────────────────────────────────────────────────

type RequestContext = {
  id: string;
  items: Array<{ label: string; status: string }>;
};

function RequestBanner({ requestContext }: { requestContext: RequestContext }) {
  const openItems = requestContext.items.filter((i) => i.status !== "completed");
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
        style={{ background: "var(--color-brand-gradient)" }}
      >
        <Signature size={16} weight="fill" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
          Proxy requested {openItems.length} {openItems.length === 1 ? "document" : "documents"}{" "}
          from you
        </p>
        <p className="mt-0.5 text-sm" style={{ color: "var(--color-text-secondary)" }}>
          {openItems.map((i) => i.label).join(", ")}. {openItems.length === 1 ? "It's" : "They're"}{" "}
          ready below.
        </p>
      </div>
    </div>
  );
}

// ─── Sign drawer ──────────────────────────────────────────────────────────────

function SignDrawer({ item, onClose }: { item: PacketItem; onClose: () => void }) {
  const [state, setState] = useState<{
    loading: boolean;
    embedUrl: string | null;
    error: string | null;
  }>(() =>
    item.id
      ? { loading: true, embedUrl: null, error: null }
      : { loading: false, embedUrl: null, error: "Document not found." },
  );

  useEffect(() => {
    if (!item.id) return;
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
      className="fixed inset-0 z-[70] flex justify-end"
      style={{ height: "100dvh" }}
      role="dialog"
      aria-modal="true"
      aria-label={`Sign ${item.title}`}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />
      <div
        className="relative flex h-full w-full max-w-2xl flex-col overflow-hidden border-l shadow-2xl"
        style={{
          backgroundColor: "var(--color-white)",
          borderColor: "var(--color-warm-gray-200)",
        }}
      >
        <div
          className="flex shrink-0 items-center justify-between border-b p-5"
          style={{ borderColor: "var(--color-warm-gray-200)" }}
        >
          <div>
            <div className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
              {item.title}
            </div>
            <div className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
              {item.propertyLabel ?? "Account-level"}
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="cursor-pointer rounded-md px-2 py-1 text-sm font-medium transition-colors duration-150 hover:bg-[var(--color-warm-gray-100)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)] active:bg-[var(--color-warm-gray-200)]"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Close
          </button>
        </div>

        {state.embedUrl ? (
          <div className="min-h-0 flex-1" style={{ overflow: "hidden" }}>
            <iframe
              src={state.embedUrl}
              title={`Sign ${item.title}`}
              className="h-full w-full border-0"
              allow="camera; microphone; clipboard-write"
            />
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <Signature size={40} weight="duotone" style={{ color: "var(--color-brand)" }} />
            <div className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
              {state.loading ? "Preparing your document…" : "Sign right here, on Proxy"}
            </div>
            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
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

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionHeading({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <h2
        className="text-[13px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: "var(--color-text-tertiary)", fontFamily: "var(--font-sora)" }}
      >
        {label}
      </h2>
      <span
        className="rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums"
        style={{
          backgroundColor: "var(--color-warm-gray-100)",
          color: "var(--color-text-secondary)",
        }}
      >
        {count}
      </span>
    </div>
  );
}

// ─── Main hub ─────────────────────────────────────────────────────────────────

export function DocumentsHub({
  hub,
  requestContext = null,
}: {
  hub: DocumentHub;
  requestContext?: RequestContext | null;
}) {
  const router = useRouter();
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [activePacketKey, setActivePacketKey] = useState<PacketKey | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [signItem, setSignItem] = useState<PacketItem | null>(null);
  const [previewItem, setPreviewItem] = useState<PacketItem | null>(null);
  const [completeOpen, setCompleteOpen] = useState(false);

  // All hub items, filtered by property. Account-level items always show.
  const filteredItems = useMemo(() => {
    const list = [...hub.needed, ...hub.signature, ...hub.locked, ...hub.filed];
    return propertyFilter === "all"
      ? list
      : list.filter((i) => i.propertyId === null || i.propertyId === propertyFilter);
  }, [hub, propertyFilter]);

  // Group into packets, dropping empty ones.
  const packets = useMemo<Packet[]>(() => {
    const byPacket = new Map<PacketKey, PacketItem[]>();
    for (const item of filteredItems) {
      const key = packetKeyFor(item.documentKey);
      const bucket = byPacket.get(key) ?? [];
      bucket.push(toPacketItem(item));
      byPacket.set(key, bucket);
    }
    return PACKET_DEFS.filter((def) => (byPacket.get(def.key) ?? []).length > 0).map((def) => ({
      key: def.key,
      title: def.title,
      description: def.description,
      icon: def.icon,
      items: byPacket.get(def.key) ?? [],
    }));
  }, [filteredItems]);

  const sections = useMemo(() => {
    const action: Packet[] = [];
    const progress: Packet[] = [];
    const complete: Packet[] = [];
    for (const packet of packets) {
      const section = sectionFor(packet);
      if (section === "action") action.push(packet);
      else if (section === "progress") progress.push(packet);
      else complete.push(packet);
    }
    return { action, progress, complete };
  }, [packets]);

  const filteredComplete = filteredItems.filter((i) => i.displayStatus === "on_file").length;
  const filteredTotal = filteredItems.length;
  const allDone = filteredTotal > 0 && filteredComplete === filteredTotal;

  const activePacket = activePacketKey
    ? (packets.find((p) => p.key === activePacketKey) ?? null)
    : null;

  const handleFilterChange = (propertyId: string) => {
    // Changing scope invalidates the open packet's item list; close the stepper.
    setActivePacketKey(null);
    setPropertyFilter(propertyId);
  };

  const openPacket = (packet: Packet) => {
    setStepIndex(firstIncompleteIndex(packet.items));
    setActivePacketKey(packet.key);
  };

  const handleStepAction = (item: PacketItem) => {
    if (item.status === "on_file" && item.fileUrl) {
      setPreviewItem(item);
      return;
    }
    if (item.action === "sign") {
      setSignItem(item);
      return;
    }
    if ((item.action === "upload" || item.action === "fill") && item.href) {
      router.push(item.href);
    }
  };

  const celebrationSummary = useMemo(() => {
    const lines: string[] = [];
    const ownerPacket = packets.find((p) => p.key === "owner");
    const paymentPacket = packets.find((p) => p.key === "payment");
    const propertyPackets = packets.filter((p) => p.key === "property" || p.key === "compliance");
    if (ownerPacket) lines.push("Agreement signed, W-9 and identity on file");
    if (paymentPacket) lines.push("Payment setup complete: fee, ACH, and card authorization");
    if (propertyPackets.length > 0) lines.push("Property setup and compliance documents complete");
    return lines.length > 0 ? lines : ["Every required document is on file"];
  }, [packets]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      {requestContext && (
        <div className="mb-6">
          <RequestBanner requestContext={requestContext} />
        </div>
      )}

      {/* Overall progress — the chrome app bar supplies the page title */}
      {!allDone && filteredTotal > 0 && (
        <header
          className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border px-5 py-4"
          style={{
            borderColor: "var(--color-warm-gray-200)",
            backgroundColor: "var(--color-white)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <p
            className="text-sm font-semibold"
            style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-sora)" }}
          >
            {filteredComplete} of {filteredTotal} complete
          </p>
          <div
            className="h-1.5 min-w-32 flex-1 overflow-hidden rounded-full"
            style={{ backgroundColor: "var(--color-warm-gray-100)" }}
            role="progressbar"
            aria-valuenow={filteredComplete}
            aria-valuemin={0}
            aria-valuemax={filteredTotal}
            aria-label="Overall document progress"
          >
            <div
              className="h-full w-full rounded-full transition-transform duration-700"
              style={{
                transform: `scaleX(${filteredComplete / filteredTotal})`,
                transformOrigin: "left",
                background: "var(--color-brand-gradient)",
              }}
            />
          </div>
          <span
            className="text-sm font-bold tabular-nums"
            style={{ color: "var(--color-brand)" }}
          >
            {Math.round((filteredComplete / filteredTotal) * 100)}%
          </span>
        </header>
      )}

      {/* Property filter tabs */}
      {hub.properties.length > 1 && (
        <div
          className="mt-5 flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-lg p-1"
          style={{ backgroundColor: "var(--color-warm-gray-100)" }}
          role="tablist"
          aria-label="Filter by property"
        >
          {[{ id: "all", label: "All properties" }, ...hub.properties].map((p) => {
            const active = propertyFilter === p.id;
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => handleFilterChange(p.id)}
                className="cursor-pointer whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors duration-150 hover:text-[var(--color-text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)] active:opacity-90"
                style={{
                  backgroundColor: active ? "var(--color-white)" : "transparent",
                  color: active ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                  boxShadow: active ? "0 1px 2px rgba(16,24,40,0.08)" : "none",
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Celebration or packet sections */}
      {allDone ? (
        <div className="mt-8">
          <CompletionCelebration
            summaryLines={celebrationSummary}
            whatHappensNext="With your paperwork complete, we move straight into operations: your listing goes live on schedule, payouts route to your bank automatically, and your dashboard starts tracking bookings and revenue. We'll reach out only if anything needs a renewal."
          />
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-10">
          {sections.action.length > 0 && (
            <section aria-label="Action required">
              <SectionHeading label="Action required" count={sections.action.length} />
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {sections.action.map((packet) => (
                  <DocumentPacket
                    key={packet.key}
                    title={packet.title}
                    description={packet.description}
                    items={packet.items}
                    icon={packet.icon}
                    onOpen={() => openPacket(packet)}
                  />
                ))}
              </div>
            </section>
          )}

          {sections.progress.length > 0 && (
            <section aria-label="In progress">
              <SectionHeading label="In progress" count={sections.progress.length} />
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {sections.progress.map((packet) => (
                  <DocumentPacket
                    key={packet.key}
                    title={packet.title}
                    description={packet.description}
                    items={packet.items}
                    icon={packet.icon}
                    onOpen={() => openPacket(packet)}
                  />
                ))}
              </div>
            </section>
          )}

          {sections.complete.length > 0 && (
            <section aria-label="Complete">
              <button
                type="button"
                onClick={() => setCompleteOpen((v) => !v)}
                aria-expanded={completeOpen}
                className="inline-flex cursor-pointer items-center gap-2 rounded-md transition-opacity duration-150 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)] active:opacity-70"
              >
                <SectionHeading label="Complete" count={sections.complete.length} />
                <CaretDown
                  size={13}
                  weight="bold"
                  style={{
                    color: "var(--color-text-tertiary)",
                    transform: completeOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 200ms var(--ease-spring)",
                  }}
                />
              </button>
              {completeOpen && (
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {sections.complete.map((packet) => (
                    <DocumentPacket
                      key={packet.key}
                      title={packet.title}
                      description={packet.description}
                      items={packet.items}
                      icon={packet.icon}
                      onOpen={() => openPacket(packet)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* Full-screen packet stepper */}
      <AnimatePresence>
        {activePacket && (
          <PacketStepper
            key={activePacket.key}
            packetTitle={activePacket.title}
            items={activePacket.items}
            currentIndex={stepIndex}
            onNext={() =>
              setStepIndex((i) => Math.min(i + 1, activePacket.items.length - 1))
            }
            onBack={() => setStepIndex((i) => Math.max(i - 1, 0))}
            onClose={() => setActivePacketKey(null)}
            onAction={handleStepAction}
            onJumpTo={setStepIndex}
          />
        )}
      </AnimatePresence>

      {/* PDF preview */}
      <PDFPreviewModal
        fileUrl={previewItem?.fileUrl ?? ""}
        title={previewItem?.title ?? "Document"}
        open={Boolean(previewItem?.fileUrl)}
        onClose={() => setPreviewItem(null)}
      />

      {/* Embedded signing */}
      {signItem && (
        <SignDrawer
          item={signItem}
          onClose={() => {
            setSignItem(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
