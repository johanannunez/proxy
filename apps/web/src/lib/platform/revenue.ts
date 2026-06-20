import "server-only";
import { platformDb } from "./service";
import { shortDate } from "./format";

/**
 * Revenue reads. Two distinct metrics that must never be conflated:
 *
 *  - AGENCY-OPERATING MRR: what agencies bill their own clients on Proxy
 *    (reconciled across legacy subscriptions + new billing schedules). This is the
 *    hero number. = $0 today.
 *  - PLATFORM-SAAS MRR: what agencies pay Proxy. = $0 today (the one agency is
 *    comped, has_billing=false). Computed separately and labeled as such.
 *
 * The legacy $199/mo subscription whose owner has no workspace surfaces only in
 * legacy_mrr_agency_total_cents — it is its own labeled line, never folded into the
 * reconciled hero, so the hero and the funnel's "first payment" tell one story.
 */

export type MrrTrendPoint = { date: string; label: string; cents: number };

export type MrrSummary = {
  reconciledCents: number;
  scheduleCents: number;
  legacyCents: number;
  legacyUnattributedCents: number;
  platformSaasCents: number;
  billingAgencyCount: number;
  totalAgencies: number;
  byPlanTier: { planTier: string; agencies: number; cents: number }[];
  trend: MrrTrendPoint[];
  delta: { hasHistory: boolean; currentCents: number; previousCents: number | null; sinceDate: string };
};

type MrrViewRow = {
  agency_id: string;
  plan_tier: string | null;
  reconciled_mrr_cents: number;
  schedule_mrr_cents: number;
  legacy_mrr_cents: number;
  legacy_mrr_agency_total_cents: number;
};

type OverviewRow = { plan_tier: string | null; has_billing: boolean; mrr_cents: number };

type SnapshotRow = { captured_date: string; reconciled_mrr_cents: number };

export async function getMrrSummary(): Promise<MrrSummary> {
  const db = platformDb();
  const [mrrRes, overviewRes, snapshotRes] = await Promise.all([
    db
      .from<MrrViewRow[]>("platform_agency_operating_mrr")
      .select("agency_id, plan_tier, reconciled_mrr_cents, schedule_mrr_cents, legacy_mrr_cents, legacy_mrr_agency_total_cents"),
    db.from<OverviewRow[]>("platform_agencies_overview").select("plan_tier, has_billing, mrr_cents"),
    db.from<SnapshotRow[]>("platform_mrr_snapshots").select("captured_date, reconciled_mrr_cents").order("captured_date", { ascending: true }),
  ]);

  const mrrRows = mrrRes.data ?? [];
  const reconciledCents = mrrRows.reduce((s, r) => s + r.reconciled_mrr_cents, 0);
  const scheduleCents = mrrRows.reduce((s, r) => s + r.schedule_mrr_cents, 0);
  const legacyCents = mrrRows.reduce((s, r) => s + r.legacy_mrr_cents, 0);
  const legacyUnattributedCents = mrrRows.reduce((s, r) => s + r.legacy_mrr_agency_total_cents, 0);

  const overview = overviewRes.data ?? [];
  const planMap = new Map<string, { agencies: number; cents: number }>();
  for (const a of overview) {
    const key = a.plan_tier ?? "unassigned";
    const entry = planMap.get(key) ?? { agencies: 0, cents: 0 };
    entry.agencies += 1;
    entry.cents += a.mrr_cents;
    planMap.set(key, entry);
  }
  const byPlanTier = [...planMap.entries()]
    .map(([planTier, v]) => ({ planTier, ...v }))
    .sort((a, b) => b.cents - a.cents);

  // Platform-SaaS MRR: agencies paying Proxy. No platform price model is wired yet,
  // so this is $0 by construction today; we surface the count of billing agencies.
  const billingAgencyCount = overview.filter((a) => a.has_billing).length;

  // Collapse snapshots to one platform total per captured_date.
  const byDate = new Map<string, number>();
  for (const s of snapshotRes.data ?? []) {
    byDate.set(s.captured_date, (byDate.get(s.captured_date) ?? 0) + s.reconciled_mrr_cents);
  }
  const trend: MrrTrendPoint[] = [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, cents]) => ({ date, label: shortDate(date), cents }));

  const hasHistory = trend.length >= 2;
  const currentCents = trend.length > 0 ? trend[trend.length - 1].cents : reconciledCents;
  const previousCents = hasHistory ? trend[trend.length - 2].cents : null;
  const sinceDate = trend.length > 0 ? trend[0].date : new Date().toISOString().slice(0, 10);

  return {
    reconciledCents,
    scheduleCents,
    legacyCents,
    legacyUnattributedCents,
    platformSaasCents: 0,
    billingAgencyCount,
    totalAgencies: overview.length,
    byPlanTier,
    trend,
    delta: { hasHistory, currentCents, previousCents, sinceDate },
  };
}

export type ActiveBillingLine = {
  id: string;
  kind: "legacy_subscription" | "schedule";
  label: string;
  priceCents: number;
  interval: string;
  status: string;
  attributed: boolean;
};

export async function getActiveBilling(): Promise<ActiveBillingLine[]> {
  const db = platformDb();
  const subsRes = await db
    .from<{ id: string; price_cents: number; interval: string; status: string; owner_id: string }[]>("subscriptions")
    .select("id, price_cents, interval, status, owner_id")
    .in("status", ["active", "trialing"]);

  const subs = subsRes.data ?? [];
  if (subs.length === 0) return [];

  const ownerIds = subs.map((s) => s.owner_id).filter(Boolean);
  const ownersRes =
    ownerIds.length > 0
      ? await db
          .from<{ id: string; full_name: string | null; workspace_id: string | null }[]>("profiles")
          .select("id, full_name, workspace_id")
          .in("id", ownerIds)
      : { data: [] as { id: string; full_name: string | null; workspace_id: string | null }[], error: null };

  const ownerMap = new Map((ownersRes.data ?? []).map((o) => [o.id, o]));

  return subs.map((s) => {
    const owner = ownerMap.get(s.owner_id);
    return {
      id: s.id,
      kind: "legacy_subscription" as const,
      label: owner?.full_name ?? "Unknown owner",
      priceCents: s.price_cents,
      interval: s.interval,
      status: s.status,
      attributed: Boolean(owner?.workspace_id),
    };
  });
}
