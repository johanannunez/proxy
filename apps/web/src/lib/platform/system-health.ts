import "server-only";
import { platformDb } from "./service";
import { INTEGRATIONS, CRONS, isIntegrationConfigured, type IntegrationDef, type CronDef } from "./integrations";

/**
 * System Health: real, day-one signals only.
 *
 *  - Integration status = "configured" (every required env var present on the
 *    server). We never read the secret values. Live up/down probing is a future add.
 *  - Cron status = the registry (mirrors vercel.json) overlaid with a real last-run
 *    where the cron writes activity_log. Crons that aren't instrumented show
 *    "scheduled, no run log" rather than a fabricated time.
 */

export type IntegrationStatus = IntegrationDef & { configured: boolean };

export type CronStatus = CronDef & {
  lastRunAt: string | null;
  instrumented: boolean;
};

export type SystemHealth = {
  integrations: IntegrationStatus[];
  configuredCount: number;
  integrationCount: number;
  crons: CronStatus[];
  overall: "operational" | "degraded";
  scope: { agencies: number; workspaces: number; properties: number };
};

export async function getSystemHealth(): Promise<SystemHealth> {
  const db = platformDb();

  const loggedActions = CRONS.map((c) => c.loggedAction).filter((a): a is string => Boolean(a));

  const [logsRes, agenciesRes, workspacesRes, propertiesRes] = await Promise.all([
    loggedActions.length > 0
      ? db
          .from<{ action: string; created_at: string }[]>("activity_log")
          .select("action, created_at")
          .in("action", loggedActions)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as { action: string; created_at: string }[], error: null }),
    db.from<{ id: string }[]>("agencies").select("id"),
    db.from<{ id: string }[]>("workspaces").select("id"),
    db.from<{ id: string }[]>("properties").select("id"),
  ]);

  const lastRunByAction = new Map<string, string>();
  for (const row of logsRes.data ?? []) {
    if (!lastRunByAction.has(row.action)) lastRunByAction.set(row.action, row.created_at);
  }

  const integrations: IntegrationStatus[] = INTEGRATIONS.map((def) => ({
    ...def,
    configured: isIntegrationConfigured(def),
  }));
  const configuredCount = integrations.filter((i) => i.configured).length;

  const crons: CronStatus[] = CRONS.map((c) => ({
    ...c,
    instrumented: Boolean(c.loggedAction),
    lastRunAt: c.loggedAction ? lastRunByAction.get(c.loggedAction) ?? null : null,
  }));

  return {
    integrations,
    configuredCount,
    integrationCount: integrations.length,
    crons,
    overall: configuredCount === integrations.length ? "operational" : "degraded",
    scope: {
      agencies: agenciesRes.data?.length ?? 0,
      workspaces: workspacesRes.data?.length ?? 0,
      properties: propertiesRes.data?.length ?? 0,
    },
  };
}
