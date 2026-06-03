"use client";

import { useState, useTransition, useRef, useCallback, useMemo } from "react";
import {
  MagnifyingGlass,
  PushPin,
  Plus,
  X,
  Export,
  CheckSquare,
  Square,
  Lightning,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { CustomSelect } from "@/components/admin/CustomSelect";
import { formatMedium, formatRelativeShort } from "@/lib/format";
import {
  toggleTimelineVisibility,
  toggleTimelinePin,
  softDeleteTimelineEntry,
  createTimelineEntry,
} from "./actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TimelineEntry = {
  id: string;
  owner_id: string;
  event_type: string;
  category: string;
  title: string;
  body: string | null;
  property_id: string | null;
  icon: string | null;
  visibility: string;
  is_pinned: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
};

type Props = {
  entries: TimelineEntry[];
  profileMap: Record<string, Profile>;
  propertyMap: Record<string, string>;
  propertiesByOwner: Record<string, { id: string; label: string }[]>;
  profiles: Profile[];
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "account", label: "Account" },
  { value: "property", label: "Property" },
  { value: "financial", label: "Financial" },
  { value: "calendar", label: "Calendar" },
  { value: "document", label: "Document" },
  { value: "communication", label: "Communication" },
] as const;

const VISIBILITY_FILTERS = [
  { value: "all", label: "All" },
  { value: "owner", label: "Owner Visible" },
  { value: "admin_only", label: "Admin Only" },
] as const;

const FORM_CATEGORY_OPTIONS = CATEGORIES.filter((category) => category.value !== "all");
const FORM_VISIBILITY_OPTIONS = VISIBILITY_FILTERS.filter((filter) => filter.value !== "all");

const TEMPLATES = [
  { label: "Welcome", eventType: "welcome", category: "account", title: "Welcome to Proxy", isPinned: true, visibility: "owner" },
  { label: "Onboarding Complete", eventType: "onboarding_complete", category: "account", title: "Onboarding complete", isPinned: true, visibility: "owner" },
  { label: "First Booking", eventType: "booking_created", category: "calendar", title: "First booking received", isPinned: true, visibility: "owner" },
  { label: "First Payout", eventType: "payout_issued", category: "financial", title: "First payout sent", isPinned: true, visibility: "owner" },
  { label: "Property Live", eventType: "property_updated", category: "property", title: "Property went live on Airbnb", isPinned: true, visibility: "owner" },
  { label: "Agreement Signed", eventType: "agreement_signed", category: "document", title: "Management agreement signed", isPinned: true, visibility: "owner" },
] as const;

type TemplatePrefill = {
  eventType: string;
  category: string;
  title: string;
  isPinned: boolean;
  visibility: string;
};

// ---------------------------------------------------------------------------
// Category icon mapping (duotone, matches portal)
// ---------------------------------------------------------------------------


function getCategoryDotColor(category: string): string {
  switch (category) {
    case "account": return "var(--color-brand)";
    case "property": return "#15803d";
    case "financial": return "#15803d";
    case "calendar": return "#b45309";
    case "document": return "var(--color-text-secondary)";
    case "communication": return "var(--color-brand)";
    default: return "var(--color-text-tertiary)";
  }
}

// ---------------------------------------------------------------------------
// Avatar helper
// ---------------------------------------------------------------------------

function OwnerAvatar({
  profile,
  size = 32,
}: {
  profile: Profile | undefined;
  size?: number;
}) {
  const initials = buildInitials(profile?.full_name || profile?.email || "?");

  if (profile?.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={profile.avatar_url}
        alt=""
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className="inline-flex items-center justify-center rounded-full text-xs font-semibold"
      style={{
        width: size,
        height: size,
        backgroundColor: "var(--color-warm-gray-100)",
        color: "var(--color-text-secondary)",
      }}
    >
      {initials}
    </span>
  );
}

function buildInitials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ---------------------------------------------------------------------------
// Relative time with absolute fallback after 7 days
// ---------------------------------------------------------------------------

function timeLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  if (diffMs < sevenDays) return formatRelativeShort(dateStr);
  return formatMedium(dateStr);
}

