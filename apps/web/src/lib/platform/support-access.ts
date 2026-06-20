import "server-only";
import { platformDb } from "./service";

/**
 * Support-access audit log — "the wall, with a paper trail."
 *
 * Impersonation (viewing-as) writes ONE activity_log row per session:
 * action='support_access_start', visibility='admin_only', metadata carries
 * started_at and access_mode; on exit the same row's metadata is stamped with
 * ended_at (there is no separate end row). So a session is "active" while its row
 * has no ended_at, and its duration is ended_at - started_at.
 *
 * Zero rows today (impersonation has never been exercised) — the surface renders an
 * honest empty state, which is itself the compliance story: nobody has entered an
 * agency yet, and when they do it will be logged here.
 */

export type SupportAccessSession = {
  id: string;
  actorName: string;
  agencyName: string | null;
  ownerName: string | null;
  accessMode: string;
  startedAt: string;
  endedAt: string | null;
  active: boolean;
  durationMs: number | null;
};

export type SupportAccessLog = {
  sessions: SupportAccessSession[];
  activeCount: number;
  totalCount: number;
};

type LogRow = {
  id: string;
  actor_id: string | null;
  agency_id: string | null;
  entity_id: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

function readString(meta: Record<string, unknown> | null, key: string): string | null {
  const v = meta?.[key];
  return typeof v === "string" ? v : null;
}

export async function getSupportAccessLog(limit = 50): Promise<SupportAccessLog> {
  const db = platformDb();
  const rowsRes = await db
    .from<LogRow[]>("activity_log")
    .select("id, actor_id, agency_id, entity_id, created_at, metadata")
    .eq("action", "support_access_start")
    .order("created_at", { ascending: false })
    .limit(limit);

  const rows = rowsRes.data ?? [];
  if (rows.length === 0) return { sessions: [], activeCount: 0, totalCount: 0 };

  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter(Boolean) as string[])];
  const ownerIds = [...new Set(rows.map((r) => r.entity_id).filter(Boolean) as string[])];
  const agencyIds = [...new Set(rows.map((r) => r.agency_id).filter(Boolean) as string[])];
  const profileIds = [...new Set([...actorIds, ...ownerIds])];

  const [profilesRes, agenciesRes] = await Promise.all([
    profileIds.length > 0
      ? db.from<{ id: string; full_name: string | null; email: string | null }[]>("profiles").select("id, full_name, email").in("id", profileIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string | null }[], error: null }),
    agencyIds.length > 0
      ? db.from<{ id: string; name: string }[]>("agencies").select("id, name").in("id", agencyIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
  ]);

  const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
  const agencyMap = new Map((agenciesRes.data ?? []).map((a) => [a.id, a.name]));

  const nameOf = (id: string | null) => {
    if (!id) return null;
    const p = profileMap.get(id);
    return p?.full_name ?? p?.email ?? null;
  };

  let activeCount = 0;
  const sessions: SupportAccessSession[] = rows.map((r) => {
    const startedAt = readString(r.metadata, "started_at") ?? r.created_at;
    const endedAt = readString(r.metadata, "ended_at");
    const active = !endedAt;
    if (active) activeCount += 1;
    return {
      id: r.id,
      actorName: nameOf(r.actor_id) ?? "Platform staff",
      agencyName: r.agency_id ? agencyMap.get(r.agency_id) ?? null : null,
      ownerName: nameOf(r.entity_id),
      accessMode: readString(r.metadata, "access_mode") ?? "full",
      startedAt,
      endedAt,
      active,
      durationMs: endedAt ? new Date(endedAt).getTime() - new Date(startedAt).getTime() : null,
    };
  });

  return { sessions, activeCount, totalCount: sessions.length };
}
