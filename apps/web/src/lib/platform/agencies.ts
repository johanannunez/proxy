import "server-only";
import { platformDb, getLastSignInMap } from "./service";

/**
 * Agencies directory + detail.
 *
 * The directory reads platform_agencies_overview (one row per agency) and augments
 * last-active with the freshest member sign-in (auth.users.last_sign_in_at), which
 * is truer than the view's activity_log-derived last_active_at.
 *
 * Detail adds the per-agency MRR breakdown, its workspaces, a workspace-grain
 * client-onboarding funnel (the populated funnel, vs the platform's agency-grain
 * one), a people breakdown, and recent activity.
 */

export type AgencyOverviewRow = {
  id: string;
  name: string;
  slug: string;
  plan_tier: string | null;
  created_at: string;
  has_billing: boolean;
  workspace_count: number;
  member_count: number;
  owner_count: number;
  property_count: number;
  mrr_cents: number;
  last_active_at: string | null;
};

export type AgencyDirectoryRow = AgencyOverviewRow & { lastActiveAt: string | null };

export async function getAgenciesDirectory(): Promise<AgencyDirectoryRow[]> {
  const db = platformDb();
  const [overviewRes, profilesRes, lastSignIn] = await Promise.all([
    db.from<AgencyOverviewRow[]>("platform_agencies_overview").select("*"),
    db.from<{ id: string; agency_id: string | null }[]>("profiles").select("id, agency_id"),
    getLastSignInMap(),
  ]);

  const freshestByAgency = new Map<string, number>();
  for (const p of profilesRes.data ?? []) {
    if (!p.agency_id) continue;
    const ts = lastSignIn.get(p.id);
    if (!ts) continue;
    const t = new Date(ts).getTime();
    const cur = freshestByAgency.get(p.agency_id) ?? 0;
    if (t > cur) freshestByAgency.set(p.agency_id, t);
  }

  return (overviewRes.data ?? []).map((row) => {
    const signIn = freshestByAgency.get(row.id);
    const viewTs = row.last_active_at ? new Date(row.last_active_at).getTime() : 0;
    const best = Math.max(signIn ?? 0, viewTs);
    return { ...row, lastActiveAt: best > 0 ? new Date(best).toISOString() : null };
  });
}

export type AgencyDetail = {
  agency: AgencyDirectoryRow;
  mrr: { reconciledCents: number; scheduleCents: number; legacyCents: number; legacyUnattributedCents: number };
  people: { owners: number; staff: number };
  clientFunnel: { label: string; count: number; definition: string }[];
  signedDocuments: number;
  workspaces: { id: string; name: string; type: string | null; createdAt: string; owners: number; hasPaidInvoice: boolean }[];
  recentActivity: { id: string; action: string; entityType: string | null; createdAt: string }[];
};

export async function getAgencyDetail(agencyId: string): Promise<AgencyDetail | null> {
  const db = platformDb();
  const directory = await getAgenciesDirectory();
  const agency = directory.find((a) => a.id === agencyId);
  if (!agency) return null;

  const [mrrRes, workspacesRes, profilesRes, paidRes, signedRes, activityRes] = await Promise.all([
    db
      .from<{ reconciled_mrr_cents: number; schedule_mrr_cents: number; legacy_mrr_cents: number; legacy_mrr_agency_total_cents: number }>(
        "platform_agency_operating_mrr",
      )
      .select("reconciled_mrr_cents, schedule_mrr_cents, legacy_mrr_cents, legacy_mrr_agency_total_cents")
      .eq("agency_id", agencyId)
      .maybeSingle(),
    db.from<{ id: string; name: string; type: string | null; created_at: string }[]>("workspaces").select("id, name, type, created_at").eq("agency_id", agencyId),
    db.from<{ role: string; workspace_id: string | null }[]>("profiles").select("role, workspace_id").eq("agency_id", agencyId),
    db.from<{ workspace_id: string | null }[]>("billing_invoices").select("workspace_id").eq("agency_id", agencyId).eq("status", "paid"),
    db.from<{ id: string }[]>("document_signers").select("id").eq("agency_id", agencyId).not("signed_at", "is", null),
    db
      .from<{ id: string; action: string; entity_type: string | null; created_at: string }[]>("activity_log")
      .select("id, action, entity_type, created_at")
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const profiles = profilesRes.data ?? [];
  const owners = profiles.filter((p) => p.role === "owner");
  const staff = profiles.filter((p) => p.role !== "owner");

  const ownerWorkspaceIds = new Set(owners.map((o) => o.workspace_id).filter(Boolean) as string[]);
  const paidWorkspaceIds = new Set((paidRes.data ?? []).map((p) => p.workspace_id).filter(Boolean) as string[]);

  const workspaces = (workspacesRes.data ?? []).map((w) => ({
    id: w.id,
    name: w.name,
    type: w.type,
    createdAt: w.created_at,
    owners: owners.filter((o) => o.workspace_id === w.id).length,
    hasPaidInvoice: paidWorkspaceIds.has(w.id),
  }));

  const mrr = mrrRes.data ?? {
    reconciled_mrr_cents: 0,
    schedule_mrr_cents: 0,
    legacy_mrr_cents: 0,
    legacy_mrr_agency_total_cents: 0,
  };

  return {
    agency,
    mrr: {
      reconciledCents: mrr.reconciled_mrr_cents,
      scheduleCents: mrr.schedule_mrr_cents,
      legacyCents: mrr.legacy_mrr_cents,
      legacyUnattributedCents: mrr.legacy_mrr_agency_total_cents,
    },
    people: { owners: owners.length, staff: staff.length },
    clientFunnel: [
      { label: "Workspaces", count: workspaces.length, definition: "Client hubs in this agency." },
      { label: "With an owner", count: ownerWorkspaceIds.size, definition: "Workspaces with at least one owner." },
      { label: "With a paid invoice", count: paidWorkspaceIds.size, definition: "Workspaces that have collected a payment." },
    ],
    signedDocuments: signedRes.data?.length ?? 0,
    workspaces: workspaces.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    recentActivity: (activityRes.data ?? []).map((a) => ({
      id: a.id,
      action: a.action,
      entityType: a.entity_type,
      createdAt: a.created_at,
    })),
  };
}
