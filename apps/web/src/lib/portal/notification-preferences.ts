export const PORTAL_NOTIFICATION_PREFS_KEY = "parcel-notification-prefs";
export const PORTAL_NOTIFICATION_PREFS_EVENT = "parcel:notification-prefs";

export type PortalNotificationPreferences = {
  portalMessages: boolean;
  announcements: boolean;
  accountAlerts: boolean;
  financialDocuments: boolean;
};

export const DEFAULT_PORTAL_NOTIFICATION_PREFS: PortalNotificationPreferences = {
  portalMessages: true,
  announcements: true,
  accountAlerts: true,
  financialDocuments: true,
};

export type OwnerNotificationPreferenceRow = {
  owner_id: string;
  portal_messages: boolean;
  announcements: boolean;
  account_alerts: boolean;
  financial_documents: boolean;
};

export function preferencesFromRow(
  row: OwnerNotificationPreferenceRow | null | undefined,
): PortalNotificationPreferences {
  if (!row) return DEFAULT_PORTAL_NOTIFICATION_PREFS;

  return {
    portalMessages: row.portal_messages,
    announcements: row.announcements,
    accountAlerts: row.account_alerts,
    financialDocuments: row.financial_documents,
  };
}

export function preferencesToRow(
  ownerId: string,
  prefs: PortalNotificationPreferences,
): OwnerNotificationPreferenceRow {
  return {
    owner_id: ownerId,
    portal_messages: prefs.portalMessages,
    announcements: prefs.announcements,
    account_alerts: prefs.accountAlerts,
    financial_documents: prefs.financialDocuments,
  };
}

export function readPortalNotificationPreferences(): PortalNotificationPreferences {
  if (typeof window === "undefined") return DEFAULT_PORTAL_NOTIFICATION_PREFS;

  try {
    const stored = window.localStorage.getItem(PORTAL_NOTIFICATION_PREFS_KEY);
    if (!stored) return DEFAULT_PORTAL_NOTIFICATION_PREFS;
    return { ...DEFAULT_PORTAL_NOTIFICATION_PREFS, ...JSON.parse(stored) };
  } catch {
    return DEFAULT_PORTAL_NOTIFICATION_PREFS;
  }
}

export function isPortalNotificationEnabled(
  type: string,
  prefs: PortalNotificationPreferences,
): boolean {
  if (type === "message_received") return prefs.portalMessages;
  if (type === "announcement") return prefs.announcements;
  if (type === "receipt_available") return prefs.financialDocuments;
  if (type === "setup_reminder") return prefs.accountAlerts;
  return true;
}