// ---------------------------------------------------------------------------
// CSV export helper
// ---------------------------------------------------------------------------

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function exportTimelineCsv(
  entries: TimelineEntry[],
  profileMap: Record<string, Profile>,
  propertyMap: Record<string, string>,
) {
  const headers = ["Date", "Owner", "Email", "Category", "Title", "Body", "Property", "Visibility", "Pinned", "Status"];
  const rows = entries.map((e) => {
    const owner = profileMap[e.owner_id];
    return [
      new Date(e.created_at).toISOString(),
      owner?.full_name || "Unknown",
      owner?.email || "",
      e.category,
      e.title,
      e.body || "",
      e.property_id ? propertyMap[e.property_id] || "" : "",
      e.visibility,
      e.is_pinned ? "Yes" : "No",
      e.deleted_at ? "deleted" : "active",
    ].map(escapeCsvField);
  });

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const today = new Date().toISOString().split("T")[0];
  link.href = url;
  link.download = `proxy-timeline-export-${today}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AdminTimelineView({
  entries,
  profileMap,
  propertyMap,
  propertiesByOwner,
  profiles,
}: Props) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [templatePrefill, setTemplatePrefill] = useState<TemplatePrefill | null>(null);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkPending, startBulkTransition] = useTransition();

  const lowerSearch = search.toLowerCase();

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (!showDeleted && e.deleted_at) return false;
      if (categoryFilter !== "all" && e.category !== categoryFilter) return false;
      if (visibilityFilter !== "all" && e.visibility !== visibilityFilter) return false;
      if (ownerFilter !== "all" && e.owner_id !== ownerFilter) return false;

      // Date range filter
      if (dateFrom) {
        const entryDate = new Date(e.created_at);
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (entryDate < fromDate) return false;
      }
      if (dateTo) {
        const entryDate = new Date(e.created_at);
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (entryDate > toDate) return false;
      }

      if (lowerSearch) {
        const matchTitle = e.title.toLowerCase().includes(lowerSearch);
        const matchBody = e.body?.toLowerCase().includes(lowerSearch);
        const ownerProfile = profileMap[e.owner_id];
        const matchOwner =
          ownerProfile?.full_name?.toLowerCase().includes(lowerSearch) ||
          ownerProfile?.email?.toLowerCase().includes(lowerSearch);
        if (!matchTitle && !matchBody && !matchOwner) return false;
      }
      return true;
    });
  }, [entries, showDeleted, categoryFilter, visibilityFilter, ownerFilter, dateFrom, dateTo, lowerSearch, profileMap]);

  const activeEntries = filtered.filter((e) => !e.deleted_at);
  const deletedEntries = filtered.filter((e) => e.deleted_at);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === activeEntries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(activeEntries.map((e) => e.id)));
    }
  }, [activeEntries, selectedIds.size]);

  const handleBulkAction = useCallback(
    (action: "pin" | "unpin" | "visible" | "admin_only" | "delete") => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0) return;

      startBulkTransition(async () => {
        switch (action) {
          case "pin":
            await Promise.all(
              ids.map((id) => {
                const entry = entries.find((e) => e.id === id);
                if (entry && !entry.is_pinned) return toggleTimelinePin(id);
                return Promise.resolve();
              }),
            );
            break;
          case "unpin":
            await Promise.all(
              ids.map((id) => {
                const entry = entries.find((e) => e.id === id);
                if (entry && entry.is_pinned) return toggleTimelinePin(id);
                return Promise.resolve();
              }),
            );
            break;
          case "visible":
            await Promise.all(
              ids.map((id) => {
                const entry = entries.find((e) => e.id === id);
                if (entry && entry.visibility !== "owner") return toggleTimelineVisibility(id);
                return Promise.resolve();
              }),
            );
            break;
          case "admin_only":
            await Promise.all(
              ids.map((id) => {
                const entry = entries.find((e) => e.id === id);
                if (entry && entry.visibility !== "admin_only") return toggleTimelineVisibility(id);
                return Promise.resolve();
              }),
            );
            break;
          case "delete":
            await Promise.all(ids.map((id) => softDeleteTimelineEntry(id)));
            break;
        }
        setSelectedIds(new Set());
      });
    },
    [selectedIds, entries],
  );

  const handleTemplateClick = useCallback((template: typeof TEMPLATES[number]) => {
    setTemplatePrefill({
      eventType: template.eventType,
      category: template.category,
      title: template.title,
      isPinned: template.isPinned,
      visibility: template.visibility,
    });
    if (!showAddForm) {
      setShowAddForm(true);
    }
  }, [showAddForm]);

  return (
    <div className="flex flex-col gap-6">
      {/* Controls bar */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1" style={{ minWidth: 220 }}>
            <MagnifyingGlass
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: "var(--color-text-tertiary)" }}
            />
            <input
              type="text"
              placeholder="Search entries..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] focus-visible:ring-offset-1"
              style={{
                borderColor: "var(--color-warm-gray-200)",
                backgroundColor: "var(--color-white)",
                color: "var(--color-text-primary)",
                transition: "border-color 0.15s ease, box-shadow 0.15s ease",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-brand)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-warm-gray-200)"; }}
            />
          </div>

          {/* Owner filter */}
          <CustomSelect
            value={ownerFilter}
            onChange={setOwnerFilter}
            options={[
              { value: "all", label: "All owners" },
              ...profiles.map((profile) => ({
                value: profile.id,
                label: profile.full_name || profile.email,
              })),
            ]}
          />

          {/* Export button */}
          <button
            onClick={() => exportTimelineCsv(filtered, profileMap, propertyMap)}
            className="flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] focus-visible:ring-offset-2"
            style={{
              borderColor: "var(--color-warm-gray-200)",
              backgroundColor: "var(--color-white)",
              color: "var(--color-text-secondary)",
              transition: "border-color 0.15s ease, opacity 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--color-brand)";
              e.currentTarget.style.color = "var(--color-brand)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--color-warm-gray-200)";
              e.currentTarget.style.color = "var(--color-text-secondary)";
            }}
          >
            <Export size={14} weight="bold" />
            Export
          </button>

          {/* Add entry button */}
          <button
            onClick={() => {
              setShowAddForm(!showAddForm);
              if (showAddForm) setTemplatePrefill(null);
            }}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] focus-visible:ring-offset-2"
            style={{
              background: "var(--color-brand-gradient)",
              boxShadow: "0 2px 8px rgba(27, 119, 190, 0.25)",
              transition: "opacity 0.15s ease, transform 0.1s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.9"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
            onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.97)"; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
          >
            {showAddForm ? <X size={14} weight="bold" /> : <Plus size={14} weight="bold" />}
            {showAddForm ? "Close" : "Add entry"}
          </button>
        </div>

        {/* Date range row */}
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="text-xs font-medium"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Date range
          </span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] focus-visible:ring-offset-1"
            style={{
              borderColor: "var(--color-warm-gray-200)",
              backgroundColor: "var(--color-white)",
              color: "var(--color-text-primary)",
              transition: "border-color 0.15s ease, box-shadow 0.15s ease",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-brand)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-warm-gray-200)"; }}
            placeholder="From"
          />
          <span
            className="text-xs"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            to
          </span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] focus-visible:ring-offset-1"
            style={{
              borderColor: "var(--color-warm-gray-200)",
              backgroundColor: "var(--color-white)",
              color: "var(--color-text-primary)",
              transition: "border-color 0.15s ease, box-shadow 0.15s ease",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-brand)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-warm-gray-200)"; }}
            placeholder="To"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(""); setDateTo(""); }}
              className="rounded-lg px-2 py-1 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] focus-visible:ring-offset-1"
              style={{ color: "var(--color-text-tertiary)" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-brand)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-text-tertiary)"; }}
            >
              Clear dates
            </button>
          )}
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Category pills */}
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => {
              const isActive = categoryFilter === cat.value;
              return (
                <button
                  key={cat.value}
                  onClick={() => setCategoryFilter(cat.value)}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] focus-visible:ring-offset-1"
                  style={{
                    backgroundColor: isActive
                      ? "var(--color-brand)"
                      : "var(--color-warm-gray-100)",
                    color: isActive ? "var(--color-white)" : "var(--color-text-secondary)",
                  }}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div
            className="hidden h-5 w-px sm:block"
            style={{ backgroundColor: "var(--color-warm-gray-200)" }}
          />

          {/* Visibility filter */}
          <div className="flex gap-1.5">
            {VISIBILITY_FILTERS.map((vis) => {
              const isActive = visibilityFilter === vis.value;
              return (
                <button
                  key={vis.value}
                  onClick={() => setVisibilityFilter(vis.value)}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] focus-visible:ring-offset-1"
                  style={{
                    backgroundColor: isActive
                      ? "var(--color-brand)"
                      : "var(--color-warm-gray-100)",
                    color: isActive ? "var(--color-white)" : "var(--color-text-secondary)",
                  }}
                >
                  {vis.label}
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div
            className="hidden h-5 w-px sm:block"
            style={{ backgroundColor: "var(--color-warm-gray-200)" }}
          />

          {/* Show deleted toggle */}
          <label
            className="flex cursor-pointer items-center gap-2 text-xs font-medium"
            style={{ color: "var(--color-text-secondary)" }}
          >
            <input
              type="checkbox"
              checked={showDeleted}
              onChange={(e) => setShowDeleted(e.target.checked)}
              className="accent-[var(--color-brand)]"
            />
            Show deleted
          </label>
        </div>
      </div>

      {/* Template chips + Add entry form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: "hidden" }}
          >
            {/* Template chips */}
            <div className="mb-3">
              <div
                className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                Quick templates
              </div>
              <div className="flex flex-wrap gap-2">
                {TEMPLATES.map((template) => (
                  <button
                    key={template.label}
                    onClick={() => handleTemplateClick(template)}
                    className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] focus-visible:ring-offset-1"
                    style={{
                      borderColor: "var(--color-warm-gray-200)",
                      backgroundColor: "var(--color-white)",
                      color: "var(--color-text-secondary)",
                      transition: "border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--color-brand)";
                      e.currentTarget.style.backgroundColor = "rgba(27, 119, 190, 0.06)";
                      e.currentTarget.style.color = "var(--color-brand)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--color-warm-gray-200)";
                      e.currentTarget.style.backgroundColor = "var(--color-white)";
                      e.currentTarget.style.color = "var(--color-text-secondary)";
                    }}
                  >
                    <Lightning size={12} weight="fill" />
                    {template.label}
                  </button>
                ))}
              </div>
            </div>

            <AddEntryForm
              profiles={profiles}
              propertiesByOwner={propertiesByOwner}
              onDone={() => {
                setShowAddForm(false);
                setTemplatePrefill(null);
              }}
              prefill={templatePrefill}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Select all + count */}
      {activeEntries.length > 0 && (
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {selectedIds.size === activeEntries.length && activeEntries.length > 0 ? (
              <CheckSquare size={14} weight="fill" style={{ color: "var(--color-brand)" }} />
            ) : (
              <Square size={14} />
            )}
            {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select all"}
          </button>
          <span className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
            {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
          </span>
        </div>
      )}

      {/* Timeline feed */}
      {activeEntries.length === 0 && deletedEntries.length === 0 ? (
        <div
          className="rounded-xl border px-6 py-12 text-center text-sm"
          style={{
            borderColor: "var(--color-warm-gray-200)",
            color: "var(--color-text-tertiary)",
          }}
        >
          No timeline entries match your filters.
        </div>
      ) : (
        <>
        <div className="relative">
          {/* Vertical timeline line */}
          <div
            className="absolute bottom-0 left-[19px] top-0 w-px"
            style={{ backgroundColor: "var(--color-warm-gray-200)" }}
          />

          {activeEntries.map((entry) => (
            <TimelineRow
              key={entry.id}
              entry={entry}
              profileMap={profileMap}
              propertyMap={propertyMap}
              isPending={isPending}
              confirmDeleteId={confirmDeleteId}
              onConfirmDelete={setConfirmDeleteId}
              onToggleVisibility={(id) => {
                startTransition(async () => {
                  void (await toggleTimelineVisibility(id));
                });
              }}
              onTogglePin={(id) => {
                startTransition(async () => {
                  void (await toggleTimelinePin(id));
                });
              }}
              onDelete={(id) => {
                startTransition(async () => {
                  void (await softDeleteTimelineEntry(id));
                  setConfirmDeleteId(null);
                });
              }}
              isSelected={selectedIds.has(entry.id)}
              onToggleSelect={toggleSelection}
            />
          ))}

        </div>

        {/* Deleted entries section */}
        {showDeleted && deletedEntries.length > 0 && (
          <div className="mt-6">
            <div
              className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              Deleted entries
            </div>
            <div
              className="overflow-hidden rounded-xl border"
              style={{ borderColor: "rgba(220, 38, 38, 0.15)" }}
            >
              {deletedEntries.map((entry) => (
                <TimelineRow
                  key={entry.id}
                  entry={entry}
                  profileMap={profileMap}
                  propertyMap={propertyMap}
                  isPending={isPending}
                  confirmDeleteId={confirmDeleteId}
                  onConfirmDelete={setConfirmDeleteId}
                  onToggleVisibility={() => {}}
                  onTogglePin={() => {}}
                  onDelete={() => {}}
                  isDeleted
                  isSelected={false}
                  onToggleSelect={() => {}}
                />
              ))}
            </div>
          </div>
        )}
        </>
      )}

      {/* Bulk actions bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed bottom-6 left-1/2 z-[900] flex -translate-x-1/2 items-center gap-3 rounded-2xl border px-5 py-3 shadow-xl"
            style={{
              backgroundColor: "var(--color-navy)",
              borderColor: "var(--color-charcoal)",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2)",
            }}
          >
            <span className="text-sm font-semibold text-white">
              {selectedIds.size} {selectedIds.size === 1 ? "entry" : "entries"} selected
            </span>

            <div
              className="h-5 w-px"
              style={{ backgroundColor: "var(--color-charcoal)" }}
            />

            <BulkActionButton
              label="Pin"
              onClick={() => handleBulkAction("pin")}
              disabled={isBulkPending}
            />
            <BulkActionButton
              label="Unpin"
              onClick={() => handleBulkAction("unpin")}
              disabled={isBulkPending}
            />
            <BulkActionButton
              label="Make visible"
              onClick={() => handleBulkAction("visible")}
              disabled={isBulkPending}
            />
            <BulkActionButton
              label="Admin only"
              onClick={() => handleBulkAction("admin_only")}
              disabled={isBulkPending}
            />
            <BulkActionButton
              label="Delete"
              onClick={() => handleBulkAction("delete")}
              disabled={isBulkPending}
              destructive
            />

            <div
              className="h-5 w-px"
              style={{ backgroundColor: "var(--color-charcoal)" }}
            />

            <button
              onClick={clearSelection}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-white/60 outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-navy)]"
              style={{ transition: "color 0.15s ease" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "white"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
            >
              <X size={12} weight="bold" />
              Clear
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bulk action button
// ---------------------------------------------------------------------------

function BulkActionButton({
  label,
  onClick,
  disabled,
  destructive = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg px-3 py-1.5 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-navy)] disabled:opacity-50"
      style={{
        backgroundColor: destructive ? "rgba(220, 38, 38, 0.2)" : "var(--color-charcoal)",
        color: destructive ? "rgb(248, 113, 113)" : "white",
        transition: "background-color 0.15s ease, opacity 0.15s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = destructive
          ? "rgba(220, 38, 38, 0.35)"
          : "rgba(255, 255, 255, 0.15)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = destructive
          ? "rgba(220, 38, 38, 0.2)"
          : "var(--color-charcoal)";
      }}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Timeline row
// ---------------------------------------------------------------------------

function TimelineRow({
  entry,
  profileMap,
  propertyMap,
  isPending,
  confirmDeleteId,
  onConfirmDelete,
  onToggleVisibility,
  onTogglePin,
  onDelete,
  isDeleted = false,
  isSelected,
  onToggleSelect,
}: {
  entry: TimelineEntry;
  profileMap: Record<string, Profile>;
  propertyMap: Record<string, string>;
  isPending: boolean;
  confirmDeleteId: string | null;
  onConfirmDelete: (id: string | null) => void;
  onToggleVisibility: (id: string) => void;
  onTogglePin: (id: string) => void;
  onDelete: (id: string) => void;
  isDeleted?: boolean;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
}) {
  const owner = profileMap[entry.owner_id];
  const propertyName = entry.property_id ? propertyMap[entry.property_id] : null;
  const isConfirming = confirmDeleteId === entry.id;

  const ownerName = owner?.full_name || owner?.email?.split("@")[0] || "Unknown";
  const streetAddress = propertyName?.split(",")[0] ?? null;

  return (
    <div className="relative flex gap-3 pb-1 pl-10">
      {/* Category dot on the timeline line */}
      <div
        className="absolute left-[15px] top-3 z-10 h-[10px] w-[10px] rounded-full border-2"
        style={{
          borderColor: getCategoryDotColor(entry.category),
          backgroundColor: isSelected ? getCategoryDotColor(entry.category) : "var(--color-white)",
        }}
      />

      {/* Card */}
      <div
        className="group flex min-w-0 flex-1 items-center gap-3 rounded-xl border px-3 py-2"
        style={{
          backgroundColor: isSelected
            ? "rgba(27, 119, 190, 0.04)"
            : isDeleted
              ? "rgba(220, 38, 38, 0.02)"
              : "var(--color-white)",
          borderColor: isSelected
            ? "var(--color-brand)"
            : isDeleted
              ? "rgba(220, 38, 38, 0.15)"
              : "var(--color-warm-gray-200)",
          opacity: isDeleted ? 0.6 : 1,
          boxShadow: "var(--shadow-sm)",
          transition: "border-color 0.15s ease, background-color 0.15s ease",
        }}
      >
        {/* Checkbox */}
        {!isDeleted && (
          <button
            onClick={() => onToggleSelect(entry.id)}
            className="shrink-0 rounded outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]"
            aria-label={isSelected ? "Deselect" : "Select"}
          >
            {isSelected ? (
              <CheckSquare size={15} weight="fill" style={{ color: "var(--color-brand)" }} />
            ) : (
              <Square size={15} style={{ color: "var(--color-warm-gray-400)" }} />
            )}
          </button>
        )}

        {/* Avatar */}
        <OwnerAvatar profile={owner} size={24} />

        {/* Person name */}
        <span
          className="w-[100px] shrink-0 truncate text-xs font-semibold"
          style={{ color: "var(--color-text-primary)" }}
        >
          {ownerName}
        </span>

        {/* Event title */}
        <span
          className={`min-w-0 flex-1 truncate text-sm ${isDeleted ? "line-through" : ""}`}
          style={{ color: "var(--color-text-primary)" }}
        >
          {entry.title}
        </span>

        {/* Property (street only) */}
        {streetAddress && (
          <span
            className="hidden w-[110px] shrink-0 truncate text-xs lg:block"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {streetAddress}
          </span>
        )}

        {/* Visibility label */}
        <span
          className="hidden w-[80px] shrink-0 text-xs font-medium sm:block"
          style={{ color: entry.visibility === "owner" ? "#15803d" : "#b45309" }}
        >
          {entry.visibility === "owner" ? "Owner" : "Admin only"}
        </span>

        {/* Pinned */}
        {entry.is_pinned && (
          <PushPin size={12} weight="fill" className="shrink-0" style={{ color: "#f59e0b" }} />
        )}

        {/* When */}
        <span
          className="hidden w-[70px] shrink-0 text-right text-xs md:block"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          {timeLabel(entry.created_at)}
        </span>

        {/* Actions (always visible) */}
        {!isDeleted ? (
          <div className="flex shrink-0 items-center gap-0.5 pl-2">
            <button
              onClick={() => onToggleVisibility(entry.id)}
              disabled={isPending}
              className="rounded px-1.5 py-0.5 text-[11px] font-medium outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-brand)] disabled:opacity-50"
              style={{
                color: entry.visibility === "owner" ? "#b45309" : "#15803d",
                transition: "background-color 0.1s ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-warm-gray-100)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              {entry.visibility === "owner" ? "Hide" : "Show"}
            </button>
            <button
              onClick={() => onTogglePin(entry.id)}
              disabled={isPending}
              className="rounded px-1.5 py-0.5 text-[11px] font-medium outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-brand)] disabled:opacity-50"
              style={{
                color: entry.is_pinned ? "#f59e0b" : "var(--color-text-tertiary)",
                transition: "background-color 0.1s ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-warm-gray-100)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              {entry.is_pinned ? "Unpin" : "Pin"}
            </button>
            {isConfirming ? (
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => onDelete(entry.id)}
                  disabled={isPending}
                  className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: "#dc2626" }}
                >
                  Yes
                </button>
                <button
                  onClick={() => onConfirmDelete(null)}
                  className="rounded px-1.5 py-0.5 text-[11px] font-medium"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => onConfirmDelete(entry.id)}
                disabled={isPending}
                className="rounded px-1.5 py-0.5 text-[11px] font-medium outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-brand)] disabled:opacity-50"
                style={{ color: "var(--color-error)", transition: "background-color 0.1s ease" }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(220,38,38,0.06)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                Delete
              </button>
            )}
          </div>
        ) : (
          <span
            className="text-[10px] font-medium"
            style={{ color: "#dc2626" }}
          >
            Deleted
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add entry form
// ---------------------------------------------------------------------------

function AddEntryForm({
  profiles,
  propertiesByOwner,
  onDone,
  prefill,
}: {
  profiles: Profile[];
  propertiesByOwner: Record<string, { id: string; label: string }[]>;
  onDone: () => void;
  prefill: TemplatePrefill | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  // Track prefill values in state so template clicks update the form
  const [eventType, setEventType] = useState(prefill?.eventType ?? "note");
  const [title, setTitle] = useState(prefill?.title ?? "");
  const [category, setCategory] = useState(prefill?.category ?? "account");
  const [visibility, setVisibility] = useState(prefill?.visibility ?? "owner");

  // Respond to new prefill selections
  const lastPrefillRef = useRef(prefill);
  // eslint-disable-next-line react-hooks/refs
  if (prefill !== lastPrefillRef.current) {
    // eslint-disable-next-line react-hooks/refs
    lastPrefillRef.current = prefill;
    if (prefill) {
      setEventType(prefill.eventType);
      setTitle(prefill.title);
      setCategory(prefill.category);
      setVisibility(prefill.visibility);
    }
  }

  const ownerProperties = selectedOwnerId
    ? propertiesByOwner[selectedOwnerId] ?? []
    : [];

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createTimelineEntry(formData);
      if (result.ok) {
        formRef.current?.reset();
        setSelectedOwnerId("");
        setEventType("note");
        setTitle("");
        setCategory("account");
        setVisibility("owner");
        onDone();
      }
    });
  }

  const inputStyle = {
    borderColor: "var(--color-warm-gray-200)",
    backgroundColor: "var(--color-white)",
    color: "var(--color-text-primary)",
  };

  return (
    <div
      className="rounded-xl border p-5"
      style={{
        borderColor: "var(--color-warm-gray-200)",
        backgroundColor: "var(--color-white)",
      }}
    >
      <div
        className="mb-4 text-[10px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        New Timeline Entry
      </div>
      <form ref={formRef} action={handleSubmit}>
        <div className="flex flex-col gap-3">
          {/* Row 1: Owner + Category */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CustomSelect
              name="owner_id"
              required
              value={selectedOwnerId}
              onChange={setSelectedOwnerId}
              placeholder="Select owner..."
              options={profiles
                .filter((profile) => profile.id)
                .map((profile) => ({
                  value: profile.id,
                  label: profile.full_name || profile.email,
                }))}
            />

            <CustomSelect
              name="category"
              value={category}
              onChange={setCategory}
              options={[...FORM_CATEGORY_OPTIONS]}
            />
          </div>

          {/* Row 2: Event type + Title */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              name="event_type"
              type="text"
              placeholder="Event type (e.g. note, email)"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm outline-none"
              style={inputStyle}
            />
            <input
              name="title"
              type="text"
              placeholder="Title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm outline-none"
              style={inputStyle}
            />
          </div>

          {/* Row 3: Body */}
          <textarea
            name="body"
            placeholder="Body (optional)"
            rows={2}
            className="w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none"
            style={inputStyle}
          />

          {/* Row 4: Property + Visibility + Icon */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <CustomSelect
              name="property_id"
              defaultValue=""
              options={[
                { value: "", label: "No property" },
                ...ownerProperties.map((property) => ({
                  value: property.id,
                  label: property.label,
                })),
              ]}
            />

            <CustomSelect
              name="visibility"
              value={visibility}
              onChange={setVisibility}
              options={[...FORM_VISIBILITY_OPTIONS]}
            />

            <input
              name="icon"
              type="text"
              placeholder="Icon name (optional)"
              className="rounded-lg border px-3 py-2 text-sm outline-none"
              style={inputStyle}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity duration-150 disabled:opacity-50"
              style={{ backgroundColor: "var(--color-brand)" }}
            >
              {isPending ? "Creating..." : "Create entry"}
            </button>
            <button
              type="button"
              onClick={onDone}
              className="rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-150"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared small components
// ---------------------------------------------------------------------------
