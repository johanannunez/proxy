import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminSidebar, AdminIconRail, AdminTopBar as AdminTopBarLegacy } from "@/components/admin/AdminSidebar";
import { AdminBottomNav } from "@/components/admin/AdminBottomNav";
import { AdminSignOutButton } from "@/components/admin/AdminSignOutButton";
import { PullToRefresh } from "@/components/workspace/PullToRefresh";
import { AdminTopBar as AdminTopBarNew } from "@/components/admin/chrome/AdminTopBar";
import { CreateScopeProvider } from "@/components/admin/chrome/CreateScopeContext";
import { CreateModal } from "@/components/admin/chrome/CreateModal";
import { TopBarSlotsProvider } from "@/components/admin/chrome/TopBarSlotsContext";
import { CommandPalette } from "@/components/admin/chrome/CommandPalette";
import { QuickCapture } from "@/components/admin/chrome/QuickCapture";
import { SidebarDrawer } from "@/components/admin/chrome/SidebarDrawer";
import { NotificationPopover } from "@/components/admin/chrome/NotificationPopover";
import { HelpSupportModal } from "@/components/admin/HelpSupportModal";
import { AdminAIChatTrigger } from "@/components/admin/AdminAIChatTrigger";

/**
 * Admin layout with dark vertical sidebar.
 *
 * Authorization: proxy.ts redirects non-admins to /portal/dashboard.
 * We double-check here to prevent any direct-render bypass.
 */
export default async function AdminLayout({
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, avatar_url, show_test_data")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    redirect("/workspace/home");
  }

  const { count: pendingBlockCount } = await supabase
    .from("block_requests")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  const fullName =
    profile?.full_name?.trim() || user.email?.split("@")[0] || "Admin";
  const firstName = fullName.split(" ")[0] ?? fullName;
  const initials = buildInitials(fullName);

  return (
    <CreateScopeProvider>
      <TopBarSlotsProvider>
      <div
        data-admin-root
        className="flex h-screen overflow-hidden"
        style={{ backgroundColor: "var(--color-navy)" }}
      >
        <AdminIconRail />
        <AdminSidebar
          userName={fullName}
          userEmail={user.email ?? ""}
          initials={initials}
          avatarUrl={profile?.avatar_url ?? null}
          pendingBlockCount={pendingBlockCount ?? 0}
          showTestData={profile?.show_test_data ?? false}
        />

        <div
          className="flex min-w-0 flex-1 flex-col overflow-hidden"
          style={{
            backgroundColor: "var(--color-off-white)",
            color: "var(--color-text-primary)",
          }}
        >
          {/* Desktop + tablet: the new rich top bar with title, subtitle, utility cluster, clock. */}
          <div className="hidden md:block">
            <AdminTopBarNew
              pendingBlockCount={pendingBlockCount ?? 0}
            />
          </div>
          {/* Mobile: keep the legacy compact header for now; responsive pass lands in Dispatch 8. */}
          <div className="md:hidden">
            <AdminTopBarLegacy
              userName={firstName}
              initials={initials}
              pendingBlockCount={pendingBlockCount ?? 0}
            />
          </div>

          <main className="flex-1 overflow-y-auto overflow-x-hidden pb-20 md:pb-0">
            <PullToRefresh>{children}</PullToRefresh>
          </main>
        </div>

        <AdminBottomNav
          pendingBlockCount={pendingBlockCount ?? 0}
          signOutSlot={<AdminSignOutButton />}
          userName={fullName}
          userEmail={user.email ?? ""}
          initials={initials}
          avatarUrl={profile?.avatar_url ?? null}
        />

        <CreateModal />
        <CommandPalette />
        <QuickCapture />
        <NotificationPopover />
        <HelpSupportModal />
        <AdminAIChatTrigger />
        <SidebarDrawer
          userName={fullName}
          userEmail={user.email ?? ""}
          initials={initials}
          avatarUrl={profile?.avatar_url ?? null}
          pendingBlockCount={pendingBlockCount ?? 0}
        />
      </div>
      </TopBarSlotsProvider>
    </CreateScopeProvider>
  );
}

function buildInitials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "A";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
