"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion, LayoutGroup, AnimatePresence } from "motion/react";
import {
  Gauge,
  DoorOpen,
  ChatsCircle,
  ListChecks,
  FolderOpen,
  Files,
  FileDashed,
  Clipboard,
  ShareNetwork,
  Funnel,
  UserList,
  Stack,
  Handshake,
  MagnifyingGlass,
  List as HamburgerIcon,
  CaretDown,
  CalendarDots,
  Receipt,
  Pulse,
  Buildings,
} from "@phosphor-icons/react";
import { useState, type ReactNode } from "react";
import { AdminSidebarFooter } from "@/components/admin/AdminSidebarFooter";
import { SidebarSearch } from "@/components/admin/chrome/SidebarSearch";
import { CreateMenu } from "@/components/admin/chrome/CreateMenu";
import { TopBarSearch } from "@/components/admin/chrome/TopBarSearch";
import { openCommandPalette } from "@/components/admin/chrome/CommandPalette";
import { openSidebarDrawer } from "@/components/admin/chrome/SidebarDrawer";
import css from "./AdminSidebar.module.css";

/* ─── Types ─── */

type NavItem = {
  kind: "item";
  href: string;
  label: string;
  icon: ReactNode;
  matchPrefix?: string;
  badge?: number;
};

type NavSubItem = {
  href: string;
  label: string;
  icon: ReactNode;
  matchPrefix?: string;
};

type NavSubGroup = {
  kind: "subgroup";
  label: string;
  icon: ReactNode;
  storageKey: string;
  matchPrefix: string;
  items: NavSubItem[];
};

type NavGroup = {
  kind: "group";
  label: string;
  icon: ReactNode;
  storageKey: string;
  items: (NavSubItem | NavSubGroup)[];
};

type NavEntry = NavItem | NavGroup | NavSubGroup;

/* ─── Nav data ─── */

const navEntries: NavEntry[] = [
  { kind: "item", href: "/admin", label: "Today", icon: <Gauge size={18} weight="duotone" /> },
  { kind: "item", href: "/admin/inbox", label: "Inbox", icon: <ChatsCircle size={18} weight="duotone" />, matchPrefix: "/admin/inbox" },
  { kind: "item", href: "/admin/tasks", label: "Tasks", icon: <ListChecks size={18} weight="duotone" />, matchPrefix: "/admin/tasks" },
  { kind: "item", href: "/admin/meetings", label: "Meetings", icon: <CalendarDots size={18} weight="duotone" />, matchPrefix: "/admin/meetings" },
  { kind: "item", href: "/admin/workspaces?view=active-owners", label: "Workspaces", icon: <Stack size={18} weight="duotone" />, matchPrefix: "/admin/workspaces" },
  {
    kind: "group",
    label: "Relationships",
    icon: <ShareNetwork size={18} weight="duotone" />,
    storageKey: "nav-people-expanded",
    items: [
      { href: "/admin/people?mode=compact", label: "People", icon: <UserList size={16} weight="duotone" />, matchPrefix: "/admin/people" },
      { href: "/admin/vendors", label: "Vendors", icon: <Handshake size={16} weight="duotone" />, matchPrefix: "/admin/vendors" },
      { href: "/admin/prospects", label: "Prospects", icon: <Funnel size={16} weight="duotone" />, matchPrefix: "/admin/prospects" },
    ],
  },
  {
    kind: "group",
    label: "Operations",
    icon: <Buildings size={18} weight="duotone" />,
    storageKey: "nav-operations-expanded",
    items: [
      { href: "/admin/properties", label: "Properties", icon: <DoorOpen size={16} weight="duotone" />, matchPrefix: "/admin/properties" },
      {
        kind: "subgroup" as const,
        label: "Paperwork",
        icon: <Files size={16} weight="duotone" />,
        storageKey: "nav-paperwork-expanded",
        matchPrefix: "/admin/paperwork",
        items: [
          { href: "/admin/paperwork", label: "Documents", icon: <Files size={15} weight="duotone" /> },
          { href: "/admin/paperwork/forms", label: "Forms", icon: <Clipboard size={15} weight="duotone" />, matchPrefix: "/admin/paperwork/forms" },
          { href: "/admin/paperwork/templates", label: "Templates", icon: <FileDashed size={15} weight="duotone" />, matchPrefix: "/admin/paperwork/templates" },
        ],
      },
      { href: "/admin/projects", label: "Projects", icon: <FolderOpen size={16} weight="duotone" />, matchPrefix: "/admin/projects" },
      { href: "/admin/guest-pulse", label: "Pulse", icon: <Pulse size={16} weight="duotone" />, matchPrefix: "/admin/guest-pulse" },
    ],
  },
  { kind: "item", href: "/admin/finances", label: "Finances", icon: <Receipt size={18} weight="duotone" />, matchPrefix: "/admin/finances" },
];

