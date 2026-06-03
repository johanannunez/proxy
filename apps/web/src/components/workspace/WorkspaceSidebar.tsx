"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  Buildings,
  FileText,
  ChatCircle,
  UsersThree,
  ListChecks,
  ClockCounterClockwise,
  Handshake,
  CurrencyDollar,
  GearSix,
  Question,
} from "@phosphor-icons/react";
import { type ReactNode } from "react";
import Image from "next/image";
import { SidebarFooter } from "@/components/workspace/SidebarFooter";
import { useTheme } from "@/components/ThemeProvider";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  matchPrefix?: string;
};

const mainNav: NavItem[] = [
  { href: "/workspace/home", label: "Home", icon: <House size={18} weight="duotone" /> },
  { href: "/workspace/inbox", label: "Inbox", icon: <ChatCircle size={18} weight="duotone" />, matchPrefix: "/workspace/inbox" },
  { href: "/workspace/tasks", label: "Tasks", icon: <ListChecks size={18} weight="duotone" />, matchPrefix: "/workspace/tasks" },
  { href: "/workspace/meetings", label: "Meetings", icon: <Handshake size={18} weight="duotone" />, matchPrefix: "/workspace/meetings" },
  { href: "/workspace/documents", label: "Documents", icon: <FileText size={18} weight="duotone" />, matchPrefix: "/workspace/documents" },
  { href: "/workspace/finances", label: "Finances", icon: <CurrencyDollar size={18} weight="duotone" />, matchPrefix: "/workspace/finances" },
  { href: "/workspace/properties", label: "Properties", icon: <Buildings size={18} weight="duotone" />, matchPrefix: "/workspace/properties" },
  { href: "/workspace/timeline", label: "Timeline", icon: <ClockCounterClockwise size={18} weight="duotone" />, matchPrefix: "/workspace/timeline" },
];

const supportNav: NavItem[] = [
  { href: "/workspace/team", label: "Team", icon: <UsersThree size={18} weight="duotone" />, matchPrefix: "/workspace/team" },
  { href: "/workspace/help", label: "Help Center", icon: <Question size={18} weight="duotone" />, matchPrefix: "/workspace/help" },
];

function NavItem({
  item,
  active,
  badge,
}: {
  item: NavItem;
  active: boolean;
  badge?: number;
}) {
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className="group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-[var(--color-warm-gray-50)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{
          color: active ? "var(--color-text-primary)" : "var(--color-text-secondary)",
          backgroundColor: active ? "var(--color-warm-gray-100)" : "transparent",
        }}
      >
        {active ? (
          <span
            aria-hidden
            className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full"
            style={{ backgroundColor: "var(--color-brand)" }}
          />
        ) : null}
        <span
          className="inline-flex h-5 w-5 items-center justify-center transition-colors"
          style={{ color: active ? "var(--color-brand)" : "var(--color-text-tertiary)" }}
        >
          {item.icon}
        </span>
        {item.label}
        {badge && badge > 0 ? (
          <span
            className="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold"
            style={{ backgroundColor: "var(--color-brand)", color: "#ffffff" }}
          >
            {badge > 99 ? "99+" : badge}
          </span>
        ) : null}
      </Link>
    </li>
  );
}

export function WorkspaceSidebar({
  userName,
  userEmail,
  initials,
  avatarUrl = null,
  isAdmin = false,
  setupIncomplete = false,
  signOutSlot,
  unreadMessageCount = 0,
}: {
  userName: string;
  userEmail: string;
  initials: string;
  avatarUrl?: string | null;
  isAdmin?: boolean;
  setupIncomplete?: boolean;
  signOutSlot: ReactNode;
  unreadMessageCount?: number;
}) {
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();

  const isActive = (item: NavItem) => {
    if (item.matchPrefix) return pathname?.startsWith(item.matchPrefix) ?? false;
    return pathname === item.href;
  };

  return (
    <aside
      aria-label="Primary navigation"
      className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r lg:flex"
      style={{
        backgroundColor: "var(--color-white)",
        borderColor: "var(--color-warm-gray-200)",
      }}
    >
      <div className="flex w-full items-center justify-center pt-[24px] pb-[18px]">
        <Link
          href="/workspace/home"
          className="flex -translate-x-4 items-center gap-0.5 focus-visible:outline-none"
        >
          <Image
            src={
              resolvedTheme === "dark"
                ? "/brand/logo-mark-white-v2.png"
                : "/brand/logo-mark-v2.png"
            }
            alt="Proxy"
            width={48}
            height={48}
            className="shrink-0"
          />
          <span
            className="text-[15px] font-bold uppercase tracking-[0.12em]"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Owner
          </span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pt-2">
        <ul className="flex flex-col gap-0.5">
          {mainNav.map((item) => (
            <NavItem
              key={item.href}
              item={item}
              active={isActive(item)}
              badge={item.href === "/workspace/inbox" ? unreadMessageCount : undefined}
            />
          ))}
        </ul>

        <div
          className="my-3 border-t"
          style={{ borderColor: "var(--color-warm-gray-200)" }}
        />

        <ul className="flex flex-col gap-0.5">
          {supportNav.map((item) => (
            <NavItem key={item.href} item={item} active={isActive(item)} />
          ))}
        </ul>
      </nav>

      <SidebarFooter
        userName={userName}
        userEmail={userEmail}
        initials={initials}
        avatarUrl={avatarUrl}
        isAdmin={isAdmin}
        signOutSlot={signOutSlot}
      />
    </aside>
  );
}


/* ─── Tablet Icon Rail (md to lg) ─── */

const railItems = [
  { href: "/workspace/home", icon: <House size={20} weight="duotone" />, label: "Home" },
  { href: "/workspace/inbox", icon: <ChatCircle size={20} weight="duotone" />, label: "Inbox", matchPrefix: "/workspace/inbox" },
  { href: "/workspace/documents", icon: <FileText size={20} weight="duotone" />, label: "Documents", matchPrefix: "/workspace/documents" },
  { href: "/workspace/properties", icon: <Buildings size={20} weight="duotone" />, label: "Properties", matchPrefix: "/workspace/properties" },
  { href: "/workspace/account", icon: <GearSix size={20} weight="duotone" />, label: "Account", matchPrefix: "/workspace/account" },
];

export function WorkspaceIconRail() {
  const pathname = usePathname();

  return (
    <aside
      aria-label="Navigation rail"
      className="sticky top-0 hidden h-screen w-[60px] shrink-0 flex-col items-center border-r py-4 md:flex lg:hidden"
      style={{
        backgroundColor: "var(--color-white)",
        borderColor: "var(--color-warm-gray-200)",
      }}
    >
      {/* Logo */}
      <Link
        href="/workspace/home"
        className="mb-3 flex h-8 w-8 items-center justify-center"
        aria-label="Proxy Home"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-mark-v2.png" alt="Proxy" width={24} height={24} />
      </Link>

      {/* Nav */}
      <nav className="flex flex-1 flex-col items-center gap-1">
        {railItems.map((item) => {
          const active = item.matchPrefix
            ? pathname?.startsWith(item.matchPrefix)
            : pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className="relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors"
              style={{
                color: active ? "var(--color-brand)" : "var(--color-text-tertiary)",
                backgroundColor: active ? "rgba(2, 170, 235, 0.08)" : "transparent",
              }}
            >
              {active ? (
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full"
                  style={{ backgroundColor: "var(--color-brand)" }}
                />
              ) : null}
              {item.icon}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
