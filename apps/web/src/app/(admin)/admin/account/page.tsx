import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccountNav } from "@/app/(workspace)/workspace/account/AccountNav";
import ProfileSection from "@/app/(workspace)/workspace/account/components/ProfileSection";
import SecuritySection from "@/app/(workspace)/workspace/account/components/SecuritySection";
import { SessionsSection } from "@/app/(workspace)/workspace/account/components/SessionsSection";
import { RegionSection } from "@/app/(workspace)/workspace/account/components/RegionSection";
import { DeveloperSection } from "./DeveloperSection";

export const metadata: Metadata = { title: "Admin Account" };
export const dynamic = "force-dynamic";

export default async function AdminAccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    redirect("/workspace/home");
  }

  const profileData = {
    full_name: profile?.full_name ?? null,
    preferred_name: profile?.preferred_name ?? null,
    email: user.email ?? "",
    phone: profile?.phone ?? null,
    contact_method: profile?.contact_method ?? null,
    avatar_url: profile?.avatar_url ?? null,
    created_at: profile?.created_at ?? new Date().toISOString(),
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10 lg:px-10 lg:py-14">
      <div className="flex flex-col gap-8">
        {/* Two-column layout */}
        <div className="flex flex-col lg:flex-row lg:gap-10">
          <AccountNav />

          <div className="flex min-w-0 flex-1 flex-col gap-12">
            <ProfileSection profile={profileData} />
            <SecuritySection userEmail={user.email ?? ""} />
            <SessionsSection />
            <RegionSection timezone={profile?.timezone ?? ""} />
            <DeveloperSection showTestData={profile?.show_test_data ?? false} />
          </div>
        </div>
      </div>
    </div>
  );
}
