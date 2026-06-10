import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import type { Database } from "@/types/supabase";
import { authCookieDomain } from "./cookie-domain";

/**
 * Server-side Supabase client for Server Components, Server Actions,
 * and Route Handlers.
 *
 * This reads the authenticated session from cookies via Next.js
 * `cookies()` API. It can read and write cookies during the request,
 * which allows Supabase to refresh expired access tokens on the fly.
 *
 * Use this anywhere you need to query Supabase on behalf of the
 * currently-authenticated user while respecting Row Level Security.
 *
 * For operations that need to bypass RLS (webhooks, cron jobs,
 * admin back-office queries), use `createServiceClient` instead.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const domain = authCookieDomain((await headers()).get("host"));

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                ...(domain ? { domain } : {}),
              }),
            );
          } catch {
            // Called from a Server Component which cannot set cookies.
            // Middleware handles session refresh on the next request.
          }
        },
      },
    },
  );
}
