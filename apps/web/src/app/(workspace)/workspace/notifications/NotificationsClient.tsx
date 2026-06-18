"use client";

import { useState, useEffect, useTransition } from "react";
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
  CheckSquare,
} from "@phosphor-icons/react";
import { markNotificationRead, markAllNotificationsRead, type NotificationItem } from "./actions";
import { createClient } from "@/lib/supabase/client";
import {
  PORTAL_NOTIFICATION_PREFS_EVENT,
  PORTAL_NOTIFICATION_PREFS_KEY,
  isWorkspaceNotificationEnabled,
  readWorkspaceNotificationPreferences,
  type WorkspaceNotificationPreferences,
} from "@/lib/workspace/notification-preferences";

type Filter = "all" | "unread";

export function NotificationsClient({
  initialItems,
  initialPreferences,
  userId,
}: {
  initialItems: NotificationItem[];
  initialPreferences: WorkspaceNotificationPreferences;
  userId: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>(initialItems);
  const [prefs, setPrefs] = useState<WorkspaceNotificationPreferences>(initialPreferences);
  const [filter, setFilter] = useState<Filter>("all");
  const [, startTransition] = useTransition();

  // Real-time subscription
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications-page-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `owner_id=eq.${userId}`,
        },
        () => {
          startTransition(() => router.refresh());
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, router]);

  // Sync with server-pushed updates from refresh
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PORTAL_NOTIFICATION_PREFS_KEY, JSON.stringify(initialPreferences));
      window.dispatchEvent(new Event(PORTAL_NOTIFICATION_PREFS_EVENT));
    } catch {
      // localStorage unavailable, keep server preferences in state
    }
    setPrefs(initialPreferences);
  }, [initialPreferences]);

  useEffect(() => {
    const syncPrefs = () => setPrefs(readWorkspaceNotificationPreferences());
    window.addEventListener("storage", syncPrefs);
    window.addEventListener(PORTAL_NOTIFICATION_PREFS_EVENT, syncPrefs);
    return () => {
      window.removeEventListener("storage", syncPrefs);
      window.removeEventListener(PORTAL_NOTIFICATION_PREFS_EVENT, syncPrefs);
    };
  }, []);

  const visibleItems = items.filter((n) => isWorkspaceNotificationEnabled(n.type, prefs));
  const filtered = filter === "unread" ? visibleItems.filter((n) => !n.read) : visibleItems;
  const unreadCount = visibleItems.filter((n) => !n.read).length;

  const handleClick = async (n: NotificationItem) => {
    if (!n.read) {
      await markNotificationRead(n.id);
      setItems((prev) => prev.map((item) => (item.id === n.id ? { ...item, read: true } : item)));
    }
    if (n.link) {
      router.push(n.link);
    }
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    setItems((prev) => prev.map((item) => ({ ...item, read: true })));
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Mark-all-read action sits above the filter tabs since the page
          title and subtitle are owned by the AppBar. */}
      {unreadCount > 0 ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors hover:bg-[var(--color-warm-gray-50)]"
            style={{
              borderColor: "var(--color-warm-gray-200)",
              color: "var(--color-text-primary)",
            }}
          >
            <CheckSquare size={14} weight="bold" />
            Mark all read
          </button>
        </div>
      ) : null}

      {/* Filter tabs */}
      <div
        className="flex gap-1 rounded-lg border p-1"
        style={{ borderColor: "var(--color-warm-gray-200)", backgroundColor: "var(--color-warm-gray-50)", width: "fit-content" }}
      >
        <button
          type="button"
          onClick={() => setFilter("all")}
          className="rounded px-4 py-1.5 text-xs font-semibold transition-colors"
          style={{
            backgroundColor: filter === "all" ? "var(--color-white)" : "transparent",
            color: filter === "all" ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
            boxShadow: filter === "all" ? "0 1px 2px rgba(0,0,0,0.04)" : "none",
          }}
        >
          All ({visibleItems.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter("unread")}
          className="rounded px-4 py-1.5 text-xs font-semibold transition-colors"
          style={{
            backgroundColor: filter === "unread" ? "var(--color-white)" : "transparent",
            color: filter === "unread" ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
            boxShadow: filter === "unread" ? "0 1px 2px rgba(0,0,0,0.04)" : "none",
          }}
        >
          Unread ({unreadCount})
        </button>
      </div>

      {/* List */}
      <div
        className="overflow-hidden rounded-xl border"
        style={{ borderColor: "var(--color-warm-gray-200)", backgroundColor: "var(--color-white)" }}
      >
        {filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Bell size={36} weight="duotone" className="mx-auto" style={{ color: "var(--color-warm-gray-200)" }} />
            <p className="mt-3 text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
              {filter === "unread" ? "No unread notifications" : "No notifications yet"}
            </p>
            <p className="mt-1 text-xs" style={{ color: "var(--color-text-tertiary)" }}>
              {filter === "unread"
                ? "You're all caught up."
                : "We'll let you know when something happens."}
            </p>
          </div>
        ) : (
          <ul>
            {filtered.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => handleClick(n)}
                  className="flex w-full gap-4 border-b px-6 py-4 text-left transition-colors hover:bg-[var(--color-warm-gray-50)]"
                  style={{
                    borderColor: "var(--color-warm-gray-100)",
                    backgroundColor: !n.read ? "rgba(2, 170, 235, 0.02)" : "transparent",
                  }}
                >
                  <NotificationIcon type={n.type} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p
                        className="text-sm font-semibold"
                        style={{ color: "var(--color-text-primary)" }}
                      >
                        {n.title}
                      </p>
                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className="text-[11px]"
                          style={{ color: "var(--color-text-tertiary)" }}
                        >
                          {formatRelative(n.createdAt)}
                        </span>
                        {!n.read ? (
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: "var(--color-brand)" }}
                          />
                        ) : null}
                      </div>
                    </div>
                    <p
                      className="mt-1 text-sm"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      {n.body}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ─── Helpers ─── */

function NotificationIcon({ type }: { type: string }) {
  const iconMap: Record<string, { icon: typeof Bell; bg: string; color: string }> = {
    message_received: { icon: ChatCircle, bg: "rgba(2, 170, 235, 0.1)", color: "var(--color-brand)" },
    announcement: { icon: Megaphone, bg: "rgba(2, 170, 235, 0.1)", color: "var(--color-brand)" },
    block_approved: { icon: CheckCircle, bg: "rgba(22, 163, 74, 0.08)", color: "var(--color-success)" },
    block_denied: { icon: XCircle, bg: "rgba(220, 38, 38, 0.08)", color: "var(--color-error)" },
    payout_processed: { icon: CurrencyDollar, bg: "rgba(245, 158, 11, 0.08)", color: "#d97706" },
    receipt_available: { icon: CurrencyDollar, bg: "rgba(245, 158, 11, 0.08)", color: "#d97706" },
    new_booking: { icon: CalendarCheck, bg: "rgba(2, 170, 235, 0.1)", color: "var(--color-brand)" },
    setup_reminder: { icon: ClipboardText, bg: "var(--color-warm-gray-100)", color: "var(--color-text-secondary)" },
  };

  const config = iconMap[type] ?? { icon: Bell, bg: "var(--color-warm-gray-100)", color: "var(--color-text-secondary)" };
  const Icon = config.icon;

  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
      style={{ backgroundColor: config.bg }}
    >
      <Icon size={18} weight="duotone" style={{ color: config.color }} />
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
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
