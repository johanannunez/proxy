import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceNotificationPreferences } from "@/lib/workspace/notification-preferences-server";
import { NotificationsClient } from "./NotificationsClient";

export const metadata: Metadata = {
  title: "Notifications",
};
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, read, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const items = (notifications ?? []).map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link,
    read: n.read,
    createdAt: n.created_at,
  }));
  const notificationPreferences = await getWorkspaceNotificationPreferences(user.id, supabase);

  return (
    <NotificationsClient
      initialItems={items}
      initialPreferences={notificationPreferences}
      userId={user.id}
    />
  );
}
