import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

const DEV_ADMIN_EMAIL = "jo@johanannunez.com";

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse("Not found", { status: 404 });
  }

  const { searchParams, origin } = new URL(request.url);
  const redirect = searchParams.get("redirect") ?? "/admin";
  const asEmail = searchParams.get("as");

  const supabase = createServiceClient();
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: asEmail ?? DEV_ADMIN_EMAIL,
    options: {
      redirectTo: `${origin}/dev-auth-callback?next=${encodeURIComponent(redirect)}`,
    },
  });

  if (error || !data.properties?.action_link) {
    return new NextResponse(`Dev auth error: ${error?.message ?? "no link generated"}`, {
      status: 500,
    });
  }

  return NextResponse.redirect(data.properties.action_link);
}
