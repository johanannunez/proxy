import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  getStripe,
  syncInvoiceFromStripe,
  syncSubscriptionFromStripe,
} from "@/lib/stripe";
import {
  detectFirstAgencyPayment,
  recordWorkspaceBillingStripeEvent,
  syncWorkspaceInvoiceFromStripe,
  syncWorkspacePaymentMethodFromStripe,
} from "@/lib/billing/stripe-workspace";
import { syncOrgSubscriptionFromStripe } from "@/lib/billing/org-billing";
import { monthlyMrrCents } from "@/lib/billing/org-billing-core";
import { captureServerEvent } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    return NextResponse.json(
      {
        error: `Webhook signature verification failed: ${(err as Error).message}`,
      },
      { status: 400 },
    );
  }

  try {
    await recordWorkspaceBillingStripeEvent(event);

    switch (event.type) {
      case "invoice.finalized":
      case "invoice.payment_failed":
      case "invoice.voided":
      case "invoice.updated":
        await syncWorkspaceInvoiceFromStripe(event.data.object as Stripe.Invoice);
        await syncInvoiceFromStripe(event.data.object as Stripe.Invoice);
        break;
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        await syncWorkspaceInvoiceFromStripe(invoice);
        await syncInvoiceFromStripe(invoice);
        // Activation-funnel signal (M3). Gated to invoice.paid (fires once on the
        // paid transition) so the first-payment event isn't re-emitted on later
        // invoice.updated deliveries of the same row. Best-effort.
        const firstPayment = await detectFirstAgencyPayment(invoice);
        if (firstPayment) {
          const distinctId =
            firstPayment.payingProfileId ?? `agency:${firstPayment.agencyId}`;
          await captureServerEvent(distinctId, "first_payment", {
            agency_id: firstPayment.agencyId,
            amount_cents: firstPayment.amountCents,
            workspace_id: firstPayment.workspaceId,
            billing_invoice_id: firstPayment.billingInvoiceId,
          });
        }
        break;
      }
      case "payment_method.attached":
        await syncWorkspacePaymentMethodFromStripe({
          paymentMethod: event.data.object as Stripe.PaymentMethod,
        });
        break;
      case "setup_intent.succeeded": {
        const intent = event.data.object as Stripe.SetupIntent;
        const paymentMethodId =
          typeof intent.payment_method === "string"
            ? intent.payment_method
            : intent.payment_method?.id;
        if (paymentMethodId && intent.metadata?.proxy_workspace_id) {
          const paymentMethod =
            await getStripe().paymentMethods.retrieve(paymentMethodId);
          await syncWorkspacePaymentMethodFromStripe({
            paymentMethod,
            workspaceId: intent.metadata.proxy_workspace_id,
          });
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await syncSubscriptionFromStripe(subscription);
        // Tenant org subscriptions (metadata.org_id) drive plan_tier.
        await syncOrgSubscriptionFromStripe(subscription);
        // Activation-funnel signal (M3). Churn fires only on a true cancellation
        // (subscription.deleted) and only for agency subscriptions (metadata.org_id).
        // Legacy per-owner subscriptions carry proxy_owner_id, not org_id, so they
        // are skipped — consistent with the hero MRR/funnel excluding the legacy
        // unattributed sub. Best-effort. prior MRR is the canceled sub's monthly value.
        if (event.type === "customer.subscription.deleted") {
          const agencyId = subscription.metadata?.org_id;
          if (agencyId) {
            await captureServerEvent(`agency:${agencyId}`, "churn", {
              agency_id: agencyId,
              mrr_cents: monthlyMrrCents(subscription.items?.data ?? []),
            });
          }
        }
        break;
      }
      default:
        // Ignore other event types.
        break;
    }
  } catch (err) {
    // Log but don't fail the webhook; Stripe will retry.
    console.error("[stripe webhook] handler error", event.type, err);
  }

  return NextResponse.json({ received: true });
}
