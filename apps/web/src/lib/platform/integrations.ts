import "server-only";

/**
 * Static registries for the System Health surface.
 *
 * Integration health here is "is this integration configured on the server"
 * (every required env var present) — an honest, real signal. We never read or
 * expose the secret values, only their presence. Live up/down probing of each
 * third party is a future addition; this is the day-one truth.
 *
 * The cron registry mirrors apps/web/vercel.json. Only crons that write an
 * activity_log row can show a real last-run; the rest are "scheduled, no run
 * telemetry yet" rather than a fabricated timestamp.
 */

export type IntegrationKey =
  | "hospitable"
  | "stripe"
  | "docuseal"
  | "resend"
  | "openphone"
  | "plaid"
  | "posthog"
  | "openrouter";

export type IntegrationDef = {
  key: IntegrationKey;
  label: string;
  category: string;
  /** Every var must be present for the integration to count as configured. */
  requiredEnv: string[];
};

export const INTEGRATIONS: IntegrationDef[] = [
  { key: "hospitable", label: "Hospitable", category: "Property sync", requiredEnv: ["HOSPITABLE_API"] },
  { key: "stripe", label: "Stripe", category: "Billing", requiredEnv: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] },
  { key: "docuseal", label: "DocuSeal", category: "E-signature", requiredEnv: ["DOCUSEAL_API_TOKEN", "DOCUSEAL_WEBHOOK_SECRET"] },
  { key: "resend", label: "Resend", category: "Email", requiredEnv: ["RESEND_API_KEY"] },
  { key: "openphone", label: "OpenPhone", category: "Messaging", requiredEnv: ["OPENPHONE_API_KEY"] },
  { key: "plaid", label: "Plaid", category: "Banking", requiredEnv: ["PLAID_CLIENT_ID"] },
  { key: "posthog", label: "PostHog", category: "Analytics", requiredEnv: ["NEXT_PUBLIC_POSTHOG_KEY"] },
  { key: "openrouter", label: "OpenRouter", category: "AI", requiredEnv: ["OPENROUTER_API_PROXY"] },
];

export type CronDef = {
  path: string;
  label: string;
  schedule: string;
  /** Human-readable cadence derived from the cron expression. */
  cadence: string;
  /** activity_log action this cron writes, if it is instrumented. */
  loggedAction?: string;
};

/** Mirrors apps/web/vercel.json. Keep in sync when crons change. */
export const CRONS: CronDef[] = [
  { path: "/api/cron/platform-mrr-snapshot", label: "MRR snapshot", schedule: "0 5 * * *", cadence: "Daily 05:00 UTC" },
  { path: "/api/cron/hospitable-sync", label: "Hospitable sync", schedule: "0 4 * * *", cadence: "Daily 04:00 UTC", loggedAction: "hospitable_sync_cron" },
  { path: "/api/cron/billing-schedules", label: "Recurring invoices", schedule: "0 7 * * *", cadence: "Daily 07:00 UTC" },
  { path: "/api/cron/cleanup-deleted-accounts", label: "Account cleanup", schedule: "0 6 * * *", cadence: "Daily 06:00 UTC" },
  { path: "/api/cron/document-expiry", label: "Document expiry", schedule: "0 8 * * *", cadence: "Daily 08:00 UTC" },
  { path: "/api/cron/document-reminders", label: "Document reminders", schedule: "0 9 * * *", cadence: "Daily 09:00 UTC" },
  { path: "/api/cron/follow-up-reminders", label: "Follow-up reminders", schedule: "0 12 * * *", cadence: "Daily 12:00 UTC" },
  { path: "/api/cron/guest-intelligence", label: "Guest intelligence", schedule: "0 13 * * *", cadence: "Daily 13:00 UTC" },
  { path: "/api/cron/communication-intelligence", label: "Comms intelligence", schedule: "30 13 * * *", cadence: "Daily 13:30 UTC" },
];

/** True when every required env var for the integration is present (non-empty). */
export function isIntegrationConfigured(def: IntegrationDef): boolean {
  return def.requiredEnv.every((name) => {
    const value = process.env[name];
    return typeof value === "string" && value.length > 0;
  });
}
