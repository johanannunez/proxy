import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { recordSessionLogin } from "@/lib/session-log";

const ADMIN_USER_ID = "9b7a5e7d-b799-40fa-b8f6-b68a3f4a00ee";

const WELCOME_MESSAGE_BODY =
  "Welcome to Proxy! We are so excited to have you on board. We are setting up a few things on the backend and will have everything ready for you shortly. In the meantime, feel free to send us a message here if you have any questions.";

/**
 * Send a welcome message to new users on their first login.
 * Creates a direct conversation and inserts a message from admin.
 * No-ops if the user already has conversations (returning user).
 */
async function sendWelcomeMessageIfNew(userId: string) {
  try {
    const svc = createServiceClient();

    // Check if this user already has any conversations (not a new user)
    const { data: existing } = await svc
      .from("conversations")
      .select("id")
      .eq("owner_id", userId)
      .limit(1);

    if (existing && existing.length > 0) return;

    // Create a direct conversation
    const { data: conv, error: convError } = await svc
      .from("conversations")
      .insert({
        owner_id: userId,
        type: "direct",
        subject: null,
      })
      .select("id")
      .single();

    if (convError || !conv) return;

    // Insert the welcome message from admin
    await svc.from("messages").insert({
      conversation_id: conv.id,
      sender_id: ADMIN_USER_ID,
      body: WELCOME_MESSAGE_BODY,
      delivery_method: "workspace",
    });
  } catch {
    // Silently fail; welcome message is non-critical
  }
}

/**
 * Supabase Auth callback handler.
 *
 * This route is the target of `emailRedirectTo` when a new user
 * confirms their signup email, and of OAuth redirects if we add
 * social login later. The URL arrives with a `code` query param
 * which we exchange for a session before redirecting into the
 * authenticated area of the app.
 *
 * https://supabase.com/docs/guides/auth/server-side/nextjs
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/workspace/home";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Record session login
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
          ?? request.headers.get("x-real-ip")
          ?? null;
        const ua = request.headers.get("user-agent") ?? null;
        await recordSessionLogin({ userId: user.id, ipAddress: ip, userAgent: ua });

        // Send welcome message for new users (first login = no existing conversations)
        await sendWelcomeMessageIfNew(user.id);
      }

      // After login, always land on app. in production.
      const redirectOrigin = origin.includes("myproxyhost.com")
        ? "https://app.myproxyhost.com"
        : origin;
      return NextResponse.redirect(`${redirectOrigin}${next}`);
    }
  }

  // On error, send the user back to login with a generic message.
  return NextResponse.redirect(
    `${origin}/login?error=Could not authenticate. Please try again.`,
  );
}
