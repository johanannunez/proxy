/**
 * migrate-stripe-metadata.ts
 *
 * One-time backfill: copies all parcel_* metadata keys to proxy_* on every
 * Stripe Customer, Subscription, and PaymentIntent that has them.
 *
 * Run this BEFORE deploying any code that reads proxy_* keys.
 *
 * Usage (from apps/web/):
 *   doppler run -- npx tsx scripts/migrate-stripe-metadata.ts
 *
 * Safe to run multiple times (idempotent — skips objects that already have proxy_* keys).
 */

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

const KEY_MAP: Record<string, string> = {
  parcel_workspace_id: "proxy_workspace_id",
  parcel_property_id: "proxy_property_id",
  parcel_owner_id: "proxy_owner_id",
  parcel_billing_invoice_id: "proxy_billing_invoice_id",
  parcel_billing_profile_id: "proxy_billing_profile_id",
  parcel_profile_id: "proxy_profile_id",
  parcel_kind: "proxy_kind",
};

function buildUpdate(
  metadata: Stripe.Metadata
): Stripe.Metadata | null {
  const patch: Stripe.Metadata = {};
  let changed = false;

  for (const [oldKey, newKey] of Object.entries(KEY_MAP)) {
    if (metadata[oldKey] !== undefined && metadata[newKey] === undefined) {
      patch[newKey] = metadata[oldKey];
      changed = true;
    }
  }

  return changed ? patch : null;
}

async function migrateCustomers() {
  let processed = 0;
  let patched = 0;

  for await (const customer of stripe.customers.list({ limit: 100 })) {
    processed++;
    const update = buildUpdate(customer.metadata ?? {});
    if (update) {
      await stripe.customers.update(customer.id, { metadata: update });
      patched++;
      console.log(`  customer ${customer.id}: ${Object.keys(update).join(", ")}`);
    }
  }

  console.log(`Customers: ${processed} checked, ${patched} patched`);
}

async function migrateSubscriptions() {
  let processed = 0;
  let patched = 0;

  for await (const sub of stripe.subscriptions.list({ limit: 100, status: "all" })) {
    processed++;
    const update = buildUpdate(sub.metadata ?? {});
    if (update) {
      await stripe.subscriptions.update(sub.id, { metadata: update });
      patched++;
      console.log(`  subscription ${sub.id}: ${Object.keys(update).join(", ")}`);
    }
  }

  console.log(`Subscriptions: ${processed} checked, ${patched} patched`);
}

async function migratePaymentIntents() {
  let processed = 0;
  let patched = 0;
  const cutoff = Math.floor(Date.now() / 1000) - 90 * 24 * 60 * 60; // last 90 days

  for await (const pi of stripe.paymentIntents.list({
    limit: 100,
    created: { gte: cutoff },
  })) {
    processed++;
    const update = buildUpdate(pi.metadata ?? {});
    if (update) {
      await stripe.paymentIntents.update(pi.id, { metadata: update });
      patched++;
      console.log(`  payment_intent ${pi.id}: ${Object.keys(update).join(", ")}`);
    }
  }

  console.log(`PaymentIntents (last 90d): ${processed} checked, ${patched} patched`);
}

async function main() {
  console.log("Starting Stripe metadata migration: parcel_* → proxy_*\n");

  await migrateCustomers();
  await migrateSubscriptions();
  await migratePaymentIntents();

  console.log("\nDone. Verify on a few customers in the Stripe dashboard, then deploy the app.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
