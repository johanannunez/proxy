import "server-only";

import { createClient } from "@/lib/supabase/server";
import { untypedDatabase, type UntypedDatabaseClient } from "@/lib/supabase/untyped";
import {
  DEFAULT_PORTAL_NOTIFICATION_PREFS,
  preferencesFromRow,
  type OwnerNotificationPreferenceRow,
  type PortalNotificationPreferences,
} from "@/lib/portal/notification-preferences";

export async function getPortalNotificationPreferences(
  ownerId: string,
  client?: unknown,
): Promise<PortalNotificationPreferences> {
  const db: UntypedDatabaseClient = client
    ? untypedDatabase(client)
    : untypedDatabase(await createClient());

  const { data } = await db
    .from<OwnerNotificationPreferenceRow>("owner_notification_preferences")
    .select("owner_id, portal_messages, announcements, account_alerts, financial_documents")
    .eq("owner_id", ownerId)
    .maybeSingle();

  return preferencesFromRow(data) ?? DEFAULT_PORTAL_NOTIFICATION_PREFS;
}
