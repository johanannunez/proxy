"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  UserCircle,
  House,
  CurrencyDollar,
  CalendarBlank,
  FileText,
  ChatCircle,
  PushPin,
  ClockCounterClockwise,
  Star,
  X,
  CaretDown,
} from "@phosphor-icons/react";
import { formatMedium, formatRelative, formatLong } from "@/lib/format";
import { EmptyState } from "@/components/workspace/EmptyState";
import { createClient } from "@/lib/supabase/client";
import type { TimelineEntry } from "./page";

type Category =
  | "all"
  | "account"
  | "property"
  | "financial"
  | "calendar"
  | "document"
  | "communication";

type FilterPill = {
  key: Category;
  label: string;
  icon: React.ComponentType<{ size?: number; weight?: "duotone" }>;
};

const FILTER_PILLS: FilterPill[] = [
  { key: "all", label: "All", icon: ClockCounterClockwise },
  { key: "account", label: "Account", icon: UserCircle },
  { key: "property", label: "Property", icon: House },
  { key: "financial", label: "Financial", icon: CurrencyDollar },
  { key: "calendar", label: "Calendar", icon: CalendarBlank },
  { key: "document", label: "Documents", icon: FileText },
  { key: "communication", label: "Messages", icon: ChatCircle },
];

const CATEGORY_CONFIG: Record<
  string,
  { color: string; bg: string; icon: React.ComponentType<{ size?: number; weight?: "duotone" }> }
> = {
  account: {
    color: "var(--color-brand)",
    bg: "rgba(27, 119, 190, 0.10)",
    icon: UserCircle,
  },
  property: {
    color: "#15803d",
    bg: "rgba(22, 163, 74, 0.10)",
    icon: House,
  },
  financial: {
    color: "#15803d",
    bg: "rgba(22, 163, 74, 0.10)",
    icon: CurrencyDollar,
  },
  calendar: {
    color: "#b45309",
    bg: "rgba(245, 158, 11, 0.12)",
    icon: CalendarBlank,
  },
  document: {
    color: "var(--color-text-secondary)",
    bg: "var(--color-warm-gray-100)",
    icon: FileText,
  },
  communication: {
    color: "var(--color-brand)",
    bg: "rgba(27, 119, 190, 0.10)",
    icon: ChatCircle,
  },
};

const DEFAULT_CONFIG = {
  color: "var(--color-text-tertiary)",
  bg: "var(--color-warm-gray-100)",
  icon: Star,
};

function getCategoryConfig(category: string) {
  return CATEGORY_CONFIG[category] ?? DEFAULT_CONFIG;
}

function formatDayKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round(
    (today.getTime() - target.getTime()) / 86_400_000,
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return formatRelative(dateStr);

  return formatMedium(dateStr);
}

function formatEntryTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = diffMs / 86_400_000;

  if (diffDays < 7) return formatRelative(dateStr);
  return formatMedium(dateStr);
}

/* ------------------------------------------------------------------ */
/*  Milestone celebration helpers                                      */
/* ------------------------------------------------------------------ */

const SEEN_MILESTONES_KEY = "proxy_seen_milestones";

