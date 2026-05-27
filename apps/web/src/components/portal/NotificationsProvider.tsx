"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationItem,
} from "@/app/(portal)/portal/notifications/actions";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_PORTAL_NOTIFICATION_PREFS,
  isPortalNotificationEnabled,
  PORTAL_NOTIFICATION_PREFS_EVENT,
  PORTAL_NOTIFICATION_PREFS_KEY,
  readPortalNotificationPreferences,
  type PortalNotificationPreferences,
} from "@/lib/portal/notification-preferences";

type NotificationsContextValue = {
  notifications: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markOneRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(
  null,
);

/**
 * Single owner of the notifications subscription for the entire portal.
 *
 * Mounted once at the portal layout. Any number of NotificationBell
 * components can read from this context without each one creating its
 * own Supabase realtime channel. Before this existed, multiple bells
 * (desktop sidebar, tablet icon rail, mobile top bar) would each open
 * their own channel with the same name, which crashed hydration.
 */
export function NotificationsProvider({
  userId,
  initialPreferences = DEFAULT_PORTAL_NOTIFICATION_PREFS,
  children,
}: {
  userId: string;
  initialPreferences?: PortalNotificationPreferences;
  children: ReactNode;
}) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [prefs, setPrefs] = useState<PortalNotificationPreferences>(initialPreferences);
  const [loading, setLoading] = useState(false);
  const loadInFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (loadInFlight.current) return;
    loadInFlight.current = true;
    setLoading(true);
    try {
      const result = await getNotifications(20);
      setNotifications(result.notifications);
    } finally {
      setLoading(false);
      loadInFlight.current = false;
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        PORTAL_NOTIFICATION_PREFS_KEY,
        JSON.stringify(initialPreferences),
      );
    } catch {
      // localStorage unavailable, keep server preferences in state
    }
    setPrefs(initialPreferences);
  }, [initialPreferences]);

  useEffect(() => {
    const syncPrefs = () => setPrefs(readPortalNotificationPreferences());
    window.addEventListener("storage", syncPrefs);
    window.addEventListener(PORTAL_NOTIFICATION_PREFS_EVENT, syncPrefs);
    return () => {
      window.removeEventListener("storage", syncPrefs);
      window.removeEventListener(PORTAL_NOTIFICATION_PREFS_EVENT, syncPrefs);
    };
  }, []);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime subscription (singleton for the whole portal)
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `owner_id=eq.${userId}`,
        },
        () => {
          refresh();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `owner_id=eq.${userId}`,
        },
        () => {
          refresh();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  const markOneRead = useCallback(
    async (id: string) => {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
    },
    [],
  );

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const visibleNotifications = useMemo(
    () => notifications.filter((n) => isPortalNotificationEnabled(n.type, prefs)),
    [notifications, prefs],
  );
  const unreadCount = useMemo(
    () => visibleNotifications.filter((n) => !n.read).length,
    [visibleNotifications],
  );

  const value = useMemo<NotificationsContextValue>(
    () => ({
      notifications: visibleNotifications,
      unreadCount,
      loading,
      refresh,
      markOneRead,
      markAllRead,
    }),
    [visibleNotifications, unreadCount, loading, refresh, markOneRead, markAllRead],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    // Return a safe default so components don't crash if the provider
    // isn't mounted (e.g., during server render or in a non-portal context)
    return {
      notifications: [],
      unreadCount: 0,
      loading: false,
      refresh: async () => {},
      markOneRead: async () => {},
      markAllRead: async () => {},
    };
  }
  return ctx;
}
