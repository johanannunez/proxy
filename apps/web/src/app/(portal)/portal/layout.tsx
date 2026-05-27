import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cookies } from "next/headers";
import {
  PortalSidebar,
  PortalIconRail,
} from "@/components/portal/PortalSidebar";
import { PortalAppBar, type OwnerOption } from "@/components/portal/PortalAppBar";
import { PortalHeaderProvider } from "@/components/portal/PortalHeaderContext";
import { PortalBottomNav } from "@/components/portal/PortalBottomNav";
import { CommandPalette } from "@/components/portal/CommandPalette";
import { NotificationsProvider } from "@/components/portal/NotificationsProvider";
import { ServiceWorkerRegistration } from "@/components/portal/ServiceWorkerRegistration";
import { ImpersonationBanner } from "@/components/portal/ImpersonationBanner";
import { PortalMain } from "@/components/portal/PortalMainContent";
import { getPortalNotificationPreferences } from "@/lib/portal/notification-preferences-server";
import { SignOutButton } from "./SignOutButton";

/** Inline unread count query (cannot call "use server" actions from server components) */
async function getUnreadCount(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<number> {
  const { data: conversations } = await supabase
    .from("conversations")
    .select("id");

  if (!conversations?.length) return 0;

  const convIds = conversations.map((c) => c.id);
  const { data: messages } = await supabase
    .from("messages")
    .select("id")
    .in("conversation_id", convIds)
    .neq("sender_id", userId);

  if (!messages?.length) return 0;

  const msgIds = messages.map((m) => m.id);
  const { data: reads } = await supabase
    .from("message_reads")
    .select("message_id")
    .eq("reader_id", userId)
    .in("message_id", msgIds);

  const readIds = new Set((reads ?? []).map((r) => r.message_id));
  return msgIds.filter((id) => !readIds.has(id)).length;
}

/**
 * Portal shell — wraps every /portal/* page.
 *
 * When the logged-in user is an admin and the `parcel_viewing_as` cookie is
 * set, the layout renders as the target owner: their name/avatar in the
 * sidebar, their data in every page, and an amber impersonation banner.
 * Regular owners never see any of this.
 *
 * NotificationsProvider owns the single realtime subscription so any
 * number of NotificationBell components (desktop sidebar, tablet rail,
 * mobile top bar) can render without opening multiple channels.
 */
export default async function PortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Always fetch the real user's profile to determine role.
  const { data: realProfile } = await supabase
    .from("profiles")
    .select("full_name, role, avatar_url")
    .eq("id", user.id)
    .single();

  const isAdmin = realProfile?.role === "admin";

  // --- Impersonation check (admin only) ---
  let isImpersonating = false;
  let viewingOwnerId: string | null = null;
  let ownerProfile: { id: string; full_name: string | null; email: string; avatar_url: string | null } | null = null;

  if (isAdmin) {
    const cookieStore = await cookies();
    const viewingAs = cookieStore.get("parcel_viewing_as")?.value ?? null;
    if (viewingAs) {
      const svc = createServiceClient();
      const { data: op } = await svc
        .from("profiles")
        .select("id, full_name, email, avatar_url, role")
        .eq("id", viewingAs)
        .single();
      if (op && op.role === "owner") {
        isImpersonating = true;
        viewingOwnerId = viewingAs;
        ownerProfile = {
          id: op.id,
          full_name: op.full_name,
          email: op.email,
          avatar_url: op.avatar_url,
        };
      }
    }
  }

  // The active user ID drives the setup check and the sidebar identity.
  const activeUserId = isImpersonating ? viewingOwnerId! : user.id;

  // Sidebar identity: show the owner being viewed, not Johan.
  const displayName = isImpersonating
    ? (ownerProfile!.full_name?.trim() || ownerProfile!.email.split("@")[0] || "Owner")
    : (realProfile?.full_name?.trim() || user.email?.split("@")[0] || "Owner");
  const displayEmail = isImpersonating ? ownerProfile!.email : (user.email ?? "");
  const displayAvatar = isImpersonating ? ownerProfile!.avatar_url : (realProfile?.avatar_url ?? null);

  const firstName = displayName.split(" ")[0] ?? displayName;

  function buildInitials(name: string) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "O";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  const initials = buildInitials(displayName);

  // Properties query for setup check — explicit owner filter when impersonating
  // (service client bypasses RLS so the filter is mandatory).
  const propertiesSelect =
    "id, property_type, address_line1, city, state, bedrooms, bathrooms, guest_capacity";

  const { data: properties } = isImpersonating
    ? await createServiceClient()
        .from("properties")
        .select(propertiesSelect)
        .eq("owner_id", activeUserId)
        .limit(50)
    : await supabase
        .from("properties")
        .select(propertiesSelect)
        .limit(50);

  // Setup is incomplete if: no properties, or any property missing key fields.
  const setupIncomplete =
    !properties ||
    properties.length === 0 ||
    properties.some(
      (p) =>
        !p.property_type ||
        !p.address_line1 ||
        !p.city ||
        !p.state ||
        p.bedrooms === null ||
        p.bathrooms === null ||
        p.guest_capacity === null,
    );

  // Fetch unread message count for sidebar badge
  const unreadMessageCount = await getUnreadCount(supabase, activeUserId);
  const notificationPreferences = await getPortalNotificationPreferences(user.id, supabase);

  // Fetch owners for the admin switcher dropdown (admin only, one query).
  let owners: OwnerOption[] = [];
  if (isAdmin) {
    const svc = createServiceClient();
    const { data: ownerRows } = await svc
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .eq("role", "owner")
      .order("full_name", { ascending: true });
    owners = (ownerRows ?? []).map((o) => ({
      id: o.id,
      full_name: o.full_name,
      email: o.email,
      avatar_url: o.avatar_url,
    }));
  }

  return (
    <NotificationsProvider userId={user.id} initialPreferences={notificationPreferences}>
      <PortalHeaderProvider>
        <div
          className="flex h-screen overflow-hidden"
          style={{ backgroundColor: "var(--color-off-white)" }}
        >
          <PortalIconRail />
          <PortalSidebar
            userName={displayName}
            userEmail={displayEmail}
            initials={initials}
            avatarUrl={displayAvatar}
            isAdmin={isAdmin}
            setupIncomplete={setupIncomplete}
            signOutSlot={<SignOutButton iconOnly />}
            unreadMessageCount={unreadMessageCount}
          />

          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <PortalAppBar
              firstName={firstName}
              owners={isAdmin ? owners : undefined}
              viewingAsUserId={viewingOwnerId}
            />
            {isImpersonating && ownerProfile ? (
              <ImpersonationBanner
                ownerName={ownerProfile.full_name?.trim() || ownerProfile.email}
              />
            ) : null}
            <PortalMain>
              {children}
            </PortalMain>
            <CommandPalette />
          </div>

          <PortalBottomNav
            isAdmin={isAdmin}
            signOutSlot={<SignOutButton />}
            userName={displayName}
            userEmail={displayEmail}
            initials={initials}
            avatarUrl={displayAvatar}
            unreadMessageCount={unreadMessageCount}
          />
          <ServiceWorkerRegistration />
        </div>
      </PortalHeaderProvider>
    </NotificationsProvider>
  );
}