function getSeenMilestones(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_MILESTONES_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function markMilestoneSeen(id: string) {
  const seen = getSeenMilestones();
  seen.add(id);
  try {
    localStorage.setItem(SEEN_MILESTONES_KEY, JSON.stringify([...seen]));
  } catch {
    // storage full, ignore
  }
}

function isNewMilestone(entry: TimelineEntry): boolean {
  const created = new Date(entry.created_at).getTime();
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  return entry.is_pinned && created > fiveMinutesAgo;
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

type TimelineViewProps = {
  entries: TimelineEntry[];
  propertyMap: Record<string, string>;
  userId: string;
  initialPropertyFilter?: string;
};

export function TimelineView({
  entries: serverEntries,
  propertyMap,
  userId,
  initialPropertyFilter,
}: TimelineViewProps) {
  const [activeFilter, setActiveFilter] = useState<Category>("all");
  const [localEntries, setLocalEntries] = useState<TimelineEntry[]>(serverEntries);
  const [newEntryIds, setNewEntryIds] = useState<Set<string>>(new Set());
  const [selectedEntry, setSelectedEntry] = useState<TimelineEntry | null>(null);
  const [propertyFilter, setPropertyFilter] = useState<string>(initialPropertyFilter ?? "all");

  // Sync server entries on re-render (e.g. navigation)
  useEffect(() => {
    setLocalEntries(serverEntries);
  }, [serverEntries]);

  // ---- Supabase Realtime subscription ----
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("owner_timeline_realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "owner_timeline",
          filter: `owner_id=eq.${userId}`,
        },
        (payload) => {
          const newEntry = payload.new as TimelineEntry;
          setLocalEntries((prev) => [newEntry, ...prev]);
          setNewEntryIds((prev) => new Set([...prev, newEntry.id]));

          // Remove blue glow after 2 seconds
          setTimeout(() => {
            setNewEntryIds((prev) => {
              const next = new Set(prev);
              next.delete(newEntry.id);
              return next;
            });
          }, 2000);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // ---- Milestone celebration tracking ----
  const [celebratingIds, setCelebratingIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    const seen = getSeenMilestones();
    const toCelebrate = new Set<string>();

    for (const entry of localEntries) {
      if (isNewMilestone(entry) && !seen.has(entry.id)) {
        toCelebrate.add(entry.id);
        markMilestoneSeen(entry.id);
      }
    }

    if (toCelebrate.size > 0) {
      setCelebratingIds(toCelebrate);
    }
  }, [localEntries]);

  // ---- Filtering ----
  const propertyIds = useMemo(() => {
    const ids = new Set<string>();
    for (const e of localEntries) {
      if (e.property_id) ids.add(e.property_id);
    }
    return [...ids];
  }, [localEntries]);

  const hasMultipleProperties = propertyIds.length > 1;

  const filtered = useMemo(() => {
    let result = localEntries;
    if (activeFilter !== "all") {
      result = result.filter((e) => e.category === activeFilter);
    }
    if (propertyFilter !== "all") {
      result = result.filter((e) => e.property_id === propertyFilter);
    }
    return result;
  }, [localEntries, activeFilter, propertyFilter]);

  const pinned = useMemo(() => filtered.filter((e) => e.is_pinned), [filtered]);
  const unpinned = useMemo(
    () => filtered.filter((e) => !e.is_pinned),
    [filtered],
  );

  const dayGroups = useMemo(() => {
    const groups: { key: string; label: string; entries: TimelineEntry[] }[] =
      [];
    const seen = new Map<string, number>();

    for (const entry of unpinned) {
      const key = formatDayKey(entry.created_at);
      const idx = seen.get(key);
      if (idx !== undefined) {
        groups[idx].entries.push(entry);
      } else {
        seen.set(key, groups.length);
        groups.push({
          key,
          label: formatDayLabel(entry.created_at),
          entries: [entry],
        });
      }
    }

    return groups;
  }, [unpinned]);

  const handleEntryClick = useCallback((entry: TimelineEntry) => {
    setSelectedEntry(entry);
  }, []);

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <FilterBar active={activeFilter} onChange={setActiveFilter} />
        {hasMultipleProperties && (
          <PropertyFilterDropdown
            propertyIds={propertyIds}
            propertyMap={propertyMap}
            value={propertyFilter}
            onChange={setPropertyFilter}
          />
        )}
        <EmptyState
          icon={<ClockCounterClockwise size={26} weight="duotone" />}
          title="No activity yet"
          body="Key events and milestones for your account and properties will appear here."
        />
      </div>
    );
  }

  let animIndex = 0;

  return (
    <div className="flex flex-col gap-6">
      <FilterBar active={activeFilter} onChange={setActiveFilter} />

      {hasMultipleProperties && (
        <PropertyFilterDropdown
          propertyIds={propertyIds}
          propertyMap={propertyMap}
          value={propertyFilter}
          onChange={setPropertyFilter}
        />
      )}

      <AnimatePresence>
        {pinned.length > 0 && (
          <section>
            <h2
              className="mb-3 text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              Milestones
            </h2>
            <div className="flex flex-col gap-3">
              {pinned.map((entry) => {
                const i = animIndex++;
                return (
                  <PinnedCard
                    key={entry.id}
                    entry={entry}
                    propertyMap={propertyMap}
                    index={i}
                    isNew={newEntryIds.has(entry.id)}
                    isCelebrating={celebratingIds.has(entry.id)}
                    onClick={handleEntryClick}
                  />
                );
              })}
            </div>
          </section>
        )}
      </AnimatePresence>

      <section className="relative">
        {/* Vertical line */}
        <div
          className="absolute bottom-0 top-0 w-px left-[11px] sm:left-[15px]"
          style={{ backgroundColor: "var(--color-warm-gray-200)" }}
        />

        <div className="flex flex-col gap-0">
          <AnimatePresence>
            {dayGroups.map((group) => (
              <div key={group.key}>
                {/* Sticky day header */}
                <div
                  className="sticky top-0 z-20 mb-2 pt-4 pb-1 ml-8 sm:ml-10"
                  style={{
                    backgroundColor: "rgba(250, 250, 250, 0.85)",
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                  }}
                >
                  <span
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "var(--color-text-tertiary)" }}
                  >
                    {group.label}
                  </span>
                </div>

                {group.entries.map((entry) => {
                  const i = animIndex++;
                  return (
                    <TimelineEntryRow
                      key={entry.id}
                      entry={entry}
                      propertyMap={propertyMap}
                      index={i}
                      isNew={newEntryIds.has(entry.id)}
                      onClick={handleEntryClick}
                    />
                  );
                })}
              </div>
            ))}
          </AnimatePresence>
        </div>
      </section>

      {/* Detail drawer */}
      <TimelineDetailDrawer
        entry={selectedEntry}
        propertyMap={propertyMap}
        onClose={() => setSelectedEntry(null)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Filter bar (mobile horizontal scroll)                              */
/* ------------------------------------------------------------------ */

function FilterBar({
  active,
  onChange,
}: {
  active: Category;
  onChange: (c: Category) => void;
}) {
  return (
    <div
      className="flex gap-2 overflow-x-auto sm:flex-wrap sm:overflow-x-visible"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      <style>{`.filter-scroll::-webkit-scrollbar { display: none; }`}</style>
      <div className="filter-scroll flex gap-2 sm:flex-wrap">
        {FILTER_PILLS.map((pill) => {
          const isActive = pill.key === active;
          const Icon = pill.icon;
          return (
            <button
              key={pill.key}
              type="button"
              onClick={() => onChange(pill.key)}
              className="flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] focus-visible:ring-offset-2"
              style={{
                backgroundColor: isActive
                  ? "var(--color-brand)"
                  : "var(--color-warm-gray-100)",
                color: isActive
                  ? "var(--color-white)"
                  : "var(--color-text-secondary)",
                transition: "background-color 0.15s ease, color 0.15s ease, transform 0.1s ease",
                boxShadow: isActive ? "0 2px 8px rgba(27, 119, 190, 0.25)" : "none",
              }}
              onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.96)"; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
            >
              <Icon size={14} weight="duotone" />
              {pill.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Property filter dropdown                                           */
/* ------------------------------------------------------------------ */

function PropertyFilterDropdown({
  propertyIds,
  propertyMap,
  value,
  onChange,
}: {
  propertyIds: string[];
  propertyMap: Record<string, string>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative inline-flex items-center gap-2">
      <label
        htmlFor="property-filter"
        className="text-xs font-semibold"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        Property
      </label>
      <div className="relative">
        <select
          id="property-filter"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none rounded-lg border py-1.5 pl-3 pr-8 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] focus-visible:ring-offset-2"
          style={{
            backgroundColor: "var(--color-white)",
            borderColor: "var(--color-warm-gray-200)",
            color: "var(--color-text-primary)",
          }}
        >
          <option value="all">All properties</option>
          {propertyIds.map((id) => (
            <option key={id} value={id}>
              {propertyMap[id] ?? id}
            </option>
          ))}
        </select>
        <CaretDown
          size={12}
          weight="duotone"
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
          style={{ color: "var(--color-text-tertiary)" }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Pinned / milestone card                                            */
/* ------------------------------------------------------------------ */

function PinnedCard({
  entry,
  propertyMap,
  index,
  isNew,
  isCelebrating,
  onClick,
}: {
  entry: TimelineEntry;
  propertyMap: Record<string, string>;
  index: number;
  isNew: boolean;
  isCelebrating: boolean;
  onClick: (entry: TimelineEntry) => void;
}) {
  const cfg = getCategoryConfig(entry.category);
  const propLabel = entry.property_id
    ? propertyMap[entry.property_id]
    : undefined;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: isNew ? -16 : 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 30,
        delay: index < 10 ? index * 0.04 : 0,
      }}
      onClick={() => onClick(entry)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(entry); } }}
      className="relative cursor-pointer rounded-2xl border p-3 sm:p-4 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] focus-visible:ring-offset-2"
      style={{
        backgroundColor: "var(--color-white)",
        borderColor: isNew ? "var(--color-brand-light)" : "var(--color-warm-gray-200)",
        borderLeftWidth: 3,
        borderLeftColor: "#f59e0b",
        boxShadow: isNew
          ? "0 0 0 2px rgba(2, 170, 235, 0.3), 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(245,158,11,0.06)"
          : "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(245,158,11,0.06)",
        transition: "border-color 0.3s ease, box-shadow 0.3s ease",
        overflow: "hidden",
      }}
    >
      {/* Golden shimmer for celebrating milestones */}
      {isCelebrating && (
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-[3px]"
          style={{
            background: "linear-gradient(180deg, transparent 0%, #f59e0b 50%, transparent 100%)",
            backgroundSize: "100% 200%",
            animation: "milestone-shimmer 1.5s ease-in-out 1",
          }}
        />
      )}

      <style>{`
        @keyframes milestone-shimmer {
          0% { backgroundPosition: 100% 200%; opacity: 0; }
          20% { opacity: 1; }
          50% { backgroundPosition: 100% 0%; }
          80% { opacity: 1; }
          100% { backgroundPosition: 100% -200%; opacity: 0; }
        }
      `}</style>

      <div
        className="absolute right-3 top-3"
        style={{ color: "#f59e0b" }}
      >
        {isCelebrating ? (
          <motion.div
            animate={{ y: [0, -4, 0, -2, 0] }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
          >
            <PushPin size={14} weight="duotone" />
          </motion.div>
        ) : (
          <PushPin size={14} weight="duotone" />
        )}
      </div>

      <div className="flex items-start gap-3">
        <div
          className="flex shrink-0 items-center justify-center rounded-full h-6 w-6 sm:h-8 sm:w-8"
          style={{ backgroundColor: cfg.bg, color: cfg.color }}
        >
          <cfg.icon size={16} weight="duotone" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span
              className="text-sm font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              {entry.title}
            </span>
            <span
              className="shrink-0 text-xs"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              {formatEntryTime(entry.created_at)}
            </span>
          </div>

          {entry.body && (
            <p
              className="mt-1 text-sm leading-relaxed line-clamp-2"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {entry.body}
            </p>
          )}

          {propLabel && (
            <div className="mt-2">
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                style={{
                  backgroundColor: "rgba(27, 119, 190, 0.10)",
                  color: "var(--color-brand)",
                }}
              >
                {propLabel}
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Timeline entry row                                                 */
/* ------------------------------------------------------------------ */

function TimelineEntryRow({
  entry,
  propertyMap,
  index,
  isNew,
  onClick,
}: {
  entry: TimelineEntry;
  propertyMap: Record<string, string>;
  index: number;
  isNew: boolean;
  onClick: (entry: TimelineEntry) => void;
}) {
  const cfg = getCategoryConfig(entry.category);
  const propLabel = entry.property_id
    ? propertyMap[entry.property_id]
    : undefined;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: isNew ? -16 : 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 30,
        delay: index < 10 ? index * 0.04 : 0,
      }}
      className="relative flex gap-3 pb-4 sm:gap-4"
    >
      {/* Icon dot */}
      <div
        className="relative z-10 flex shrink-0 items-center justify-center rounded-full h-6 w-6 sm:h-8 sm:w-8"
        style={{ backgroundColor: cfg.bg, color: cfg.color }}
      >
        <cfg.icon size={16} weight="duotone" />
      </div>

      {/* Content card */}
      <div
        onClick={() => onClick(entry)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(entry); } }}
        className="min-w-0 flex-1 cursor-pointer rounded-2xl border p-3 sm:p-4 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] focus-visible:ring-offset-2"
        style={{
          backgroundColor: "var(--color-white)",
          borderColor: isNew ? "var(--color-brand-light)" : "var(--color-warm-gray-200)",
          boxShadow: isNew
            ? "0 0 0 2px rgba(2, 170, 235, 0.3), var(--shadow-card)"
            : "var(--shadow-card)",
          transition: "box-shadow 0.2s ease, border-color 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = "var(--shadow-md)";
          if (!isNew) e.currentTarget.style.borderColor = "var(--color-warm-gray-400)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = isNew
            ? "0 0 0 2px rgba(2, 170, 235, 0.3), var(--shadow-card)"
            : "var(--shadow-card)";
          if (!isNew) e.currentTarget.style.borderColor = "var(--color-warm-gray-200)";
        }}
      >
        <div className="flex items-baseline justify-between gap-2">
          <span
            className="text-sm font-semibold"
            style={{ color: "var(--color-text-primary)" }}
          >
            {entry.title}
          </span>
          <span
            className="shrink-0 text-xs"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {formatEntryTime(entry.created_at)}
          </span>
        </div>

        {entry.body && (
          <p
            className="mt-1 text-sm leading-relaxed line-clamp-2"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {entry.body}
          </p>
        )}

        {propLabel && (
          <div className="mt-2">
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{
                backgroundColor: "rgba(27, 119, 190, 0.10)",
                color: "var(--color-brand)",
              }}
            >
              {propLabel}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Detail drawer                                                      */
/* ------------------------------------------------------------------ */

function TimelineDetailDrawer({
  entry,
  propertyMap,
  onClose,
}: {
  entry: TimelineEntry | null;
  propertyMap: Record<string, string>;
  onClose: () => void;
}) {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!entry) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [entry, onClose]);

  // Close on click outside
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose],
  );

  const cfg = entry ? getCategoryConfig(entry.category) : DEFAULT_CONFIG;
  const Icon = cfg.icon;
  const propLabel = entry?.property_id
    ? propertyMap[entry.property_id]
    : undefined;

  return (
    <AnimatePresence>
      {entry && (
        <motion.div
          key="drawer-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex justify-end"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.30)" }}
          onClick={handleBackdropClick}
        >
          <motion.div
            ref={drawerRef}
            key="drawer-panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="relative flex h-full w-full max-w-md flex-col overflow-y-auto"
            style={{ backgroundColor: "var(--color-white)" }}
          >
            {/* Header */}
            <div
              className="sticky top-0 z-10 flex items-center justify-between border-b px-5 py-4"
              style={{
                backgroundColor: "var(--color-white)",
                borderColor: "var(--color-warm-gray-200)",
              }}
            >
              <h2
                className="text-sm font-semibold"
                style={{ color: "var(--color-text-primary)" }}
              >
                Event Details
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] focus-visible:ring-offset-2"
                style={{
                  backgroundColor: "var(--color-warm-gray-100)",
                  color: "var(--color-text-secondary)",
                  transition: "background-color 0.15s ease",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-warm-gray-200)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--color-warm-gray-100)"; }}
              >
                <X size={16} weight="bold" />
              </button>
            </div>

            {/* Body */}
            <div className="flex flex-col gap-5 px-5 py-5">
              {/* Category + pin badges */}
              <div className="flex items-center gap-2">
                <span
                  className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={{ backgroundColor: cfg.bg, color: cfg.color }}
                >
                  <Icon size={12} weight="duotone" />
                  {entry.category.charAt(0).toUpperCase() + entry.category.slice(1)}
                </span>
                {entry.is_pinned && (
                  <span
                    className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
                    style={{
                      backgroundColor: "rgba(245, 158, 11, 0.12)",
                      color: "#f59e0b",
                    }}
                  >
                    <PushPin size={10} weight="duotone" />
                    Milestone
                  </span>
                )}
              </div>

              {/* Title */}
              <h3
                className="text-base font-semibold leading-snug"
                style={{ color: "var(--color-text-primary)" }}
              >
                {entry.title}
              </h3>

              {/* Body (full, no truncation) */}
              {entry.body && (
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {entry.body}
                </p>
              )}

              {/* Timestamp */}
              <div className="flex flex-col gap-1">
                <span
                  className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  Date
                </span>
                <span
                  className="text-sm"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {formatLong(entry.created_at)}
                </span>
              </div>

              {/* Property chip */}
              {propLabel && (
                <div className="flex flex-col gap-1">
                  <span
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "var(--color-text-tertiary)" }}
                  >
                    Property
                  </span>
                  <span
                    className="inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold"
                    style={{
                      backgroundColor: "rgba(27, 119, 190, 0.10)",
                      color: "var(--color-brand)",
                    }}
                  >
                    {propLabel}
                  </span>
                </div>
              )}

              {/* Event type */}
              <div className="flex flex-col gap-1">
                <span
                  className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  Event Type
                </span>
                <span
                  className="text-sm"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {entry.event_type}
                </span>
              </div>

              {/* Metadata fields */}
              {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                <div className="flex flex-col gap-3">
                  <span
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "var(--color-text-tertiary)" }}
                  >
                    Details
                  </span>
                  <div
                    className="flex flex-col gap-2 rounded-xl border p-3"
                    style={{
                      backgroundColor: "var(--color-off-white)",
                      borderColor: "var(--color-warm-gray-200)",
                    }}
                  >
                    {Object.entries(entry.metadata).map(([key, val]) => (
                      <div key={key} className="flex items-baseline justify-between gap-3">
                        <span
                          className="text-xs font-medium"
                          style={{ color: "var(--color-text-tertiary)" }}
                        >
                          {key.replace(/_/g, " ")}
                        </span>
                        <span
                          className="text-right text-xs font-medium"
                          style={{ color: "var(--color-text-primary)" }}
                        >
                          {String(val)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
