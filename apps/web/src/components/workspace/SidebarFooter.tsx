"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sun,
  Moon,
  GearSix,
  ShieldStar,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { useTheme } from "@/components/ThemeProvider";

function getAdminUrl(pathname: string): string {
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
    if (pathname.startsWith(prefix)) return dest;
  }
  return "/admin";
}

export function SidebarFooter({
  userName,
  userEmail,
  initials,
  avatarUrl = null,
  isAdmin = false,
  signOutSlot,
}: {
  userName: string;
  userEmail: string;
  initials: string;
  avatarUrl?: string | null;
  isAdmin?: boolean;
  signOutSlot: ReactNode;
}) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const adminHref = getAdminUrl(pathname ?? "");

  return (
    <div
      className="mx-3 mb-3 mt-auto border-t pt-2"
      style={{ borderColor: "var(--color-warm-gray-200)" }}
    >
      {/* Identity row */}
      <Link
        href="/workspace/account"
        className="flex items-center gap-2.5 rounded-lg px-3 pb-1.5 pt-2.5 transition-colors hover:bg-[var(--color-warm-gray-100)]"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={userName}
            className="h-[34px] w-[34px] shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-xs font-semibold tracking-wide"
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
            className="truncate text-[13.5px] font-semibold leading-tight"
            style={{ color: "var(--color-text-primary)" }}
          >
            {userName}
          </div>
          <div
            className="mt-px truncate text-[11.5px] leading-tight"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {userEmail}
          </div>
        </div>
      </Link>

      {/* Theme toggle */}
      <div className="py-0.5">
        <button
          type="button"
          onClick={toggleTheme}
          className="sidebar-footer-row"
        >
          {resolvedTheme === "dark" ? (
            <Sun size={18} weight="duotone" className="shrink-0" />
          ) : (
            <Moon size={18} weight="duotone" className="shrink-0" />
          )}
          {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
        </button>
      </div>

      {/* Icon action row */}
      <div
        className="mt-1 flex items-center gap-0.5 rounded-xl px-1 py-1"
        style={{ backgroundColor: "var(--color-warm-gray-50, #fafaf9)" }}
      >
        <Link
          href="/workspace/account"
          title="Account settings"
          className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[var(--color-warm-gray-100)]"
          style={{ color: "var(--color-text-secondary)" }}
        >
          <GearSix size={17} weight="duotone" />
        </Link>

        <div className="flex-1" />

        {isAdmin ? (
          <Link
            href={adminHref}
            title="Switch to Admin"
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
            style={{
              background: "linear-gradient(135deg, #F6A825 0%, #D4860A 100%)",
              color: "#fff",
            }}
          >
            <ShieldStar size={17} weight="duotone" />
          </Link>
        ) : null}

        {signOutSlot}
      </div>
    </div>
  );
}
