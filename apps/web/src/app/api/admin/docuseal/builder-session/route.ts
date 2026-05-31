// apps/web/src/app/api/admin/docuseal/builder-session/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile as { role: string } | null)?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const apiToken = process.env.DOCUSEAL_API_TOKEN;
  if (!apiToken) {
    return NextResponse.json({ error: "DocuSeal not configured." }, { status: 503 });
  }

  const host = process.env.DOCUSEAL_APP_URL ?? "https://docuseal.com";
  return NextResponse.json({ token: apiToken, host });
}
