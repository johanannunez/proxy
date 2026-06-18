// POST /api/treasury/create-link-token
// Creates a Plaid Link token for the Treasury Plaid connection flow.
// Admin + treasury-verified only.

import { NextRequest, NextResponse } from "next/server";
import { treasuryAdminGuard } from "@/lib/treasury/admin-guard";
import { getPlaidClient, PLAID_PRODUCTS, PLAID_COUNTRY_CODES } from "@/lib/treasury/plaid";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const guard = await treasuryAdminGuard();
  if (!guard.ok) return guard.response;

  const { user } = guard;

  // Audit log: plaid_link_start
  const service = createServiceClient();
  await service.from("activity_log").insert({
    actor_id: user.id,
    action: "plaid_link_start",
    entity_type: "treasury_connection",
    metadata: {
      ip: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? null,
      user_agent: req.headers.get("user-agent") ?? null,
    },
  });

  try {
    const plaid = getPlaidClient();
    const response = await plaid.linkTokenCreate({
      user: { client_user_id: user.id },
      client_name: "Proxy Co Treasury",
      products: PLAID_PRODUCTS,
      country_codes: PLAID_COUNTRY_CODES,
      language: "en",
    });

    return NextResponse.json({ link_token: response.data.link_token });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to create Plaid link token", detail: message },
      { status: 500 },
    );
  }
}
