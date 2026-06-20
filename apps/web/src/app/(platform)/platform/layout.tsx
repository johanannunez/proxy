import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPlatformRole } from "@/lib/platform/auth";
import { PlatformShell } from "@/components/platform/PlatformShell";

/**
 * Platform (super-admin) layout — the platform-staff space, walled off from every
 * agency. proxy.ts already gates /platform/* on platform_role; this is the
 * defense-in-depth server-side check that prevents any direct-render bypass
 * (mirrors how the admin layout double-checks role). It also owns the always-dark
 * "mission control" shell that every platform surface renders inside.
 */
export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const platformRole = await getPlatformRole();
  if (platformRole !== "superadmin") {
    // Redirect to "/" and let canonical post-login routing send them to the right
    // panel (admins -> /admin, owners -> /workspace/home).
    redirect("/");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  const name = profile?.full_name || profile?.email || "Platform staff";
  const email = profile?.email || user?.email || "";

  return (
    <PlatformShell user={{ name, email }}>{children}</PlatformShell>
  );
}