/* ─── Token constants ─── */

const T = {
  brand: "#02AAEB",
  brandLight: "var(--color-brand-light, #4cc9f0)",
  activeTextColor: "#ffffff",
  inactiveTextColor: "rgba(255,255,255,0.66)",
  activeIconColor: "var(--color-brand-light, #4cc9f0)",
  inactiveIconColor: "rgba(255,255,255,0.44)",
  activeBg: "rgba(2, 170, 235, 0.09)",
  hoverBg: "rgba(255, 255, 255, 0.045)",
  badgeBg: "#f59e0b",
  badgeText: "#1a1a1a",
  indicatorGlow: "0 0 10px 1px rgba(2, 170, 235, 0.55), 0 0 3px rgba(255,255,255,0.18)",
} as const;

/* ─── Spring configs ─── */

const springSnap = { type: "spring" as const, stiffness: 420, damping: 32, mass: 0.8 };
const springIcon = { type: "spring" as const, stiffness: 520, damping: 28 };
const easeFade = { duration: 0.12 };
const springCollapse = { type: "spring" as const, stiffness: 380, damping: 36, mass: 0.7 };

/* ─── NavItemRow ─── */

function shouldPrefetchAdminHref(href: string): boolean {
  return !href.startsWith("/admin/workspaces");
}

function NavItemRow({
  href,
  label,
  icon,
  active,
  badge,
  sub = false,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  active: boolean;
  badge?: number;
  sub?: boolean;
}) {
  const badgeCount = badge ?? 0;

  return (
    <motion.li
      key={href}
      initial="idle"
      whileHover="hovered"
      animate="idle"
      style={{ listStyle: "none" }}
    >
      <Link
        href={href}
        prefetch={shouldPrefetchAdminHref(href)}
        aria-current={active ? "page" : undefined}
        className={css.navLink}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: sub ? "6px 12px 6px 36px" : "8px 12px",
          borderRadius: "9px",
          textDecoration: "none",
          fontSize: sub ? "13px" : "13.5px",
          fontWeight: active ? 600 : 500,
          letterSpacing: "0.01em",
          lineHeight: 1.2,
          color: active ? T.activeTextColor : T.inactiveTextColor,
          backgroundColor: active ? T.activeBg : "transparent",
        }}
      >
        {/* Hover overlay */}
        {!active && (
          <motion.span
            aria-hidden
            variants={{ idle: { opacity: 0 }, hovered: { opacity: 1 } }}
            transition={easeFade}
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "9px",
              backgroundColor: T.hoverBg,
              pointerEvents: "none",
            }}
          />
        )}

        {/* Active indicator pill */}
        {active && (
          <motion.span
            layoutId="admin-nav-pill"
            aria-hidden
            style={{
              position: "absolute",
              left: 0,
              top: "50%",
              width: "3px",
              height: sub ? "12px" : "16px",
              borderRadius: "999px",
              backgroundColor: T.brandLight,
              boxShadow: T.indicatorGlow,
              translateY: "-50%",
            }}
            transition={springSnap}
          />
        )}

        {/* Icon */}
        <motion.span
          aria-hidden
          variants={{
            idle: { scale: 1 },
            hovered: { scale: active ? 1 : 1.1 },
          }}
          transition={springIcon}
          style={{
            display: "inline-flex",
            width: sub ? "16px" : "20px",
            height: sub ? "16px" : "20px",
            flexShrink: 0,
            alignItems: "center",
            justifyContent: "center",
            color: active ? T.activeIconColor : T.inactiveIconColor,
            transition: "color 0.15s ease",
          }}
        >
          {icon}
        </motion.span>

        {/* Label */}
        <span style={{ flex: 1 }}>{label}</span>

        {/* Badge */}
        {badgeCount > 0 && (
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 480, damping: 24 }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: "18px",
              height: "17px",
              borderRadius: "999px",
              padding: "0 5px",
              fontSize: "9px",
              fontWeight: 700,
              backgroundColor: T.badgeBg,
              color: T.badgeText,
              letterSpacing: "0.02em",
              boxShadow: "0 1px 4px rgba(245, 158, 11, 0.35)",
            }}
          >
            {badgeCount > 99 ? "99+" : badgeCount}
          </motion.span>
        )}
      </Link>
    </motion.li>
  );
}

