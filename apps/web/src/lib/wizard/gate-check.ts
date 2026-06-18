import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Gate check: redirects to /portal/setup if the owner has not
 * completed basic account details (full_name required).
 *
 * Call this at the top of any Property Setup step page.
 *
 * Once the PENDING migration adds phone and mailing_address columns,
 * this check will be expanded to require all three fields.
 */
export async function enforceOwnerAccountGate(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  // Currently only check full_name since phone/mailing_address
  // columns don't exist until migration runs
  if (!profile?.full_name) {
    redirect("/workspace/setup?gate=account");
  }

  return user.id;
}
