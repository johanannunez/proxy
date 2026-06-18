"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { untypedDatabase } from "@/lib/supabase/untyped";
import {
  preferencesToRow,
  type WorkspaceNotificationPreferences,
} from "@/lib/workspace/notification-preferences";

export async function updateWorkspaceNotificationPreferences(
  prefs: WorkspaceNotificationPreferences,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "You must be signed in to update notifications." };
  }

  const db = untypedDatabase(supabase);
  const { error } = await db
    .from("owner_notification_preferences")
    .upsert(preferencesToRow(user.id, prefs), { onConflict: "owner_id" });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/workspace/account");
  revalidatePath("/workspace/notifications");
  return { ok: true };
}
