"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

/**
 * Get all notifications for the current owner.
 */
export async function getNotifications(limit = 50): Promise<{
  ok: boolean;
  notifications: NotificationItem[];
  unreadCount: number;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, notifications: [], unreadCount: 0 };

  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, read, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { ok: false, notifications: [], unreadCount: 0 };
  }

  const notifications: NotificationItem[] = (data ?? []).map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link,
    read: n.read,
    createdAt: n.created_at,
  }));

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { ok: true, notifications, unreadCount };
}

/**
 * Get just the unread notification count (lightweight, for the badge).
 */
export async function getUnreadNotificationCount(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return 0;

  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .eq("read", false);

  return count ?? 0;
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationRead(notificationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId)
    .eq("owner_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/workspace/notifications");
  return { success: true };
}

/**
 * Mark all notifications for the current owner as read.
 */
export async function markAllNotificationsRead() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("owner_id", user.id)
    .eq("read", false);

  if (error) return { error: error.message };

  revalidatePath("/workspace/notifications");
  return { success: true };
}
