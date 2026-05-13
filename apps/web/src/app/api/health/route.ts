import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Health probe consumed by external uptime monitors (Better Stack et al).
 *
 * Returns 200 only when:
 *   - the route is reachable (proves Vercel routing is healthy)
 *   - Supabase responds to a tiny RLS-free query (proves DB + key are healthy)
 *
 * Anything else returns 503 with a short reason. The body is intentionally
 * minimal to keep monitoring noise low and parse cost trivial.
 */
export async function GET() {
  const start = Date.now();

  try {
    const supabase = createServiceClient();
    const { error } = await supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .limit(1);

    if (error) {
      return NextResponse.json(
        { ok: false, reason: "supabase_query_failed", ms: Date.now() - start },
        { status: 503 },
      );
    }

    return NextResponse.json({ ok: true, ms: Date.now() - start });
  } catch {
    return NextResponse.json(
      { ok: false, reason: "supabase_client_init_failed", ms: Date.now() - start },
      { status: 503 },
    );
  }
}
