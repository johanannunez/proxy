"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { WorkspaceDetailData } from "@/lib/admin/workspace-detail-types";
import { ImpersonationBanner } from "./settings/ImpersonationBanner";
import { PersonalInfoSection } from "./settings/PersonalInfoSection";
import {
  AccountSecuritySection,
  type SessionRow,
} from "./settings/AccountSecuritySection";
import { BusinessEntitySection } from "./settings/BusinessEntitySection";
import { NotificationsSection } from "./settings/NotificationsSection";
import { PaymentsPayoutSection } from "./settings/PaymentsPayoutSection";
import { PropertyDefaultsSection } from "./settings/PropertyDefaultsSection";
import { RegionLanguageSection } from "./settings/RegionLanguageSection";
import { AppPreferencesSection } from "./settings/AppPreferencesSection";
import {
  DataPrivacySection,
  type ConnectionRow,
} from "./settings/DataPrivacySection";
import { DangerZoneSection } from "./settings/DangerZoneSection";
import styles from "./SettingsTab.module.css";
import { SETTINGS_SECTIONS, type SettingsSection } from "./settings-sections";

export { SETTINGS_SECTIONS };
export type { SettingsSection };

const SECTION_LABEL: Record<SettingsSection, string> = {
  personal: "Personal info",
  account: "Account & security",
  business: "Business entity",
  notifications: "Notifications",
  payments: "Payments & payout",
  property_defaults: "Property defaults",
  region: "Region & language",
  preferences: "App preferences",
  privacy: "Data & privacy",
  danger: "Danger zone",
};

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #02AAEB, #1B77BE)",
  "linear-gradient(135deg, #8A9AAB, #3C5266)",
  "linear-gradient(135deg, #F59E0B, #B45309)",
  "linear-gradient(135deg, #10B981, #047857)",
  "linear-gradient(135deg, #8B5CF6, #6D28D9)",
  "linear-gradient(135deg, #EF4444, #B91C1C)",
];

function gradientFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}

export type SettingsTabProps = {
  data: WorkspaceDetailData;
  activeSection: SettingsSection;
  /** Extended profile fields needed by several sections, served from the page. */
  profileExtras: {
    preferredName: string | null;
    contactMethod:
      | "email"
      | "sms"
      | "phone"
      | "whatsapp"
      | null;
    timezone: string | null;
  };
  internalNote: {
    text: string;
    updatedAt: string;
    createdByName: string | null;
  } | null;
  sessions: SessionRow[];
  connections: ConnectionRow[];
  workspaceDetail: {
    id: string;
    name: string;
    type: string | null;
    ein: string | null;
    notes: string | null;
  } | null;
  /** Override the base path for section routing. Defaults to /admin/workspaces/:id. */
  basePath?: string;
};

export function SettingsTab({
  data,
  activeSection,
  profileExtras,
  internalNote,
  sessions,
  connections,
  workspaceDetail,
  basePath,
}: SettingsTabProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { primaryMember, workspace } = data;

  const resolvedBasePath = basePath ?? `/admin/workspaces/${workspace.id}`;

  function switchSection(next: SettingsSection) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("tab", "settings");
    if (next === "personal") {
      params.delete("section");
    } else {
      params.set("section", next);
    }
    router.replace(`${resolvedBasePath}?${params.toString()}`, {
      scroll: false,
    });
  }

  // Demo signal: if the owner is missing a phone, nudge Payments & payout.
  const paymentsNeedsAttention = !primaryMember.phone;

  return (
    <div className={styles.root}>
      <nav className={styles.nav} aria-label="Settings sections">
        {renderNavItem("personal", activeSection, switchSection)}
        {renderNavItem("account", activeSection, switchSection)}
        {renderNavItem("business", activeSection, switchSection)}
        {renderNavItem("notifications", activeSection, switchSection)}
        {renderNavItem(
          "payments",
          activeSection,
          switchSection,
          paymentsNeedsAttention,
        )}
        {renderNavItem("property_defaults", activeSection, switchSection)}
        {renderNavItem("region", activeSection, switchSection)}
        {renderNavItem("preferences", activeSection, switchSection)}
        {renderNavItem("privacy", activeSection, switchSection)}
        <div className={styles.navDivider} aria-hidden />
        {renderNavItem("danger", activeSection, switchSection)}
      </nav>

      <div className={styles.content}>
        <ImpersonationBanner ownerName={primaryMember.fullName} />

        {activeSection === "personal" && (
          <PersonalInfoSection
            profile={{
              id: primaryMember.id,
              fullName: primaryMember.fullName,
              preferredName: profileExtras.preferredName,
              email: primaryMember.email,
              phone: primaryMember.phone,
              contactMethod: profileExtras.contactMethod,
              avatarUrl: primaryMember.avatarUrl,
            }}
            internalNote={internalNote}
            gradient={gradientFor(primaryMember.id)}
          />
        )}

        {activeSection === "account" && (
          <AccountSecuritySection
            email={primaryMember.email}
            twoFactorEnabled={false}
            lastPasswordChangeAt={null}
            sessions={sessions}
          />
        )}

        {activeSection === "business" && (
          <BusinessEntitySection
            workspace={
              workspaceDetail ?? {
                id: workspace.id,
                name: workspace.name,
                type: null,
                ein: null,
                notes: null,
              }
            }
            coOwners={data.members.map((m) => ({
              id: m.id,
              fullName: m.fullName,
              email: m.email,
              role: m.id === primaryMember.id ? "primary" : "member",
            }))}
          />
        )}

        {activeSection === "notifications" && <NotificationsSection />}

        {activeSection === "payments" && (
          <PaymentsPayoutSection
            hasBankOnFile={false}
            bankLast4={null}
            bankName={null}
            w9OnFile={false}
            ytdGrossCents={596500}
            ytdNetCents={417700}
            nextPayoutDate="2026-05-15"
          />
        )}

        {activeSection === "property_defaults" && (
          <PropertyDefaultsSection propertyCount={data.propertyCount} />
        )}

        {activeSection === "region" && (
          <RegionLanguageSection
            profileId={primaryMember.id}
            timezone={profileExtras.timezone}
          />
        )}

        {activeSection === "preferences" && <AppPreferencesSection />}

        {activeSection === "privacy" && (
          <DataPrivacySection connections={connections} />
        )}

        {activeSection === "danger" && (
          <DangerZoneSection ownerName={primaryMember.fullName} />
        )}
      </div>
    </div>
  );
}

function renderNavItem(
  key: SettingsSection,
  active: SettingsSection,
  onSwitch: (next: SettingsSection) => void,
  withDot = false,
) {
  const isActive = active === key;
  const isDanger = key === "danger";
  const className = isDanger
    ? `${styles.navItem} ${styles.navItemDanger} ${
        isActive ? styles.navItemDangerActive : ""
      }`
    : `${styles.navItem} ${isActive ? styles.navItemActive : ""}`;
  return (
    <button
      key={key}
      type="button"
      className={className}
      onClick={() => onSwitch(key)}
    >
      <span>{SECTION_LABEL[key]}</span>
      {withDot ? (
        <span
          className={styles.navDot}
          aria-label="Needs attention"
          title="Needs attention"
        />
      ) : null}
    </button>
  );
}
