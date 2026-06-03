"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCircle,
  XCircle,
  CurrencyDollar,
  CalendarCheck,
  Megaphone,
  ChatCircle,
  ClipboardText,
  ArrowRight,
} from "@phosphor-icons/react";
import type { NotificationItem } from "@/app/(workspace)/workspace/notifications/actions";
import { useNotifications } from "@/components/workspace/NotificationsProvider";

export function NotificationBell({
  align = "left",
}: {
  align?: "left" | "right";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, loading, markOneRead, markAllRead } =
    useNotifications();

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleNotificationClick = async (n: NotificationItem) => {
    if (!n.read) {
      await markOneRead(n.id);
    }
    setOpen(false);
    if (n.link) {
      router.push(n.link);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-[var(--color-warm-gray-100)]"
        style={{ color: "var(--color-text-secondary)" }}
        aria-label="Notifications"
      >
        <Bell size={18} weight="duotone" />
        {unreadCount > 0 ? (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
            style={{ backgroundColor: "var(--color-brand)" }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className={`absolute top-full z-50 mt-2 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border shadow-lg ${
            align === "right" ? "right-0" : "left-0"
          }`}
          style={{
            backgroundColor: "var(--color-white)",
            borderColor: "var(--color-warm-gray-200)",
            boxShadow: "0 20px 50px -12px rgba(0,0,0,0.15)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between border-b px-4 py-3"
            style={{ borderColor: "var(--color-warm-gray-200)" }}
          >
            <div>
              <h3
                className="text-sm font-semibold"
                style={{ color: "var(--color-text-primary)" }}
              >
                Notifications
              </h3>
              {unreadCount > 0 ? (
                <p
                  className="mt-0.5 text-[11px]"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  {unreadCount} unread
                </p>
              ) : null}
            </div>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={markAllRead}
                className="text-[11px] font-medium transition-colors hover:underline"
                style={{ color: "var(--color-brand)" }}
              >
                Mark all read
              </button>
            ) : null}
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div
                className="px-4 py-6 text-center text-xs"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Bell
                  size={28}
                  weight="duotone"
                  className="mx-auto"
                  style={{ color: "var(--color-warm-gray-200)" }}
                />
                <p
                  className="mt-2 text-sm"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  No notifications yet
                </p>
                <p
                  className="mt-1 text-xs"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  We&apos;ll let you know when something happens.
                </p>
              </div>
            ) : (
              <ul>
                {notifications.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleNotificationClick(n)}
                      className="flex w-full gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-[var(--color-warm-gray-50)]"
                      style={{
                        borderColor: "var(--color-warm-gray-100)",
                        backgroundColor: !n.read
                          ? "rgba(2, 170, 235, 0.03)"
                          : "transparent",
                      }}
                    >
                      <NotificationIcon type={n.type} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className="text-sm font-medium leading-snug"
                            style={{ color: "var(--color-text-primary)" }}
                          >
                            {n.title}
                          </p>
                          {!n.read ? (
                            <span
                              className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{ backgroundColor: "var(--color-brand)" }}
                            />
                          ) : null}
                        </div>
                        <p
                          className="mt-0.5 line-clamp-2 text-xs"
                          style={{ color: "var(--color-text-secondary)" }}
                        >
                          {n.body}
                        </p>
                        <p
                          className="mt-1 text-[10px]"
                          style={{ color: "var(--color-text-tertiary)" }}
                        >
                          {formatRelative(n.createdAt)}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div
            className="border-t px-4 py-2.5"
            style={{
              borderColor: "var(--color-warm-gray-200)",
              backgroundColor: "var(--color-warm-gray-50)",
            }}
          >
            <Link
              href="/workspace/notifications"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1 text-xs font-medium transition-colors hover:underline"
              style={{ color: "var(--color-brand)" }}
            >
              View all notifications
              <ArrowRight size={11} weight="bold" />
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ─── Helpers ─── */

function NotificationIcon({ type }: { type: string }) {
  const iconMap: Record<
    string,
    { icon: typeof Bell; bg: string; color: string }
  > = {
    message_received: {
      icon: ChatCircle,
      bg: "rgba(2, 170, 235, 0.1)",
      color: "var(--color-brand)",
    },
    announcement: {
      icon: Megaphone,
      bg: "rgba(2, 170, 235, 0.1)",
      color: "var(--color-brand)",
    },
    block_approved: {
      icon: CheckCircle,
      bg: "rgba(22, 163, 74, 0.08)",
      color: "var(--color-success)",
    },
    block_denied: {
      icon: XCircle,
      bg: "rgba(220, 38, 38, 0.08)",
      color: "var(--color-error)",
    },
    payout_processed: {
      icon: CurrencyDollar,
      bg: "rgba(245, 158, 11, 0.08)",
      color: "#d97706",
    },
    receipt_available: {
      icon: CurrencyDollar,
      bg: "rgba(245, 158, 11, 0.08)",
      color: "#d97706",
    },
    new_booking: {
      icon: CalendarCheck,
      bg: "rgba(2, 170, 235, 0.1)",
      color: "var(--color-brand)",
    },
    setup_reminder: {
      icon: ClipboardText,
      bg: "var(--color-warm-gray-100)",
      color: "var(--color-text-secondary)",
    },
  };

  const config = iconMap[type] ?? {
    icon: Bell,
    bg: "var(--color-warm-gray-100)",
    color: "var(--color-text-secondary)",
  };
  const Icon = config.icon;

  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
      style={{ backgroundColor: config.bg }}
    >
      <Icon size={16} weight="duotone" style={{ color: config.color }} />
    </span>
  );
}

function formatRelative(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
