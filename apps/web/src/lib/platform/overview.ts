import "server-only";
import { getMrrSummary, type MrrSummary } from "./revenue";
import { getActivationFunnel, getAgencyRetention, getSignupsTrend, type ActivationFunnel, type RetentionData } from "./growth";
import { getSystemHealth, type SystemHealth } from "./system-health";
import { getAgenciesDirectory, type AgencyDirectoryRow } from "./agencies";

/**
 * The eagle's-eye Overview digest — the platform's vital signs on one screen.
 * Composes the domain readers so the hero page is a single await and the
 * individual surfaces (Revenue, Growth, System) stay the source of truth for their
 * own numbers.
 */

export type OverviewKpis = {
  activeAgencies: number;
  workspaces: number;
  owners: number;
  properties: number;
  signupsThisWeek: number;
  signupsLastWeek: number;
  reconciledMrrCents: number;
  legacyUnattributedCents: number;
  platformSaasCents: number;
};

export type PlatformOverview = {
  kpis: OverviewKpis;
  mrr: MrrSummary;
  funnel: ActivationFunnel;
  retention: RetentionData;
  health: SystemHealth;
  recentAgencies: AgencyDirectoryRow[];
};

export async function getPlatformOverview(): Promise<PlatformOverview> {
  const [mrr, funnel, retention, signups, health, directory] = await Promise.all([
    getMrrSummary(),
    getActivationFunnel(),
    getAgencyRetention(),
    getSignupsTrend(8),
    getSystemHealth(),
    getAgenciesDirectory(),
  ]);

  const kpis: OverviewKpis = {
    activeAgencies: directory.length,
    workspaces: directory.reduce((s, a) => s + a.workspace_count, 0),
    owners: directory.reduce((s, a) => s + a.owner_count, 0),
    properties: directory.reduce((s, a) => s + a.property_count, 0),
    signupsThisWeek: signups.agenciesThisWeek,
    signupsLastWeek: signups.agenciesLastWeek,
    reconciledMrrCents: mrr.reconciledCents,
    legacyUnattributedCents: mrr.legacyUnattributedCents,
    platformSaasCents: mrr.platformSaasCents,
  };

  const recentAgencies = [...directory].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 5);

  return { kpis, mrr, funnel, retention, health, recentAgencies };
}
