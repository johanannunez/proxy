"use client";

import { useState, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Gauge,
  ShareNetwork,
  ChatsCircle,
  List,
  DoorOpen,
  UserSwitch,
  ListChecks,
  GearSix,
  X,
  Power,
  Sun,
  Moon,
  CalendarDots,
  FolderOpen,
  Files,
  Funnel,
  Stack,
  Handshake,
  UserList,
  CaretDown,
  Receipt,
  Buildings,
  Pulse,
} from "@phosphor-icons/react";
import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "@/components/ThemeProvider";

/* ── Types ── */

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  activeIcon: ReactNode;
  matchPrefix?: string;
  matchPrefixes?: string[];
};

type SheetNavItem = {
  kind?: "item";
  href: string;
  label: string;
  icon: ReactNode;
  matchPrefix?: string;
};

type SheetNavGroup = {
  kind: "group";
  label: string;
  icon: ReactNode;
  storageKey: string;
  items: Array<{ href: string; label: string; icon: ReactNode; matchPrefix?: string }>;
};

type SheetEntry = SheetNavItem | SheetNavGroup;

/* ── Bottom tab items ── */

const navItems: NavItem[] = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: <Gauge size={22} weight="regular" />,
    activeIcon: <Gauge size={22} weight="fill" />,
  },
  {
    href: "/admin/inbox",
    label: "Inbox",
    icon: <ChatsCircle size={22} weight="regular" />,
    activeIcon: <ChatsCircle size={22} weight="fill" />,
    matchPrefix: "/admin/inbox",
  },
  {
    href: "/admin/tasks",
    label: "Tasks",
    icon: <ListChecks size={22} weight="regular" />,
    activeIcon: <ListChecks size={22} weight="fill" />,
    matchPrefix: "/admin/tasks",
  },
  {
    href: "/admin/meetings",
    label: "Meetings",
    icon: <CalendarDots size={22} weight="regular" />,
    activeIcon: <CalendarDots size={22} weight="fill" />,
    matchPrefix: "/admin/meetings",
  },
];

/* ── Sheet items (mirrors desktop sidebar) ── */

const sheetItems: SheetEntry[] = [
  { href: "/admin/workspaces?view=active-owners", label: "Workspaces", icon: <Stack size={19} weight="duotone" />, matchPrefix: "/admin/workspaces" },
  {
    kind: "group",
    label: "Relationships",
    icon: <ShareNetwork size={19} weight="duotone" />,
    storageKey: "mobile-nav-people-expanded",
    items: [
      { href: "/admin/people?mode=compact", label: "People", icon: <UserList size={17} weight="duotone" />, matchPrefix: "/admin/people" },
      { href: "/admin/vendors", label: "Vendors", icon: <Handshake size={17} weight="duotone" />, matchPrefix: "/admin/vendors" },
      { href: "/admin/prospects", label: "Prospects", icon: <Funnel size={17} weight="duotone" />, matchPrefix: "/admin/prospects" },
    ],
  },
  {
    kind: "group",
    label: "Operations",
    icon: <Buildings size={19} weight="duotone" />,
    storageKey: "mobile-nav-operations-expanded",
    items: [
      { href: "/admin/properties", label: "Properties", icon: <DoorOpen size={17} weight="duotone" />, matchPrefix: "/admin/properties" },
      { href: "/admin/documents", label: "Documents", icon: <Files size={17} weight="duotone" />, matchPrefix: "/admin/documents" },
      { href: "/admin/projects", label: "Projects", icon: <FolderOpen size={17} weight="duotone" />, matchPrefix: "/admin/projects" },
      { href: "/admin/guest-pulse", label: "Pulse", icon: <Pulse size={17} weight="duotone" />, matchPrefix: "/admin/guest-pulse" },
    ],
  },
  { href: "/admin/finances", label: "Finances", icon: <Receipt size={19} weight="duotone" />, matchPrefix: "/admin/finances" },
];

/* ── Helpers ── */

const mainNavPrefixes = [
  "/admin",
  "/admin/inbox",
  "/admin/tasks",
  "/admin/meetings",
];

function shouldPrefetchAdminHref(href: string): boolean {
  return !href.startsWith("/admin/workspaces");
}

const springCollapse = { type: "spring" as const, stiffness: 380, damping: 36, mass: 0.7 };

/* ── Sheet group row ── */

