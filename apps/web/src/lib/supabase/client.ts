import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";

/**
 * Browser-side Supabase client.
 *
 * Use this in Client Components and client-side code that runs in
 * the user's browser. It reads the publishable key from the env
 * at call time and handles session cookies automatically.
 *
 * Do NOT use this on the server. For Server Components, Server
 * Actions, and Route Handlers, use `createClient` from
 * `@/lib/supabase/server` instead.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