/* ─── NavGroupRow ─── */

function NavGroupRow({
  group,
  pathname,
}: {
  group: NavGroup;
  pathname: string | null;
}) {
  const [expanded, setExpanded] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem(group.storageKey);
    return stored === null ? true : stored === "true";
  });

  const toggle = () => {
    setExpanded((prev) => {
      const next = !prev;
      localStorage.setItem(group.storageKey, String(next));
      return next;
    });
  };

  const isAnySubActive = group.items.some((item) => {
    if ("kind" in item && item.kind === "subgroup") {
      return pathname?.startsWith(item.matchPrefix) ?? false;
    }
    return item.matchPrefix
      ? pathname?.startsWith(item.matchPrefix)
      : pathname === (item as NavSubItem).href;
  });

  return (
    <li style={{ listStyle: "none" }}>
      {/* Group header */}
      <motion.button
        type="button"
        onClick={toggle}
        initial="idle"
        whileHover="hovered"
        animate="idle"
        className={css.navLink}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "8px 12px",
          width: "100%",
          borderRadius: "9px",
          background: "transparent",
          border: "none",
          textDecoration: "none",
          fontSize: "13.5px",
          fontWeight: 500,
          letterSpacing: "0.01em",
          lineHeight: 1.2,
          color: isAnySubActive ? T.activeTextColor : T.inactiveTextColor,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        {/* Hover overlay */}
        <motion.span
          aria-hidden
          variants={{ idle: { opacity: 0 }, hovered: { opacity: 1 } }}
          transition={easeFade}
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "9px",
            backgroundColor: T.hoverBg,
            pointerEvents: "none",
          }}
        />

        {/* Icon */}
        <span
          aria-hidden
          style={{
            display: "inline-flex",
            width: "20px",
            height: "20px",
            flexShrink: 0,
            alignItems: "center",
            justifyContent: "center",
            color: isAnySubActive ? T.activeIconColor : T.inactiveIconColor,
            transition: "color 0.15s ease",
          }}
        >
          {group.icon}
        </span>

        {/* Label */}
        <span style={{ flex: 1, textAlign: "left" }}>{group.label}</span>

        {/* Chevron */}
        <motion.span
          aria-hidden
          animate={{ rotate: expanded ? 0 : -90 }}
          transition={springCollapse}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "rgba(255,255,255,0.28)",
          }}
        >
          <CaretDown size={12} weight="bold" />
        </motion.span>
      </motion.button>

      {/* Sub-items */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.ul
            role="list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springCollapse}
            style={{
              position: "relative",
              overflow: "hidden",
              listStyle: "none",
              margin: "1px 0 0",
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: "1px",
            }}
          >
            <span
              aria-hidden
              style={{
                position: "absolute",
                left: "21px",
                top: "6px",
                bottom: "6px",
                width: "1px",
                borderRadius: "999px",
                backgroundColor: "rgba(255,255,255,0.18)",
                pointerEvents: "none",
              }}
            />
            {group.items.map((item) => {
              if ("kind" in item && item.kind === "subgroup") {
                return (
                  <NavSubGroupRow
                    key={item.label}
                    entry={item}
                    pathname={pathname}
                  />
                );
              }

              const subItem = item as NavSubItem;
              const active = subItem.matchPrefix
                ? !!pathname?.startsWith(subItem.matchPrefix)
                : pathname === subItem.href;

              return (
                <NavItemRow
                  key={subItem.href}
                  href={subItem.href}
                  label={subItem.label}
                  icon={subItem.icon}
                  active={active}
                  sub
                />
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </li>
  );
}

/* ─── NavSubGroupRow ─── */

function NavSubGroupRow({
  entry,
  pathname,
}: {
  entry: NavSubGroup;
  pathname: string | null;
}) {
  const [expanded, setExpanded] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem(entry.storageKey);
    return stored === null ? true : stored === "true";
  });

  const toggle = () => {
    setExpanded((prev) => {
      const next = !prev;
      localStorage.setItem(entry.storageKey, String(next));
      return next;
    });
  };

  const isAnySubActive = entry.items.some((item) =>
    item.matchPrefix
      ? pathname?.startsWith(item.matchPrefix)
      : pathname === item.href
  );

  return (
    <li style={{ listStyle: "none" }}>
      <motion.button
        type="button"
        onClick={toggle}
        initial="idle"
        whileHover="hovered"
        animate="idle"
        className={css.navLink}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "6px 12px 6px 36px",
          width: "100%",
          borderRadius: "9px",
          background: "transparent",
          border: "none",
          fontSize: "13px",
          fontWeight: 500,
          letterSpacing: "0.01em",
          lineHeight: 1.2,
          color: isAnySubActive ? T.activeTextColor : T.inactiveTextColor,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        {/* Hover overlay */}
        <motion.span
          aria-hidden
          variants={{ idle: { opacity: 0 }, hovered: { opacity: 1 } }}
          transition={easeFade}
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "9px",
            backgroundColor: T.hoverBg,
            pointerEvents: "none",
          }}
        />

        {/* Icon */}
        <span
          aria-hidden
          style={{
            display: "inline-flex",
            width: "16px",
            height: "16px",
            flexShrink: 0,
            alignItems: "center",
            justifyContent: "center",
            color: isAnySubActive ? T.activeIconColor : T.inactiveIconColor,
            transition: "color 0.15s ease",
          }}
        >
          {entry.icon}
        </span>

        {/* Label */}
        <span style={{ flex: 1, textAlign: "left" }}>{entry.label}</span>

        {/* Chevron */}
        <motion.span
          aria-hidden
          animate={{ rotate: expanded ? 0 : -90 }}
          transition={springCollapse}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "rgba(255,255,255,0.28)",
          }}
        >
          <CaretDown size={10} weight="bold" />
        </motion.span>
      </motion.button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.ul
            role="list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springCollapse}
            style={{
              position: "relative",
              overflow: "hidden",
              listStyle: "none",
              margin: "1px 0 0",
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: "1px",
            }}
          >
            {entry.items.map((item) => {
              const active = item.matchPrefix
                ? !!pathname?.startsWith(item.matchPrefix)
                : pathname === item.href;

              return (
                <NavItemRow
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={active}
                  sub
                />
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </li>
  );
}

/* ─── AdminSidebar ─── */

export function AdminSidebar({
  userName,
  userEmail,
  initials,
  avatarUrl = null,
}: {
  userName: string;
  userEmail: string;
  initials: string;
  avatarUrl?: string | null;
  pendingBlockCount: number;
  showTestData?: boolean;
}) {
  const pathname = usePathname();

  return (
    <aside
      aria-label="Admin navigation"
      className={css.sidebar}
      style={{
        position: "sticky",
        top: 0,
        height: "100vh",
        flexShrink: 0,
        background: `
          radial-gradient(ellipse 180% 28% at 50% 0%,
            rgba(2, 170, 235, 0.07) 0%,
            transparent 68%
          ),
          var(--color-navy)
        `,
      }}
    >
      {/* Logo */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "24px 0 18px",
        }}
      >
        <Link
          href="/admin"
          className={css.logoLink}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "2px",
            transform: "translateX(-16px)",
            textDecoration: "none",
          }}
        >
          <Image
            src="/brand/logo-mark-white-v2.png"
            alt="Proxy"
            width={48}
            height={48}
            style={{ width: "48px", height: "auto", flexShrink: 0 }}
          />
          <span
            style={{
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            Admin
          </span>
        </Link>
      </div>

      {/* Search + Notifications + Create */}
      <div
        style={{
          display: "flex",
          gap: "6px",
          padding: "0 14px 12px",
          alignItems: "center",
        }}
      >
        <SidebarSearch />
        <CreateMenu />
      </div>

      {/* Nav */}
      <nav
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "4px 10px 0",
          scrollbarWidth: "none",
        }}
      >
        <LayoutGroup>
          <ul
            role="list"
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: "2px",
            }}
          >
            {navEntries.map((entry) => {
              if (entry.kind === "group") {
                return (
                  <NavGroupRow
                    key={entry.label}
                    group={entry}
                    pathname={pathname}
                  />
                );
              }

              if (entry.kind === "subgroup") {
                return (
                  <NavSubGroupRow
                    key={entry.label}
                    entry={entry}
                    pathname={pathname}
                  />
                );
              }

              const active = entry.matchPrefix
                ? !!pathname?.startsWith(entry.matchPrefix)
                : pathname === entry.href;

              return (
                <NavItemRow
                  key={entry.href}
                  href={entry.href}
                  label={entry.label}
                  icon={entry.icon}
                  active={active}
                  badge={entry.badge}
                />
              );
            })}
          </ul>
        </LayoutGroup>
      </nav>

      <AdminSidebarFooter
        userName={userName}
        userEmail={userEmail}
        initials={initials}
        avatarUrl={avatarUrl}
      />
    </aside>
  );
}

