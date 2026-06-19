import { NextResponse } from "next/server";

/**
 * Hospitable integration is currently DISCONNECTED.
 *
 * The previous handler accepted UNAUTHENTICATED POSTs and upserted into `bookings`
 * (guest PII, financial amounts, status) with no signature verification, and emitted
 * owner-facing timeline events. The Hospitable integration has no active use case right
 * now, so this endpoint is hard-disabled to remove the unauthenticated write surface.
 *
 * When the integration is brought back, restore the handler and verify the
 * Hospitable HMAC-SHA256 `Signature` header BEFORE processing any payload.
 */
export function POST() {
  return NextResponse.json(
    { error: "Hospitable integration is disabled." },
    { status: 410 },
  );
}
