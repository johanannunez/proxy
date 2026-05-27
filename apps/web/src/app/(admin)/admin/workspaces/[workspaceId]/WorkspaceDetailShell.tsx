"use client";

import { useState, Suspense, useTransition, useRef, useEffect, useCallback, type MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import {
  CopySimple,
  CaretLeft,
  CaretRight,
  IdentificationCard,
  X as XIcon,
} from "@phosphor-icons/react";
import {
  startOfMonth,
  getDaysInMonth,
  getDay,
  addMonths,
  subMonths,
  format as formatDate,
} from "date-fns";
import type { WorkspaceContactDetail, WorkspaceInfo, WorkspaceMember } from "@/lib/admin/workspace-contact-detail";
import type { NextMeeting } from "@/lib/admin/workspace-meetings";
import type { AdminProfile } from "./workspace-person-actions";
import { updateWorkspaceContactFields } from "./workspace-person-actions";
import { useSetTopBarSlots } from "@/components/admin/chrome/TopBarSlotsContext";
import { StagePopover } from "./StagePopover";
import { WorkspaceDetailSidebar } from "./WorkspaceDetailSidebar";
import { WorkspaceNameContext } from "./WorkspaceNameContext";
import styles from "./WorkspaceDetailShell.module.css";

const SHELL_LOADED_AT_MS = Date.now();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabKey =
  | "overview"
  | "team"
  | "messaging"
  | "properties"
  | "projects"
  | "tasks"
  | "meetings"
  | "documents"
  | "billing"
  | "settings";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview",     label: "Overview"      },
  { key: "team",         label: "Team"          },
  { key: "messaging",    label: "Inbox"         },
  { key: "properties",   label: "Properties"    },
  { key: "projects",     label: "Projects"      },
  { key: "tasks",        label: "Tasks"         },
  { key: "meetings",     label: "Meetings"      },
  { key: "documents",    label: "Documents"     },
  { key: "billing",      label: "Finances"      },
  { key: "settings",     label: "Settings"      },
];

const TAB_KEYS = TABS.map((t) => t.key) as readonly string[];