/* ─── AdminTopBar (mobile header) ─── */

export function AdminTopBar({
  initials,
}: {
  userName: string;
  initials: string;
  pendingBlockCount?: number;
}) {
  const pathname = usePathname();

  const pageTitle = (() => {
    if (!pathname) return "";
    if (pathname === "/admin") return "";
    if (pathname.startsWith("/admin/workspaces")) return "Workspaces";
    if (pathname.startsWith("/admin/people")) return "People";
    if (pathname.startsWith("/admin/prospects")) return "Prospects";
    if (pathname.startsWith("/admin/properties")) return "Properties";
    if (pathname.startsWith("/admin/inbox")) return "Inbox";
    if (pathname.startsWith("/admin/tasks")) return "Tasks";
    if (pathname.startsWith("/admin/projects")) return "Projects";
    if (pathname.startsWith("/admin/paperwork")) return "Paperwork";
    if (pathname.startsWith("/admin/map")) return "Map";
    if (pathname.startsWith("/admin/help")) return "Help Center";
    if (pathname.startsWith("/admin/treasury")) return "Treasury";
    if (pathname.startsWith("/admin/calendar")) return "Calendar";
    if (pathname.startsWith("/admin/meetings")) return "Meetings";
    if (pathname.startsWith("/admin/finances")) return "Finances";
    if (pathname.startsWith("/admin/timeline")) return "Timeline";
    if (pathname.startsWith("/admin/guest-pulse")) return "Guest Pulse";
    return "";
  })();

  return (
    <header
      className={css.topBar}
      style={{
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "12px 16px",
        backgroundColor: "var(--color-navy)",
      }}
    >
      <Link
        href="/admin"
        className={css.logoLink}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          textDecoration: "none",
        }}
      >
        <Image
          src="/brand/logo-mark-white-v2.png"
          alt="Proxy"
          width={26}
          height={26}
          style={{ width: "26px", height: "auto", flexShrink: 0 }}
        />
        <span
          style={{
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.65)",
          }}
        >
          Admin
        </span>
      </Link>

      {pageTitle ? (
        <span
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: "14px",
            fontWeight: 600,
            color: "#ffffff",
          }}
        >
          {pageTitle}
        </span>
      ) : null}

      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <TopBarSearch />
        <CreateMenu placement="topbar" />
        <span
          style={{
            display: "flex",
            width: "32px",
            height: "32px",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "999px",
            fontSize: "11px",
            fontWeight: 600,
            backgroundColor: "rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.85)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          {initials}
        </span>
      </div>
    </header>
  );
}

