import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export type WorkspaceContext = {
  /** The user ID to scope all portal data queries against. */
  userId: string;
  /** The actual logged-in user. Same as userId when not impersonating. */
  realUserId: string;
  /**
   * Supabase client to use for data queries.
   * - Normal client when not impersonating (RLS enforced via auth JWT).
   * - Service role client when impersonating (RLS bypassed; use explicit
   *   eq("owner_id", userId) filters in every query).
   */
  client: ReturnType<typeof createServiceClient>;
  isImpersonating: boolean;
  /** Set when impersonating — the profile of the owner being viewed. */
  ownerProfile: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  } | null;
};

/**
 * Shared context resolver for portal Server Components and Server Actions.
 *
 * Replaces the `createClient() + supabase.auth.getUser()` pattern used across
 * portal pages. When an admin has set the `proxy_viewing_as` cookie, returns
 * a service-role client scoped to the target owner so all portal pages
 * transparently show that owner's data.
 *
 * IMPORTANT: When `isImpersonating` is true, the returned `client` is a
 * service-role client that bypasses RLS. Every query MUST include an explicit
 * `.eq("owner_id", userId)` (or equivalent) filter — do not rely on RLS.
 */
export async function getWorkspaceContext(): Promise<WorkspaceContext> {
  const userClient = await createClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const baseContext: WorkspaceContext = {
    userId: user.id,
    realUserId: user.id,
    client: userClient as unknown as ReturnType<typeof createServiceClient>,
    isImpersonating: false,
    ownerProfile: null,
  };

  // Only admins can impersonate.
  const { data: profile } = await userClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return baseContext;

  // Check for the viewing-as cookie.
  const cookieStore = await cookies();
  const viewingAs = cookieStore.get("proxy_viewing_as")?.value;
  if (!viewingAs) return baseContext;

  // Validate target owner using service client (user client can't read other
  // users' profiles due to RLS).
  const svc = createServiceClient();
  const { data: ownerProfile } = await svc
    .from("profiles")
    .select("id, full_name, email, avatar_url, role")
    .eq("id", viewingAs)
    .single();

  if (!ownerProfile || ownerProfile.role !== "owner") {
    // Cookie references a deleted or non-owner profile — ignore it.
    return baseContext;
  }

  return {
    userId: viewingAs,
    realUserId: user.id,
    client: svc,
    isImpersonating: true,
    ownerProfile: {
      id: ownerProfile.id,
      full_name: ownerProfile.full_name,
      email: ownerProfile.email,
      avatar_url: ownerProfile.avatar_url,
    },
  };
}
