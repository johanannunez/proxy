import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

export type DocumentGroupSetting = {
  groupKey: string;
  sortOrder: number;
};

export async function fetchDocumentGroupSettings(profileId: string): Promise<DocumentGroupSetting[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;
  const { data, error } = await db
    .from("document_group_settings")
    .select("group_key, sort_order")
    .eq("profile_id", profileId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[document-group-settings] fetch error:", error.message);
    return [];
  }

  return ((data ?? []) as Array<{ group_key: string; sort_order: number }>).map((r) => ({
    groupKey: r.group_key,
    sortOrder: r.sort_order,
  }));
}
