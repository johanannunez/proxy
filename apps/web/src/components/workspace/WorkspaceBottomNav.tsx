"use client";

import { useState, useCallback, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  Buildings,
  ChatCircle,
  List,
  FileText,
  GearSix,
  Question,
  Sun,
  Moon,
  X,
  ShieldStar,
  ListChecks,
  ClockCounterClockwise,
  UsersThree,
  Handshake,
  CurrencyDollar,
  CaretDown,
} from "@phosphor-icons/react";
import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "@/components/ThemeProvider";

type SheetNavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  matchPrefix?: string;
};

const overviewItems: SheetNavItem[] = [
  { href: "/workspace/home", label: "Home", icon: <House size={19} weight="duotone" /> },
  { href: "/workspace/inbox", label: "Inbox", icon: <ChatCircle size={19} weight="duotone" />, matchPrefix: "/workspace/inbox" },
  { href: "/workspace/tasks", label: "Tasks", icon: <ListChecks size={19} weight="duotone" />, matchPrefix: "/workspace/tasks" },
  { href: "/workspace/meetings", label: "Meetings", icon: <Handshake size={19} weight="duotone" />, matchPrefix: "/workspace/meetings" },
  { href: "/workspace/documents", label: "Documents", icon: <FileText size={19} weight="duotone" />, matchPrefix: "/workspace/documents" },
  { href: "/workspace/finances", label: "Finances", icon: <CurrencyDollar size={19} weight="duotone" />, matchPrefix: "/workspace/finances" },
  { href: "/workspace/properties", label: "Properties", icon: <Buildings size={19} weight="duotone" />, matchPrefix: "/workspace/properties" },
  { href: "/workspace/timeline", label: "Timeline", icon: <ClockCounterClockwise size={19} weight="duotone" />, matchPrefix: "/workspace/timeline" },
];

const activityItems: SheetNavItem[] = [];

const resourcesItems: SheetNavItem[] = [
  { href: "/workspace/team", label: "Team", icon: <UsersThree size={19} weight="duotone" />, matchPrefix: "/workspace/team" },
  { href: "/workspace/help", label: "Help Center", icon: <Question size={19} weight="duotone" />, matchPrefix: "/workspace/help" },
];

const sheetSections = [
  { label: "Navigation", items: overviewItems },
  { label: "Resources", items: resourcesItems },
];

const mainNavPrefixes = [
  "/workspace/home",
  "/workspace/inbox",
  "/workspace/tasks",
  "/workspace/meetings",
];

function getActiveSection(pathname: string | null): string {
  if (!pathname) return "Overview";
  if (overviewItems.some((i) => i.matchPrefix ? pathname.startsWith(i.matchPrefix) : pathname === i.href)) return "Overview";
  if (activityItems.some((i) => i.matchPrefix ? pathname.startsWith(i.matchPrefix) : pathname === i.href)) return "Activity";
  if (resourcesItems.some((i) => i.matchPrefix ? pathname.startsWith(i.matchPrefix) : pathname === i.href)) return "Resources";
  return "Overview";
}

const mainNavItems = [
  { href: "/workspace/home", label: "Home", icon: <House size={22} weight="regular" />, activeIcon: <House size={22} weight="fill" /> },
  { href: "/workspace/inbox", label: "Inbox", icon: <ChatCircle size={22} weight="regular" />, activeIcon: <ChatCircle size={22} weight="fill" />, matchPrefix: "/workspace/inbox" },
  { href: "/workspace/tasks", label: "Tasks", icon: <ListChecks size={22} weight="regular" />, activeIcon: <ListChecks size={22} weight="fill" />, matchPrefix: "/workspace/tasks" },
  { href: "/workspace/meetings", label: "Meetings", icon: <Handshake size={22} weight="regular" />, activeIcon: <Handshake size={22} weight="fill" />, matchPrefix: "/workspace/meetings" },
];

