import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createHash } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ipHash = createHash("sha256").update(ip).digest("hex").substring(0, 16);
  const userAgent = req.headers.get("user-agent") ?? null;

  try {
    // Cast to any: form_views is a new table not yet in generated Supabase types.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceClient() as any;
    await supabase.from("form_views").insert({
      form_id: id,
      ip_hash: ipHash,
      user_agent: userAgent,
    });
    return NextResponse.json({ ok: true });
  } catch {
    // Silently fail — view tracking must never break the fill page.
    return NextResponse.json({ ok: false });
  }
}