function SheetGroupRow({
  group,
  pathname,
  closeMore,
}: {
  group: SheetNavGroup;
  pathname: string | null;
  closeMore: () => void;
}) {
  const [expanded, setExpanded] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem(group.storageKey);
    return stored === null ? true : stored === "true";
  });

  const isAnySubActive = group.items.some((item) =>
    item.matchPrefix ? pathname?.startsWith(item.matchPrefix) : pathname === item.href
  );

  const toggle = () => {
    setExpanded((prev) => {
      const next = !prev;
      localStorage.setItem(group.storageKey, String(next));
      return next;
    });
  };

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium"
        style={{
          color: isAnySubActive ? "var(--color-brand-light)" : "rgba(255,255,255,0.65)",
          backgroundColor: "transparent",
          fontFamily: "inherit",
          cursor: "pointer",
          border: "none",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            color: isAnySubActive ? "var(--color-brand-light)" : "rgba(255,255,255,0.4)",
          }}
        >
          {group.icon}
        </span>
        <span style={{ flex: 1, textAlign: "left" }}>{group.label}</span>
        <motion.span
          animate={{ rotate: expanded ? 0 : -90 }}
          transition={springCollapse}
          style={{ display: "inline-flex", alignItems: "center", color: "rgba(255,255,255,0.28)" }}
        >
          <CaretDown size={12} weight="bold" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springCollapse}
            style={{ overflow: "hidden" }}
          >
            {group.items.map((item) => {
              const active = item.matchPrefix
                ? !!pathname?.startsWith(item.matchPrefix)
                : pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={shouldPrefetchAdminHref(item.href)}
                  onClick={closeMore}
                  className="flex items-center gap-3 rounded-lg text-sm font-medium"
                  style={{
                    padding: "8px 12px 8px 36px",
                    color: active ? "var(--color-brand-light)" : "rgba(255,255,255,0.55)",
                    backgroundColor: active ? "rgba(2, 170, 235, 0.09)" : "transparent",
                    textDecoration: "none",
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      color: active ? "var(--color-brand-light)" : "rgba(255,255,255,0.35)",
                    }}
                  >
                    {item.icon}
                  </span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                </Link>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Component ── */

export function AdminBottomNav({
  signOutSlot,
  userName,
  userEmail,
  initials,
  avatarUrl = null,
}: {
  pendingBlockCount?: number;
  signOutSlot: ReactNode;
  userName: string;
  userEmail: string;
  initials: string;
  avatarUrl?: string | null;
}) {
  const pathname = usePathname();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [moreOpen, setMoreOpen] = useState(false);

  const workspaceHref = (() => {
    const map: Array<[string, string]> = [
      ["/admin/properties", "/workspace/properties"],
      ["/admin/calendar", "/workspace/calendar"],
      ["/admin/meetings", "/workspace/meetings"],
      ["/admin/inbox", "/workspace/inbox"],
      ["/admin/tasks", "/workspace/tasks"],
      ["/admin/timeline", "/workspace/timeline"],
      ["/admin/account", "/workspace/account"],
      ["/admin/help", "/workspace/help"],
    ];
    for (const [prefix, dest] of map) {
      if (pathname?.startsWith(prefix)) return dest;
    }
    return "/workspace/home";
  })();

  const isActive = useCallback(
    (item: NavItem) => {
      if (item.matchPrefixes) return item.matchPrefixes.some((p) => !!pathname?.startsWith(p));
      if (item.matchPrefix) return !!pathname?.startsWith(item.matchPrefix);
      return pathname === item.href;
    },
    [pathname],
  );

  const isItemActive = useCallback(
    (item: SheetNavItem) => {
      if (item.matchPrefix) return pathname?.startsWith(item.matchPrefix);
      return pathname === item.href;
    },
    [pathname],
  );

  const isMoreActive =
    !mainNavPrefixes.some(
      (p) => pathname === p || (p !== "/admin" && pathname?.startsWith(p + "/")),
    ) && pathname?.startsWith("/admin") && pathname !== "/admin";

  const closeMore = useCallback(() => setMoreOpen(false), []);

  return (
    <>
      {/* Bottom Nav Bar */}
      <nav
        aria-label="Admin mobile navigation"
        className="fixed bottom-0 left-0 right-0 z-40 border-t md:hidden"
        style={{
          backgroundColor: "var(--color-navy)",
          borderColor: "rgba(255,255,255,0.08)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div className="flex h-16 items-stretch">
          {navItems.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={shouldPrefetchAdminHref(item.href)}
                onClick={closeMore}
                className="flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors"
                style={{
                  color: active
                    ? "var(--color-brand-light)"
                    : "rgba(255,255,255,0.45)",
                }}
              >
                {active ? item.activeIcon : item.icon}
                <span
                  className="text-[10px] font-semibold leading-none"
                  style={{
                    color: active
                      ? "var(--color-brand-light)"
                      : "rgba(255,255,255,0.45)",
                  }}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}

          {/* More button */}
          <button
            type="button"
            onClick={() => setMoreOpen(!moreOpen)}
            className="relative flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors"
            style={{
              color: moreOpen || isMoreActive
                ? "var(--color-brand-light)"
                : "rgba(255,255,255,0.45)",
            }}
            aria-label="More options"
            aria-expanded={moreOpen}
          >
            {moreOpen ? (
              <X size={22} weight="bold" />
            ) : (
              <List size={22} weight="bold" />
            )}
            <span
              className="text-[10px] font-semibold leading-none"
              style={{
                color: moreOpen || isMoreActive
                  ? "var(--color-brand-light)"
                  : "rgba(255,255,255,0.45)",
              }}
            >
              More
            </span>
          </button>
        </div>
      </nav>

      {/* More Sheet */}
      <AnimatePresence>
        {moreOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-30 bg-black/30 md:hidden"
              onClick={closeMore}
              aria-hidden="true"
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 340 }}
              className="fixed bottom-0 left-0 right-0 z-35 rounded-t-2xl border-t md:hidden"
              style={{
                backgroundColor: "var(--color-navy)",
                borderColor: "rgba(255,255,255,0.08)",
                paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)",
                maxHeight: "82vh",
                overflowY: "auto",
              }}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div
                  className="h-1 w-10 rounded-full"
                  style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
                />
              </div>

              {/* User identity */}
              <Link
                href="/admin/account"
                onClick={closeMore}
                className="mx-4 mt-2 mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors"
                style={{ textDecoration: "none" }}
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={userName}
                    className="h-9 w-9 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold tracking-wide"
                    style={{
                      backgroundColor: "rgba(255,255,255,0.08)",
                      color: "rgba(255,255,255,0.85)",
                    }}
                  >
                    {initials}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div
                    className="truncate text-[14px] font-semibold leading-tight"
                    style={{ color: "#ffffff" }}
                  >
                    {userName}
                  </div>
                  <div
                    className="mt-px truncate text-[12px] leading-tight"
                    style={{ color: "rgba(255,255,255,0.45)" }}
                  >
                    {userEmail}
                  </div>
                </div>
                <GearSix
                  size={16}
                  weight="regular"
                  style={{ color: "rgba(255,255,255,0.35)", flexShrink: 0 }}
                />
              </Link>

              {/* Divider */}
              <div
                className="mx-4 my-2 border-t"
                style={{ borderColor: "rgba(255,255,255,0.08)" }}
              />

              {/* Nav list */}
              <div className="px-4">
                {sheetItems.map((entry, i) => {
                  if (entry.kind === "group") {
                    return (
                      <SheetGroupRow
                        key={entry.label}
                        group={entry}
                        pathname={pathname}
                        closeMore={closeMore}
                      />
                    );
                  }

                  const active = isItemActive(entry);
                  return (
                    <Link
                      key={entry.href ?? i}
                      href={entry.href!}
                      prefetch={shouldPrefetchAdminHref(entry.href!)}
                      onClick={closeMore}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
                      style={{
                        color: active
                          ? "var(--color-brand-light)"
                          : "rgba(255,255,255,0.65)",
                        backgroundColor: active
                          ? "rgba(2, 170, 235, 0.09)"
                          : "transparent",
                        textDecoration: "none",
                      }}
                    >
                      <span
                        style={{
                          color: active
                            ? "var(--color-brand-light)"
                            : "rgba(255,255,255,0.4)",
                        }}
                      >
                        {entry.icon}
                      </span>
                      <span className="flex-1">{entry.label}</span>
                    </Link>
                  );
                })}
              </div>

              {/* Divider */}
              <div
                className="mx-4 my-2 border-t"
                style={{ borderColor: "rgba(255,255,255,0.08)" }}
              />

              {/* Footer actions */}
              <div className="px-4 pb-2">
                {/* Workspace link */}
                <Link
                  href={workspaceHref}
                  onClick={closeMore}
                  className="mb-2 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold"
                  style={{
                    background:
                      "linear-gradient(135deg, #02AAEB 0%, #1B77BE 100%)",
                    color: "#fff",
                    boxShadow: "0 2px 8px rgba(2, 170, 235, 0.25)",
                    textDecoration: "none",
                  }}
                >
                  <UserSwitch
                    size={18}
                    weight="duotone"
                    className="shrink-0"
                    style={{ color: "#fff" }}
                  />
                  Workspace
                </Link>

                {/* Dark/light mode toggle */}
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors"
                  style={{ color: "rgba(255,255,255,0.65)" }}
                >
                  {resolvedTheme === "dark" ? (
                    <Sun size={18} weight="duotone" style={{ color: "rgba(255,255,255,0.4)" }} />
                  ) : (
                    <Moon size={18} weight="duotone" style={{ color: "rgba(255,255,255,0.4)" }} />
                  )}
                  {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
                </button>

                {/* Sign out */}
                <button
                  type="button"
                  onClick={() => {
                    closeMore();
                    const btn = document.querySelector(
                      "[data-admin-signout]",
                    ) as HTMLButtonElement | null;
                    if (btn) btn.click();
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors"
                  style={{ color: "rgba(239, 68, 68, 0.85)" }}
                >
                  <Power
                    size={18}
                    weight="duotone"
                    style={{ color: "rgba(239, 68, 68, 0.6)" }}
                  />
                  Sign out
                </button>

                {/* Hidden real sign out slot */}
                <div className="hidden" aria-hidden="true">
                  {signOutSlot}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
