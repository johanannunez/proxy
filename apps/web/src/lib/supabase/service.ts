import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/**
 * Service role Supabase client that bypasses Row Level Security.
 *
 * Use this ONLY in server-side code that legitimately needs to
 * bypass RLS:
 *   - Webhook handlers processing events from third-party services
 *   - Cron jobs and scheduled tasks
 *   - Admin back-office queries that need to read across all users
 *   - Public inquiry form handler (to insert into the inquiries
 *     table, which has no public insert policy)
 *
 * NEVER expose this client or its key to the browser. NEVER import
 * this file from a Client Component. The service role key grants
 * full unrestricted access to the database.
 *
 * The env var is read at call time, not module init, so code that
 * imports this file but doesn't call createServiceClient() will
 * still build even when SUPABASE_SECRET_KEY is unset.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY. " +
        "The service role client can only be used on the server with " +
        "these env vars set.",
    );
  }

  return createSupabaseClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