/* ─── AdminIconRail (tablet, md–lg) ─── */

const adminRailItems: Array<{
  href: string;
  icon: ReactNode;
  label: string;
  matchPrefix?: string;
  matchPrefixes?: string[];
}> = [
  { href: "/admin", icon: <Gauge size={20} weight="duotone" />, label: "Today" },
  { href: "/admin/inbox", icon: <ChatsCircle size={20} weight="duotone" />, label: "Inbox", matchPrefix: "/admin/inbox" },
  { href: "/admin/tasks", icon: <ListChecks size={20} weight="duotone" />, label: "Tasks", matchPrefix: "/admin/tasks" },
  { href: "/admin/meetings", icon: <CalendarDots size={20} weight="duotone" />, label: "Meetings", matchPrefix: "/admin/meetings" },
  { href: "/admin/workspaces?view=active-owners", icon: <Stack size={20} weight="duotone" />, label: "Workspaces", matchPrefix: "/admin/workspaces" },
  {
    href: "/admin/people?mode=compact",
    icon: <ShareNetwork size={20} weight="duotone" />,
    label: "Relationships",
    matchPrefixes: ["/admin/prospects", "/admin/people", "/admin/vendors"],
  },
  {
    href: "/admin/properties",
    icon: <Buildings size={20} weight="duotone" />,
    label: "Operations",
    matchPrefixes: ["/admin/properties", "/admin/paperwork", "/admin/projects", "/admin/guest-pulse"],
  },
  { href: "/admin/finances", icon: <Receipt size={20} weight="duotone" />, label: "Finances", matchPrefix: "/admin/finances" },
];

