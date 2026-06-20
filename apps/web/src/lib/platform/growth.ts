import "server-only";
import { platformDb, getLastSignInMap } from "./service";
import { isoWeekStart, shortDate } from "./format";

/**
 * Growth + retention reads.
 *
 * Funnel is AGENCY grain (matches the wired PostHog events and the platform-owner
 * mental model: of agencies that sign up, how many reach each milestone). With one
 * agency today it is a single, honest path; the populated client funnel lives in
 * the agency detail view. Every step is computed from real rows, with its
 * definition surfaced in the UI.
 *
 * Retention uses auth.users.last_sign_in_at as the "active" signal (activity_log is
 * too sparse to be honest). A window is only measurable once it has elapsed for the
 * cohort — so a 9-day-old agency shows W1 but an honest "cohort too young" for W4.
 */

export type FunnelStage = {
  key: string;
  label: string;
  count: number;
  definition: string;
};

export type ActivationFunnel = {
  totalAgencies: number;
  stages: FunnelStage[];
};

function distinct(rows: { agency_id: string | null }[] | null): Set<string> {
  const set = new Set<string>();
  for (const r of rows ?? []) if (r.agency_id) set.add(r.agency_id);
  return set;
}

export async function getActivationFunnel(): Promise<ActivationFunnel> {
  const db = platformDb();

  const [agencies, workspaces, owners, signed, paid] = await Promise.all([
    db.from<{ id: string }[]>("agencies").select("id"),
    db.from<{ agency_id: string | null }[]>("workspaces").select("agency_id"),
    db.from<{ agency_id: string | null }[]>("profiles").select("agency_id").eq("role", "owner"),
    db.from<{ agency_id: string | null }[]>("document_signers").select("agency_id").not("signed_at", "is", null),
    db.from<{ agency_id: string | null }[]>("billing_invoices").select("agency_id").eq("status", "paid"),
  ]);

  const total = agencies.data?.length ?? 0;
  const withWorkspace = distinct(workspaces.data).size;
  const withInvite = distinct(owners.data).size;
  const withSign = distinct(signed.data).size;
  const withPayment = distinct(paid.data).size;

  return {
    totalAgencies: total,
    stages: [
      { key: "signup", label: "Signed up", count: total, definition: "Agency account exists." },
      { key: "workspace", label: "Created a workspace", count: withWorkspace, definition: "Agency has at least one client workspace." },
      { key: "invite", label: "Invited an owner", count: withInvite, definition: "Agency has at least one property owner." },
      { key: "sign", label: "First document signed", count: withSign, definition: "An owner has completed a signature." },
      { key: "payment", label: "First payment", count: withPayment, definition: "At least one invoice has been paid." },
    ],
  };
}

export type RetentionWindow = {
  measurable: boolean;
  retained: number;
  cohortMeasurable: number;
};

export type RetentionCohort = {
  weekStart: string; // ISO date
  label: string;
  size: number;
  w1: RetentionWindow;
  w4: RetentionWindow;
};

export type RetentionData = {
  cohorts: RetentionCohort[];
  totalAgencies: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getAgencyRetention(): Promise<RetentionData> {
  const db = platformDb();
  const [agenciesRes, profilesRes, lastSignIn] = await Promise.all([
    db.from<{ id: string; created_at: string }[]>("agencies").select("id, created_at"),
    db.from<{ id: string; agency_id: string | null; created_at: string }[]>("profiles").select("id, agency_id, created_at"),
    getLastSignInMap(),
  ]);

  const agencies = agenciesRes.data ?? [];
  const membersByAgency = new Map<string, string[]>();
  for (const p of profilesRes.data ?? []) {
    if (!p.agency_id) continue;
    const list = membersByAgency.get(p.agency_id) ?? [];
    list.push(p.id);
    membersByAgency.set(p.agency_id, list);
  }

  const now = Date.now();
  const cohortMap = new Map<string, RetentionCohort>();

  const windowFor = (agencyId: string, createdAt: string, days: number) => {
    const cutoff = new Date(createdAt).getTime() + days * DAY_MS;
    const measurable = cutoff <= now;
    if (!measurable) return { measurable: false, retained: 0 };
    const members = membersByAgency.get(agencyId) ?? [];
    const retained = members.some((id) => {
      const ts = lastSignIn.get(id);
      return ts != null && new Date(ts).getTime() >= cutoff;
    });
    return { measurable: true, retained: retained ? 1 : 0 };
  };

  for (const a of agencies) {
    const weekStart = isoWeekStart(a.created_at);
    const key = weekStart.toISOString().slice(0, 10);
    const cohort =
      cohortMap.get(key) ??
      ({
        weekStart: key,
        label: shortDate(weekStart),
        size: 0,
        w1: { measurable: false, retained: 0, cohortMeasurable: 0 },
        w4: { measurable: false, retained: 0, cohortMeasurable: 0 },
      } satisfies RetentionCohort);

    cohort.size += 1;
    const w1 = windowFor(a.id, a.created_at, 7);
    const w4 = windowFor(a.id, a.created_at, 28);
    if (w1.measurable) {
      cohort.w1.measurable = true;
      cohort.w1.cohortMeasurable += 1;
      cohort.w1.retained += w1.retained;
    }
    if (w4.measurable) {
      cohort.w4.measurable = true;
      cohort.w4.cohortMeasurable += 1;
      cohort.w4.retained += w4.retained;
    }
    cohortMap.set(key, cohort);
  }

  const cohorts = [...cohortMap.values()].sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));
  return { cohorts, totalAgencies: agencies.length };
}

export type SignupsPoint = {
  weekStart: string;
  label: string;
  agencies: number;
  owners: number;
};

export type SignupsTrend = {
  points: SignupsPoint[];
  agenciesThisWeek: number;
  agenciesLastWeek: number;
  ownersThisWeek: number;
  ownersLastWeek: number;
};

export async function getSignupsTrend(weeks = 8): Promise<SignupsTrend> {
  const db = platformDb();
  const [agenciesRes, ownersRes] = await Promise.all([
    db.from<{ created_at: string }[]>("agencies").select("created_at"),
    db.from<{ created_at: string }[]>("profiles").select("created_at").eq("role", "owner"),
  ]);

  const thisWeekStart = isoWeekStart(new Date());
  const buckets: SignupsPoint[] = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const start = new Date(thisWeekStart.getTime() - i * 7 * DAY_MS);
    buckets.push({
      weekStart: start.toISOString().slice(0, 10),
      label: shortDate(start),
      agencies: 0,
      owners: 0,
    });
  }
  const indexByKey = new Map(buckets.map((b, i) => [b.weekStart, i]));

  const bump = (createdAt: string, field: "agencies" | "owners") => {
    const key = isoWeekStart(createdAt).toISOString().slice(0, 10);
    const idx = indexByKey.get(key);
    if (idx != null) buckets[idx][field] += 1;
  };
  for (const a of agenciesRes.data ?? []) bump(a.created_at, "agencies");
  for (const o of ownersRes.data ?? []) bump(o.created_at, "owners");

  const last = buckets[buckets.length - 1] ?? { agencies: 0, owners: 0 };
  const prev = buckets[buckets.length - 2] ?? { agencies: 0, owners: 0 };
  return {
    points: buckets,
    agenciesThisWeek: last.agencies,
    agenciesLastWeek: prev.agencies,
    ownersThisWeek: last.owners,
    ownersLastWeek: prev.owners,
  };
}
