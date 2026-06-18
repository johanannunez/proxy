"use server";

import { createClient } from "@/lib/supabase/server";
import { syncFromHospitable, type SyncResult } from "@/lib/hospitable-sync";
import { revalidatePath } from "next/cache";

const EMPTY: SyncResult = {
  propertiesMatched: 0,
  propertiesCreated: 0,
  propertiesUnmatched: [],
  reservationsFetched: 0,
  reservationsUpserted: 0,
  reservationsSkipped: { noPropertyId: 0, unmatchedProperty: 0, noDates: 0 },
  errors: [],
};

export async function triggerSync(): Promise<SyncResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return { ...EMPTY, errors: ["Not signed in."] };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin")
    return { ...EMPTY, errors: ["Admins only."] };

  // Pass the admin's user ID as the placeholder owner for newly created properties
  const result = await syncFromHospitable(user.id);

  revalidatePath("/admin/properties");
  revalidatePath("/workspace/home");
  revalidatePath("/workspace/reserve");
  revalidatePath("/workspace/payouts");

  return result;
}