export function AdminIconRail() {
  const pathname = usePathname();

  return (
    <aside
      aria-label="Admin navigation rail"
      className={css.rail}
      style={{
        position: "sticky",
        top: 0,
        height: "100vh",
        width: "60px",
        flexShrink: 0,
        borderRight: "1px solid rgba(255,255,255,0.06)",
        backgroundColor: "var(--color-navy)",
        padding: "16px 0",
      }}
    >
      {/* Logo */}
      <Link
        href="/admin"
        aria-label="Proxy Admin Home"
        className={css.railLink}
        style={{
          display: "flex",
          width: "36px",
          height: "36px",
          margin: "0 auto 24px",
          alignItems: "center",
          justifyContent: "center",
          textDecoration: "none",
        }}
      >
        <Image
          src="/brand/logo-mark-white-v2.png"
          alt="Proxy"
          width={24}
          height={24}
          style={{ width: "24px", height: "auto" }}
        />
      </Link>

      {/* Search trigger */}
      <button
        type="button"
        aria-label="Open search"
        onClick={() => openCommandPalette()}
        className={css.railLink}
        style={{
          display: "flex",
          width: "40px",
          height: "40px",
          margin: "0 auto 14px",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "10px",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "rgba(255,255,255,0.75)",
          cursor: "pointer",
          padding: 0,
          fontFamily: "inherit",
        }}
      >
        <MagnifyingGlass size={18} weight="duotone" />
      </button>

      {/* Nav */}
      <nav style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center", gap: "4px" }}>
        {adminRailItems.map((item) => {
          const active = item.matchPrefixes
            ? item.matchPrefixes.some((prefix) => pathname?.startsWith(prefix))
            : item.matchPrefix
            ? pathname?.startsWith(item.matchPrefix)
            : pathname === item.href;

          return (
            <motion.div
              key={item.href}
              initial="idle"
              whileHover="hovered"
              animate="idle"
              style={{ position: "relative" }}
            >
              <Link
                href={item.href}
                prefetch={shouldPrefetchAdminHref(item.href)}
                title={item.label}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={css.railLink}
                style={{
                  position: "relative",
                  display: "flex",
                  width: "40px",
                  height: "40px",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "8px",
                  textDecoration: "none",
                  color: active ? T.activeIconColor : T.inactiveIconColor,
                  backgroundColor: active ? "rgba(255,255,255,0.08)" : "transparent",
                }}
              >
                {/* Hover overlay */}
                {!active && (
                  <motion.span
                    aria-hidden
                    variants={{ idle: { opacity: 0 }, hovered: { opacity: 1 } }}
                    transition={easeFade}
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: "8px",
                      backgroundColor: T.hoverBg,
                      pointerEvents: "none",
                    }}
                  />
                )}
                {/* Active left indicator */}
                {active && (
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: 0,
                      top: "50%",
                      width: "3px",
                      height: "14px",
                      borderRadius: "999px",
                      backgroundColor: T.brandLight,
                      boxShadow: T.indicatorGlow,
                      transform: "translateY(-50%)",
                    }}
                  />
                )}
                {/* Icon */}
                <motion.span
                  aria-hidden
                  variants={{ idle: { scale: 1 }, hovered: { scale: active ? 1 : 1.08 } }}
                  transition={springIcon}
                >
                  {item.icon}
                </motion.span>
              </Link>
            </motion.div>
          );
        })}
      </nav>

      {/* Hamburger: opens the full sidebar as a drawer */}
      <button
        type="button"
        aria-label="Open sidebar"
        onClick={() => openSidebarDrawer()}
        className={css.railLink}
        style={{
          display: "flex",
          width: "40px",
          height: "40px",
          margin: "8px auto 6px",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "10px",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "rgba(255,255,255,0.75)",
          cursor: "pointer",
          padding: 0,
          fontFamily: "inherit",
        }}
      >
        <HamburgerIcon size={18} weight="duotone" />
      </button>
    </aside>
  );
}
