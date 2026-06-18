"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Set the admin "viewing as" cookie to impersonate a specific owner.
 * Only works if the caller is an admin — silently no-ops otherwise.
 */
export async function setViewingAs(ownerId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return;

  const cookieStore = await cookies();
  cookieStore.set("proxy_viewing_as", ownerId, {
    httpOnly: true,
    sameSite: "strict",
    maxAge: 60 * 60 * 8, // 8 hours
    path: "/",
  });

  revalidatePath("/portal", "layout");
}

/**
 * Clear the "viewing as" cookie and return to the admin's own portal view.
 */
export async function clearViewingAs() {
  const cookieStore = await cookies();
  cookieStore.delete("proxy_viewing_as");
  revalidatePath("/portal", "layout");
}