const BUSINESS_ENTITY_TYPE_LABELS: Record<string, string> = {
  individual: 'Individual',
  llc: 'LLC',
  s_corp: 'S Corp',
  c_corp: 'C Corp',
  trust: 'Trust',
  partnership: 'Partnership',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function relativeDays(iso: string | null): string {
  if (!iso) return "Not set";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// "Mon, Apr 28" for follow-up dates without a stored time.
function formatShortDate(iso: string | null): string {
  if (!iso) return "Not set";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Not set";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatPhone(raw: string | null): string | null {
  if (!raw) return null;
  const d = raw.replace(/\D/g, "");
  const n = d.length === 11 && d[0] === "1" ? d.slice(1) : d;
  if (n.length === 10) return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`;
  return raw;
}

function formatRevenue(cents: number | null): string {
  if (cents === null || cents === 0) return "$0";
  const k = cents / 100;
  if (k >= 1000) return `$${(k / 1000).toFixed(1)}k`;
  return `$${k.toFixed(0)}`;
}

function isOverdue(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}

function daysOverdue(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000);
}


// ---------------------------------------------------------------------------
// Copy button
// ---------------------------------------------------------------------------

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* silent */ }
  };
  return (
    <button
      type="button"
      className={`${styles.copyBtn} ${copied ? styles.copyBtnCopied : ""}`}
      onClick={handleCopy}
      aria-label={`Copy ${value}`}
      title={copied ? "Copied!" : "Copy"}
    >
      <CopySimple size={12} weight="bold" />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Inline status line (replaces the bordered-cell strip)
// ---------------------------------------------------------------------------

function StatusLine({
  contactId,
  followUpAt,
  nextMeeting,
  lastActivityAt,
}: {
  contactId: string;
  followUpAt: string | null;
  nextMeeting: NextMeeting;
  lastActivityAt: string | null;
}) {
  const [picking, setPicking] = useState(false);
  const [current, setCurrent] = useState(followUpAt);
  const [, startTransition] = useTransition();
  const followUpAnchorRef = useRef<HTMLDivElement>(null);

  const save = (iso: string | null) => {
    setCurrent(iso);
    setPicking(false);
    startTransition(async () => {
      await updateWorkspaceContactFields(contactId, { nextFollowUpAt: iso });
    });
  };

  const overdue = current ? isOverdue(current) : false;
  const overdueDays = current && overdue ? daysOverdue(current) : 0;
  const hasMeeting = !!nextMeeting;
  const lastContactAgo = lastActivityAt ? relativeDays(lastActivityAt) : null;

  let followUpNode: React.ReactNode;
  if (current && overdue) {
    followUpNode = (
      <>
        <button
          type="button"
          className={styles.statusLineFollowUpBtn}
          data-state="overdue"
          onClick={() => setPicking(true)}
        >
          {formatShortDate(current)}
          {overdueDays > 0 && ` · ${overdueDays}d overdue`}
        </button>
        <button type="button" className={styles.statusLineDoneBtn} onClick={() => save(null)}>
          Done
        </button>
      </>
    );
  } else if (current) {
    followUpNode = (
      <button
        type="button"
        className={styles.statusLineFollowUpBtn}
        data-state="upcoming"
        onClick={() => setPicking(true)}
      >
        {formatShortDate(current)}
      </button>
    );
  } else if (hasMeeting) {
    followUpNode = (
      <>
        <span className={styles.statusLineMuted}>Meeting is next</span>
        <button type="button" className={styles.statusLineAddBtn} onClick={() => setPicking(true)}>
          Add reminder
        </button>
      </>
    );
  } else {
    followUpNode = (
      <button type="button" className={styles.statusLineSetBtn} onClick={() => setPicking(true)}>
        Set date
      </button>
    );
  }

  let nextMeetingNode: React.ReactNode;
  if (nextMeeting) {
    const meetingDays = Math.ceil(
      (new Date(nextMeeting.scheduledAt).getTime() - SHELL_LOADED_AT_MS) / 86400_000,
    );
    const meetingRel =
      meetingDays <= 0 ? "today" : meetingDays === 1 ? "tomorrow" : `in ${meetingDays}d`;
    const title =
      nextMeeting.title.length > 28
        ? nextMeeting.title.slice(0, 28) + "…"
        : nextMeeting.title;
    nextMeetingNode = (
      <span className={styles.statusLineMeetingText}>
        {title}
        {" · "}
        {meetingRel}
      </span>
    );
  } else {
    nextMeetingNode = <span className={styles.statusLineMuted}>None scheduled</span>;
  }

  return (
    <div className={`${styles.statusLine} ${overdue ? styles.statusLineOverdue : ""}`}>
      <span className={styles.statusLinePiece}>
        <span className={styles.statusLineLabel}>Last contact</span>
        <span className={styles.statusLineMuted}>{lastContactAgo ?? "No activity yet"}</span>
      </span>
      <span className={styles.statusLineSep} aria-hidden="true" />
      <div ref={followUpAnchorRef} className={styles.statusLinePiece}>
        <span className={styles.statusLineLabel}>Follow-up</span>
        {followUpNode}
      </div>
      <span className={styles.statusLineSep} aria-hidden="true" />
      <span className={styles.statusLinePiece}>
        <span className={styles.statusLineLabel}>Next meeting</span>
        {nextMeetingNode}
      </span>
      {picking && (
        <DatePickerPopover
          anchorRef={followUpAnchorRef}
          value={current}
          onSelect={save}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom date-picker popover (portal-based to escape overflow:hidden)
// ---------------------------------------------------------------------------

const QUICK_PICKS = [
  { label: "Today",    days: 0 },
  { label: "Tomorrow", days: 1 },
  { label: "+1 week",  days: 7 },
  { label: "+2 weeks", days: 14 },
];

function DatePickerPopover({
  anchorRef,
  value,
  onSelect,
  onClose,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  value: string | null;
  onSelect: (iso: string) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const initDate = value ? new Date(value.slice(0, 10) + "T00:00:00") : today;
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(initDate));

  useEffect(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, left: rect.left });
    }
  }, [anchorRef]);

  useEffect(() => {
    const handler = (e: globalThis.MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) &&
          anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose, anchorRef]);

  const selectedDateStr = value ? value.slice(0, 10) : null;

  const quickPick = (days: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    onSelect(d.toISOString());
  };

  const daysInMonth = getDaysInMonth(viewMonth);
  const firstDow = getDay(viewMonth);
  const cells: (Date | null)[] = Array(firstDow).fill(null);
  for (let i = 1; i <= daysInMonth; i++) {
    cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), i));
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={panelRef}
      className={styles.datePicker}
      style={{ top: pos.top, left: pos.left }}
    >
      <div className={styles.datePickerQuick}>
        {QUICK_PICKS.map((q) => (
          <button key={q.label} className={styles.datePickerChip} onClick={() => quickPick(q.days)} type="button">
            {q.label}
          </button>
        ))}
      </div>

      <div className={styles.datePickerNav}>
        <button className={styles.datePickerNavBtn} onClick={() => setViewMonth(subMonths(viewMonth, 1))} type="button">
          <CaretLeft size={12} weight="bold" />
        </button>
        <span className={styles.datePickerMonthLabel}>{formatDate(viewMonth, "MMMM yyyy")}</span>
        <button className={styles.datePickerNavBtn} onClick={() => setViewMonth(addMonths(viewMonth, 1))} type="button">
          <CaretRight size={12} weight="bold" />
        </button>
      </div>

      <div className={styles.datePickerGrid}>
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d) => (
          <span key={d} className={styles.datePickerDow}>{d}</span>
        ))}
        {cells.map((day, i) => {
          if (!day) return <span key={`e${i}`} />;
          const dateStr = formatDate(day, "yyyy-MM-dd");
          const isToday = day.getTime() === today.getTime();
          const isSelected = dateStr === selectedDateStr;
          const isPast = day.getTime() < today.getTime();
          return (
            <button
              key={dateStr}
              type="button"
              className={`${styles.datePickerDay} ${isToday ? styles.datePickerDayToday : ""} ${isSelected ? styles.datePickerDaySelected : ""} ${isPast ? styles.datePickerDayPast : ""}`}
              onClick={() => onSelect(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 8, 0, 0).toISOString())}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function SkBone({ w, h, style }: { w?: string | number; h?: number; style?: React.CSSProperties }) {
  return (
    <div
      className={styles.skBone}
      style={{ width: w ?? "100%", height: h ?? 12, ...style }}
    />
  );
}

function SkCard({ children }: { children: React.ReactNode }) {
  return <div className={styles.skCard}>{children}</div>;
}

function TabSkeleton({ tab }: { tab: TabKey }) {
  switch (tab) {
    case "overview":
      return (
        <div className={styles.skContent}>
          <div className={styles.skRow2}>
            <SkCard>
              <SkBone w="45%" h={9} />
              <SkBone w="55%" h={26} />
              <SkBone w="70%" h={9} />
            </SkCard>
            <SkCard>
              <SkBone w="45%" h={9} />
              <SkBone w="40%" h={26} />
              <SkBone w="60%" h={9} />
            </SkCard>
          </div>
          <SkCard>
            <SkBone w="30%" h={9} />
            <SkBone h={10} />
            <SkBone w="88%" h={10} />
            <SkBone w="72%" h={10} />
          </SkCard>
          <SkCard>
            {[0, 1, 2].map((i) => (
              <div key={i} className={styles.skListRow}>
                <SkBone style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0 }} />
                <div className={styles.skFlex1}>
                  <SkBone w="50%" h={11} />
                  <SkBone w="28%" h={9} />
                </div>
              </div>
            ))}
          </SkCard>
        </div>
      );

    case "properties":
      return (
        <div className={styles.skContent}>
          {[0, 1, 2].map((i) => (
            <SkCard key={i}>
              <div className={styles.skListRow}>
                <SkBone style={{ width: 44, height: 44, borderRadius: 8, flexShrink: 0 }} />
                <div className={styles.skFlex1}>
                  <SkBone w="55%" h={13} />
                  <SkBone w="35%" h={9} />
                </div>
                <SkBone style={{ width: 70, height: 24, borderRadius: 6 }} />
              </div>
            </SkCard>
          ))}
        </div>
      );

    case "team":
      return (
        <div className={styles.skContent}>
          <div className={styles.skRow3}>
            <SkCard>
              <SkBone w="36%" h={9} />
              <SkBone w="24%" h={24} />
              <SkBone w="50%" h={9} />
            </SkCard>
            <SkCard>
              <SkBone w="36%" h={9} />
              <SkBone w="24%" h={24} />
              <SkBone w="50%" h={9} />
            </SkCard>
            <SkCard>
              <SkBone w="36%" h={9} />
              <SkBone w="24%" h={24} />
              <SkBone w="50%" h={9} />
            </SkCard>
          </div>
          <div className={styles.skRow2}>
            {[0, 1, 2, 3].map((i) => (
              <SkCard key={i}>
                <div className={styles.skListRow}>
                  <SkBone style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0 }} />
                  <div className={styles.skFlex1}>
                    <SkBone w="56%" h={13} />
                    <SkBone w="38%" h={9} />
                  </div>
                </div>
                <SkBone w="70%" h={10} />
              </SkCard>
            ))}
          </div>
        </div>
      );

    case "projects":
      return (
        <div className={styles.skContent}>
          <SkCard>
            <SkBone w="28%" h={12} />
            <SkBone w="82%" h={10} />
            <div className={styles.skRow3}>
              <SkBone h={36} style={{ borderRadius: 7 }} />
              <SkBone h={36} style={{ borderRadius: 7 }} />
              <SkBone h={36} style={{ borderRadius: 7 }} />
            </div>
          </SkCard>
          <div className={styles.skRow2}>
            {[0, 1].map((i) => (
              <SkCard key={i}>
                <div className={styles.skListRow}>
                  <SkBone style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0 }} />
                  <div className={styles.skFlex1}>
                    <SkBone w="62%" h={13} />
                    <SkBone w="38%" h={9} />
                  </div>
                </div>
                <SkBone h={6} style={{ borderRadius: 999 }} />
                <SkBone w="42%" h={10} />
              </SkCard>
            ))}
          </div>
        </div>
      );

    case "tasks":
      return (
        <div className={styles.skContent}>
          <div className={styles.skTopBar}>
            <SkBone w={160} h={11} />
            <SkBone w={110} h={30} style={{ borderRadius: 7 }} />
          </div>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className={styles.skTaskRow}>
              <SkBone style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0 }} />
              <div className={styles.skFlex1}>
                <SkBone w={`${55 + (i * 9) % 35}%`} h={12} />
                <SkBone w="22%" h={9} />
              </div>
              <SkBone style={{ width: 60, height: 20, borderRadius: 10 }} />
            </div>
          ))}
        </div>
      );

    case "meetings":
      return (
        <div className={styles.skContent}>
          <div className={styles.skTopBar}>
            <SkBone w={120} h={11} />
            <SkBone w={140} h={30} style={{ borderRadius: 7 }} />
          </div>
          {[0, 1, 2].map((i) => (
            <SkCard key={i}>
              <div className={styles.skMeetingRow}>
                <SkBone style={{ width: 38, height: 38, borderRadius: 9, flexShrink: 0 }} />
                <div className={styles.skFlex1}>
                  <SkBone w="48%" h={13} />
                  <SkBone w="32%" h={9} />
                </div>
                <SkBone style={{ width: 65, height: 22, borderRadius: 5 }} />
              </div>
            </SkCard>
          ))}
        </div>
      );

    case "messaging":
      return (
        <div className={styles.skContent} style={{ gap: 10 }}>
          {[44, 62, 38, 55, 48].map((pct, i) => (
            <div key={i} className={[styles.skMessageRow, i % 2 === 1 ? styles.skMessageRowRight : ""].join(" ")}>
              <div className={styles.skBubble} style={{ width: `${pct}%` }}>
                <SkBone h={9} />
                {i % 2 === 0 && <SkBone w="75%" h={9} />}
              </div>
            </div>
          ))}
        </div>
      );

    case "documents":
      return (
        <div className={styles.skContent}>
          <div className={styles.skDocGrid}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <SkCard key={i}>
                <SkBone style={{ width: 40, height: 40, borderRadius: 8 }} />
                <SkBone w="70%" h={11} />
                <SkBone w="45%" h={9} />
              </SkCard>
            ))}
          </div>
        </div>
      );

    case "billing":
      return (
        <div className={styles.skContent}>
          <div className={styles.skRow3}>
            {[0, 1, 2].map((i) => (
              <SkCard key={i}>
                <SkBone w="42%" h={9} />
                <SkBone w="58%" h={28} />
                <SkBone w="35%" h={9} />
              </SkCard>
            ))}
          </div>
          <SkCard>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className={styles.skTableRow}>
                <SkBone w="28%" h={10} />
                <SkBone w="18%" h={10} />
                <SkBone w="14%" h={10} />
              </div>
            ))}
          </SkCard>
        </div>
      );

    case "settings":
      return (
        <div className={styles.skContent}>
          {[0, 1, 2].map((s) => (
            <SkCard key={s}>
              <SkBone w="22%" h={13} />
              <div className={styles.skFormField}>
                <SkBone w="18%" h={9} />
                <SkBone h={36} style={{ borderRadius: 7 }} />
              </div>
              <div className={styles.skFormField}>
                <SkBone w="14%" h={9} />
                <SkBone h={36} style={{ borderRadius: 7 }} />
              </div>
            </SkCard>
          ))}
        </div>
      );

    default:
      return (
        <div className={styles.skContent}>
          {[0, 1, 2].map((i) => (
            <SkCard key={i}>
              <SkBone w="38%" h={12} />
              <SkBone h={10} />
              <SkBone w="72%" h={10} />
            </SkCard>
          ))}
        </div>
      );
  }
}

// ---------------------------------------------------------------------------
// Inner component
// ---------------------------------------------------------------------------

function WorkspaceContactDetailContent({
  workspaceContact,
  adminProfiles,
  nextMeeting,
  workspaceInfo,
  members,
  activeContactId,
  initialTab,
  tabContents,
}: {
  workspaceContact: WorkspaceContactDetail;
  adminProfiles: AdminProfile[];
  nextMeeting: NextMeeting;
  workspaceInfo: WorkspaceInfo;
  members: WorkspaceMember[];
  activeContactId: string;
  initialTab: TabKey;
  tabContents: Record<TabKey, React.ReactNode>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const rawSection = searchParams.get("section");
  const isContactDetailOpen = searchParams.get("detail") === "contact";

  const [isPersonPending, startPersonTransition] = useTransition();
  const [pendingPersonId, setPendingPersonId] = useState<string | null>(null);
  const visiblePendingPersonId = isPersonPending ? pendingPersonId : null;

  const tabLabel = TABS.find((t) => t.key === activeTab)?.label ?? activeTab;
  useSetTopBarSlots(
    () => ({ breadcrumbTrail: ["Workspaces", workspaceInfo.name, tabLabel] }),
    [workspaceInfo.name, tabLabel],
  );

  const shellRef = useRef<HTMLDivElement>(null);
  const viewingMember =
    members.find((member) => member.id === (visiblePendingPersonId ?? activeContactId)) ??
    members.find((member) => member.id === activeContactId);

  const replaceBrowserTab = useCallback((nextTab: TabKey, nextParams?: URLSearchParams) => {
    const params = nextParams ?? new URLSearchParams(window.location.search);
    params.set("tab", nextTab);
    params.delete("detail");
    if (nextTab !== "settings") params.delete("section");
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, []);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const replaceQuery = useCallback((mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(window.location.search);
    mutate(params);
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [router]);

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      setActiveTab(tab && TAB_KEYS.includes(tab) ? (tab as TabKey) : "overview");
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const openContactDetails = useCallback(() => {
    replaceQuery((params) => {
      params.set("tab", activeTab);
      params.set("person", visiblePendingPersonId ?? activeContactId);
      params.set("detail", "contact");
      if (activeTab !== "settings") params.delete("section");
    });
  }, [activeContactId, activeTab, replaceQuery, visiblePendingPersonId]);

  const closeContactDetails = useCallback(() => {
    replaceQuery((params) => {
      params.delete("detail");
    });
  }, [replaceQuery]);

  const handleWorkspaceTabLinkClick = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return;
    }

    if (!(event.target instanceof Element)) return;

    const link = event.target.closest<HTMLAnchorElement>("a[href]");
    if (!link || link.target || link.hasAttribute("download")) return;

    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin || url.pathname !== window.location.pathname) return;

    const nextTabParam = url.searchParams.get("tab");
    if (!nextTabParam || !TAB_KEYS.includes(nextTabParam)) return;

    event.preventDefault();
    const nextTab = nextTabParam as TabKey;
    const params = new URLSearchParams(window.location.search);
    url.searchParams.forEach((value, key) => {
      params.set(key, value);
    });
    setActiveTab(nextTab);
    replaceBrowserTab(nextTab, params);
  }, [replaceBrowserTab]);

  useEffect(() => {
    const main = shellRef.current?.closest("main");
    if (!main) return;
    const update = () => {
      if (shellRef.current) {
        shellRef.current.style.height = `${main.clientHeight}px`;
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(main);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!isContactDetailOpen) return;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeContactDetails();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeContactDetails, isContactDetailOpen]);

  // Live name state for header sync with sidebar editing
  const [displayFirst, setDisplayFirst] = useState(workspaceContact.firstName ?? "");
  const [displayLast, setDisplayLast] = useState(workspaceContact.lastName ?? "");
  const [editingNamePart, setEditingNamePart] = useState<"first" | "last" | null>(null);
  const [displayAvatarUrl, setDisplayAvatarUrl] = useState<string | null>(workspaceContact.avatarUrl ?? null);
  const nameEditTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleNameChange = useCallback((first: string, last: string) => {
    setDisplayFirst(first);
    setDisplayLast(last);
  }, []);

  const handleNameEditStart = useCallback((part: "first" | "last") => {
    if (nameEditTimeoutRef.current) clearTimeout(nameEditTimeoutRef.current);
    setEditingNamePart(part);
  }, []);

  const handleNameEditEnd = useCallback(() => {
    nameEditTimeoutRef.current = setTimeout(() => setEditingNamePart(null), 120);
  }, []);

  return (
    <WorkspaceNameContext.Provider value={{ firstName: displayFirst, lastName: displayLast, avatarUrl: displayAvatarUrl, setAvatarUrl: setDisplayAvatarUrl }}>
    <div ref={shellRef} className={styles.shell}>
      <div className={styles.leftColumn}>

        {/* ── Header ──────────────────────────────────────────────── */}
        <header className={styles.header}>

          {/* Header grid: left contact block | right: pills + strip */}
          <div className={styles.headerGrid}>

            <div className={styles.contactBlock}>
              {displayAvatarUrl ? (
                <Image
                  src={displayAvatarUrl}
                  alt={workspaceContact.fullName}
                  width={88}
                  height={88}
                  className={styles.avatar}
                />
              ) : (
                <div className={styles.avatarFallback}>
                  {getInitials((displayFirst || displayLast) ? `${displayFirst} ${displayLast}`.trim() : workspaceContact.fullName)}
                </div>
              )}
              <div className={styles.idworkspaceBlock}>
                <div className={styles.workspaceRow}>
                  <span className={styles.workspaceName}>{workspaceInfo.name}</span>
                  {workspaceInfo.type && (
                    <span className={styles.workspaceTypeBadge}>
                      {BUSINESS_ENTITY_TYPE_LABELS[workspaceInfo.type] ?? workspaceInfo.type}
                    </span>
                  )}
                </div>
                {members.length > 1 && (
                  <div className={styles.personChipsRow}>
                    {members.map((m) => {
                      const chipActive = visiblePendingPersonId ? m.id === visiblePendingPersonId : m.id === activeContactId;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          className={`${styles.personChip} ${chipActive ? styles.personChipActive : ''}`}
                          aria-pressed={chipActive}
                          onClick={() => {
                            if (m.id === activeContactId && !pendingPersonId) return;
                            setPendingPersonId(m.id);
                            startPersonTransition(() => {
                              replaceQuery((params) => {
                                params.set("tab", activeTab);
                                params.set("person", m.id);
                                params.delete("detail");
                                if (rawSection) {
                                  params.set("section", rawSection);
                                } else {
                                  params.delete("section");
                                }
                              });
                            });
                          }}
                        >
                          {m.avatarUrl ? (
                            <Image
                              src={m.avatarUrl}
                              alt={m.fullName}
                              width={16}
                              height={16}
                              className={styles.personChipAvatar}
                            />
                          ) : (
                            <span className={styles.personChipInitials}>
                              {getInitials(m.fullName).slice(0, 1)}
                            </span>
                          )}
                          <span>{m.firstName ?? m.fullName.split(' ')[0]}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {members.length > 1 && viewingMember && (
                  <div className={styles.viewingContext}>
                    Viewing {viewingMember.firstName ?? viewingMember.fullName.split(" ")[0]}
                    {isPersonPending ? "..." : ""}
                  </div>
                )}
                <h1 className={styles.name}>
                  {(displayFirst || displayLast) ? (
                    <>
                      {displayFirst && (
                        <span className={editingNamePart === "first" ? styles.namePartEditing : ""}>
                          {displayFirst}
                        </span>
                      )}
                      {displayFirst && displayLast && " "}
                      {displayLast && (
                        <span className={editingNamePart === "last" ? styles.namePartEditing : ""}>
                          {displayLast}
                        </span>
                      )}
                    </>
                  ) : (
                    workspaceContact.fullName || "Not set"
                  )}
                </h1>
                <div className={styles.contactStack}>
                  {workspaceContact.email && (
                    <span className={styles.contactItem}>
                      <span className={styles.contactValue}>{workspaceContact.email}</span>
                      <CopyButton value={workspaceContact.email} />
                    </span>
                  )}
                  {workspaceContact.phone && (
                    <span className={styles.contactItem}>
                      <span className={styles.contactValue}>{formatPhone(workspaceContact.phone) ?? workspaceContact.phone}</span>
                      <CopyButton value={workspaceContact.phone} />
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.pillsRow}>
              <div className={styles.pill}>
                <span className={styles.pillHighlight}>{workspaceContact.properties.length}</span>
                <span>{workspaceContact.properties.length === 1 ? "Property" : "Properties"}</span>
              </div>
              <div className={styles.pillSep} />
              <div className={styles.pill}>
                <span className={styles.pillHighlight}>{formatRevenue(workspaceContact.lifetimeRevenue)}</span>
                <span>Lifetime rev.</span>
              </div>
              <div className={styles.pillSep} />
              <StagePopover contactId={workspaceContact.id} stage={workspaceContact.lifecycleStage} />
              <button
                type="button"
                className={styles.detailButton}
                data-testid="workspace-view-details"
                onClick={openContactDetails}
              >
                <IdentificationCard size={14} weight="bold" />
                <span>View details</span>
              </button>
            </div>

            <StatusLine
              contactId={workspaceContact.id}
              followUpAt={workspaceContact.nextFollowUpAt}
              nextMeeting={nextMeeting}
              lastActivityAt={workspaceContact.lastActivityAt}
            />

          </div>
        </header>

        {/* ── Tab bar + content ─────────────────────────────────── */}
        <div className={styles.tabColumn}>
          <nav className={styles.tabBar} aria-label="Workspace sections">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={styles.tab}
                data-label={tab.label}
                data-active={activeTab === tab.key ? "true" : "false"}
                onClick={() => {
                  if (tab.key !== activeTab) {
                    setActiveTab(tab.key);
                    replaceBrowserTab(tab.key);
                  }
                }}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          <div className={styles.contentWrapper} onClick={handleWorkspaceTabLinkClick}>
            {visiblePendingPersonId
              ? <TabSkeleton tab={activeTab} />
              : <main className={styles.content}>{tabContents[activeTab]}</main>
            }
          </div>
        </div>
      </div>

      {isContactDetailOpen && (
        <div className={styles.drawerLayer} role="presentation">
          <button
            type="button"
            className={styles.drawerBackdrop}
            aria-label="Close contact details"
            onClick={closeContactDetails}
          />
          <section
            className={styles.detailDrawer}
            role="dialog"
            aria-modal="true"
            aria-label="Contact details"
          >
            <div className={styles.detailDrawerHeader}>
              <div>
                <span className={styles.detailDrawerTitle}>Contact details</span>
                <span className={styles.detailDrawerSubtitle}>
                  {viewingMember?.fullName ?? workspaceContact.fullName}
                </span>
              </div>
              <button
                type="button"
                className={styles.detailDrawerClose}
                aria-label="Close contact details"
                onClick={closeContactDetails}
              >
                <XIcon size={18} weight="bold" />
              </button>
            </div>
            <div className={styles.detailDrawerBody}>
              <WorkspaceDetailSidebar
                key={workspaceContact.id}
                workspaceContact={workspaceContact}
                adminProfiles={adminProfiles}
                workspaceInfo={workspaceInfo}
                members={members}
                activeContactId={activeContactId}
                onNameChange={handleNameChange}
                onNameEditStart={handleNameEditStart}
                onNameEditEnd={handleNameEditEnd}
              />
            </div>
          </section>
        </div>
      )}
    </div>
    </WorkspaceNameContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export function WorkspaceDetailShell({
  workspaceContact,
  adminProfiles,
  nextMeeting,
  workspaceInfo,
  members,
  activeContactId,
  initialTab,
  tabContents,
}: {
  workspaceContact: WorkspaceContactDetail;
  adminProfiles: AdminProfile[];
  nextMeeting: NextMeeting;
  workspaceInfo: WorkspaceInfo;
  members: WorkspaceMember[];
  activeContactId: string;
  initialTab: TabKey;
  tabContents: Record<TabKey, React.ReactNode>;
}) {
  return (
    <Suspense fallback={<div className={styles.shell} />}>
      <WorkspaceContactDetailContent
        workspaceContact={workspaceContact}
        adminProfiles={adminProfiles}
        nextMeeting={nextMeeting}
        workspaceInfo={workspaceInfo}
        members={members}
        activeContactId={activeContactId}
        initialTab={initialTab}
        tabContents={tabContents}
      >
      </WorkspaceContactDetailContent>
    </Suspense>
  );
}
