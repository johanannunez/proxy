import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getPlatformRole } from "@/lib/platform/auth";

/**
 * Platform (super-admin) layout — the platform-staff space, walled off from
 * every agency. proxy.ts already gates /platform/* on platform_role; this is
 * the defense-in-depth server-side check that prevents any direct-render
 * bypass (mirrors how the admin layout double-checks role).
 *
 * Intentionally chrome-free for now. The real platform surfaces (agencies
 * directory, MRR, growth, support-access, system health) are designed in M3
 * with the frontend-design + ui-ux-pro-max skills; this layout only owns the
 * access wall, not the look.
 */
export default async function PlatformLayout({
  children,
}: {
  children: ReactNode;
}) {
  const platformRole = await getPlatformRole();
  if (platformRole !== "superadmin") {
    // Redirect to "/" and let the canonical post-login routing send them to the
    // right panel (admins -> /admin, owners -> /workspace/home), instead of
    // hardcoding a destination here that could dead-end an agency admin.
    redirect("/");
  }

  return <>{children}</>;
}