export function WorkspaceBottomNav({
  isAdmin = false,
  signOutSlot,
  userName,
  userEmail,
  initials,
  avatarUrl = null,
  unreadMessageCount = 0,
}: {
  isAdmin?: boolean;
  signOutSlot: ReactNode;
  userName: string;
  userEmail: string;
  initials: string;
  avatarUrl?: string | null;
  unreadMessageCount?: number;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [openSection, setOpenSection] = useState<string>(() => getActiveSection(pathname));

  const adminHref = (() => {
    const map: Array<[string, string]> = [
      ["/workspace/properties", "/admin/properties"],
      ["/workspace/calendar", "/admin/calendar"],
      ["/workspace/meetings", "/admin/meetings"],
      ["/workspace/payouts", "/admin/payouts"],
      ["/workspace/inbox", "/admin/inbox"],
      ["/workspace/tasks", "/admin/tasks"],
      ["/workspace/timeline", "/admin/timeline"],
      ["/workspace/reserve", "/admin/block-requests"],
      ["/workspace/account", "/admin/account"],
      ["/workspace/help", "/admin/help"],
    ];
    for (const [prefix, dest] of map) {
      if (pathname?.startsWith(prefix)) return dest;
    }
    return "/admin";
  })();
  const { resolvedTheme, toggleTheme } = useTheme();

  // When sheet opens, snap to the section matching the active route.
  useEffect(() => {
    if (moreOpen) {
       
      setOpenSection(getActiveSection(pathname));
    }
  }, [moreOpen, pathname]);

  const isItemActive = useCallback(
    (item: SheetNavItem) => {
      if (item.matchPrefix) return pathname?.startsWith(item.matchPrefix);
      return pathname === item.href;
    },
    [pathname],
  );

  const isTabActive = useCallback(
    (item: (typeof mainNavItems)[number]) => {
      if (item.matchPrefix) return pathname?.startsWith(item.matchPrefix);
      return pathname === item.href;
    },
    [pathname],
  );

  const isMoreActive =
    !mainNavPrefixes.some((p) => pathname === p || pathname?.startsWith(p + "/")) &&
    pathname?.startsWith("/portal");

  const closeMore = useCallback(() => setMoreOpen(false), []);

  return (
    <>
      {/* Bottom Tab Bar */}
      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-0 left-0 right-0 z-40 border-t md:hidden"
        style={{
          backgroundColor: "var(--color-white)",
          borderColor: "var(--color-warm-gray-200)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div className="flex h-16 items-stretch">
          {mainNavItems.map((item) => {
            const active = isTabActive(item);
            const showBadge = item.label === "Inbox" && unreadMessageCount > 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMore}
                className="relative flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors"
                style={{ color: active ? "var(--color-brand)" : "var(--color-text-tertiary)" }}
              >
                <span className="relative">
                  {active ? item.activeIcon : item.icon}
                  {showBadge ? (
                    <span
                      className="absolute -right-2 -top-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full px-0.5 text-[9px] font-bold"
                      style={{ backgroundColor: "var(--color-brand)", color: "#ffffff" }}
                    >
                      {unreadMessageCount > 99 ? "99+" : unreadMessageCount}
                    </span>
                  ) : null}
                </span>
                <span
                  className="text-[10px] font-semibold leading-none"
                  style={{ color: active ? "var(--color-brand)" : "var(--color-text-tertiary)" }}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}

          {/* More button — right side */}
          <button
            type="button"
            onClick={() => setMoreOpen(!moreOpen)}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors"
            style={{
              color: moreOpen || isMoreActive ? "var(--color-brand)" : "var(--color-text-tertiary)",
            }}
            aria-label="More options"
            aria-expanded={moreOpen}
          >
            {moreOpen ? <X size={22} weight="bold" /> : <List size={22} weight="bold" />}
            <span
              className="text-[10px] font-semibold leading-none"
              style={{
                color: moreOpen || isMoreActive ? "var(--color-brand)" : "var(--color-text-tertiary)",
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
                backgroundColor: "var(--color-white)",
                borderColor: "var(--color-warm-gray-200)",
                paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)",
                maxHeight: "82vh",
                overflowY: "auto",
              }}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div
                  className="h-1 w-10 rounded-full"
                  style={{ backgroundColor: "var(--color-warm-gray-300)" }}
                />
              </div>

              {/* User identity */}
              <Link
                href="/workspace/account"
                onClick={closeMore}
                className="mx-4 mt-2 mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[var(--color-warm-gray-50)]"
              >
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt={userName}
                    className="h-9 w-9 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold tracking-wide"
                    style={{
                      backgroundColor: "var(--color-warm-gray-100)",
                      color: "var(--color-text-primary)",
                    }}
                  >
                    {initials}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div
                    className="truncate text-[14px] font-semibold leading-tight"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {userName}
                  </div>
                  <div
                    className="mt-px truncate text-[12px] leading-tight"
                    style={{ color: "var(--color-text-tertiary)" }}
                  >
                    {userEmail}
                  </div>
                </div>
                <GearSix
                  size={16}
                  weight="regular"
                  style={{ color: "var(--color-text-tertiary)", flexShrink: 0 }}
                />
              </Link>

              {/* Divider */}
              <div
                className="mx-4 my-2 border-t"
                style={{ borderColor: "var(--color-warm-gray-200)" }}
              />

              {/* Accordion sections */}
              <div className="px-4">
                {sheetSections.map((section) => {
                  const isOpen = openSection === section.label;
                  return (
                    <div key={section.label} className="mb-1">
                      {/* Section header */}
                      <button
                        type="button"
                        onClick={() => setOpenSection(isOpen ? "" : section.label)}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 transition-colors hover:bg-[var(--color-warm-gray-50)]"
                        aria-expanded={isOpen}
                      >
                        <span
                          className="text-[11px] font-semibold uppercase tracking-[0.14em]"
                          style={{ color: "var(--color-text-tertiary)" }}
                        >
                          {section.label}
                        </span>
                        <CaretDown
                          size={11}
                          weight="bold"
                          className="transition-transform duration-200"
                          style={{
                            color: "var(--color-text-tertiary)",
                            transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)",
                          }}
                        />
                      </button>

                      {/* Items with left-border treatment */}
                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.18, ease: "easeInOut" }}
                            style={{ overflow: "hidden" }}
                          >
                            <div
                              className="ml-3 pl-3 pb-1"
                              style={{
                                borderLeft: "2px solid var(--color-warm-gray-200)",
                              }}
                            >
                              {section.items.map((item) => {
                                const active = isItemActive(item);
                                return (
                                  <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={closeMore}
                                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
                                    style={{
                                      color: active
                                        ? "var(--color-brand)"
                                        : "var(--color-text-secondary)",
                                      backgroundColor: active
                                        ? "rgba(2, 170, 235, 0.06)"
                                        : "transparent",
                                    }}
                                  >
                                    <span
                                      style={{
                                        color: active
                                          ? "var(--color-brand)"
                                          : "var(--color-text-tertiary)",
                                      }}
                                    >
                                      {item.icon}
                                    </span>
                                    {item.label}
                                  </Link>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>

              {/* Divider */}
              <div
                className="mx-4 my-2 border-t"
                style={{ borderColor: "var(--color-warm-gray-200)" }}
              />

              {/* Footer actions */}
              <div className="px-4 pb-2">
                {isAdmin ? (
                  <Link
                    href={adminHref}
                    onClick={closeMore}
                    className="mb-2 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold"
                    style={{
                      background: "linear-gradient(135deg, #F6A825 0%, #D4860A 100%)",
                      color: "#fff",
                      boxShadow: "0 2px 8px rgba(196, 120, 10, 0.28)",
                      textDecoration: "none",
                    }}
                  >
                    <ShieldStar size={18} weight="duotone" className="shrink-0" style={{ color: "#fff" }} />
                    Admin
                  </Link>
                ) : null}

                <button
                  type="button"
                  onClick={toggleTheme}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-[var(--color-warm-gray-50)]"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {resolvedTheme === "dark" ? (
                    <Sun size={18} weight="duotone" style={{ color: "var(--color-text-tertiary)" }} />
                  ) : (
                    <Moon size={18} weight="duotone" style={{ color: "var(--color-text-tertiary)" }} />
                  )}
                  {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
                </button>

                <div className="mt-1">{signOutSlot}</div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
