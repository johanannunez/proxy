"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell } from "@phosphor-icons/react";
import { useTopBarSlots } from "./TopBarSlotsContext";
import styles from "./AdminTopBar.module.css";

type Props = {
  pendingBlockCount?: number;
};

function ordinalSuffix(day: number): string {
  const rem100 = day % 100;
  if (rem100 >= 11 && rem100 <= 13) return "th";
  switch (day % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

function AdminClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    const initial = window.setTimeout(tick, 0);
    const interval = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, []);

  if (!now) return <div className={styles.clockPlaceholder} />;

  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  const timeStr = `${displayHours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")} ${period}`;

  const day = now.getDate();
  const suffix = ordinalSuffix(day);
  const weekday = now.toLocaleDateString("en-US", { weekday: "short" });
  const month = now.toLocaleDateString("en-US", { month: "short" });
  const year = now.getFullYear();

  return (
    <div className={styles.clock} suppressHydrationWarning>
      <span className={styles.clockDate}>
        {weekday}, {month} {day}
        <span className={styles.clockSuffix}>{suffix}</span>
        , {year}
      </span>
      <span className={styles.clockDivider} aria-hidden />
      <span className={styles.clockTime}>{timeStr}</span>
      <span className={styles.live} aria-hidden />
    </div>
  );
}

const SECTION_LABELS: Record<string, string> = {
  dashboard: "Today",
  inbox: "Inbox",
  tasks: "Tasks",
  calendar: "Calendar",
  meetings: "Meetings",
  projects: "Projects",
  workspaces: "Workspaces",
  vendors: "Vendors",
  properties: "Properties",
  finances: "Finances",
  help: "Help Center",
  treasury: "Treasury",
  timeline: "Timeline",
  payouts: "Payouts",
  account: "Account",
  map: "Map",
  prospects: "Prospects",
  people: "People",
  "block-requests": "Owner Reservations",
};

function Breadcrumb({ trail }: { trail: string[] | null }) {
  const pathname = usePathname() ?? "";
  const segments = pathname.replace(/^\/admin\/?/, "").split("/").filter(Boolean);
  const section = segments[0] ?? "dashboard";
  const defaultLabel = SECTION_LABELS[section] ?? (section.charAt(0).toUpperCase() + section.slice(1));

  const crumbs: string[] = trail ?? [defaultLabel];

  return (
    <nav className={styles.breadcrumb} aria-label="Breadcrumb">
      <span className={styles.breadcrumbRoot}>Admin</span>
      {crumbs.map((crumb, i) => {
        const isCurrent = i === crumbs.length - 1;
        return (
          <span key={i} className={styles.breadcrumbSegment}>
            <span className={styles.breadcrumbSep} aria-hidden>›</span>
            <span className={isCurrent ? styles.breadcrumbCurrent : styles.breadcrumbLink}>
              {crumb}
            </span>
          </span>
        );
      })}
    </nav>
  );
}

function NotificationBell({ count }: { count: number }) {
  const btnRef = useRef<HTMLButtonElement>(null);

  function handleClick() {
    window.dispatchEvent(new CustomEvent("admin:notifications-toggle"));
  }

  return (
    <button
      ref={btnRef}
      type="button"
      className={styles.bellBtn}
      aria-label="Notifications"
      onClick={handleClick}
    >
      <Bell size={15} weight="regular" />
      {count > 0 && (
        <span className={styles.bellBadge} aria-hidden>
          {count > 9 ? "9+" : count}
        </span>
      )}
    </button>
  );
}

export function AdminTopBar({ pendingBlockCount = 0 }: Props) {
  const { centerSlot, breadcrumbTrail } = useTopBarSlots();

  return (
    <header className={styles.root}>
      <Breadcrumb trail={breadcrumbTrail} />
      {centerSlot ? (
        <div className={styles.centerSlot}>{centerSlot}</div>
      ) : null}
      <div className={styles.right}>
        <AdminClock />
        <NotificationBell count={pendingBlockCount} />
      </div>
    </header>
  );
}
