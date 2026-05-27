import { normalizePhone } from "@/lib/admin/normalize-phone";

export type CommunicationDashboardInsightRow = {
  id: string;
  title: string;
  body: string;
  parent_type: string;
  parent_id: string;
  created_at: string;
};

export type CommunicationDashboardUnresolvedRow = {
  phone_from: string;
  claude_summary: string | null;
  created_at: string;
};

export type CommunicationsDashboardData = {
  recentActionItems: Array<{
    id: string;
    title: string;
    body: string;
    entityType: string;
    workspaceId: string;
    createdAt: string;
  }>;
  unresolvedCallers: Array<{
    phone: string;
    claudeSummary: string | null;
    createdAt: string;
  }>;
};

export function buildCommunicationsDashboardData(args: {
  insightRows: CommunicationDashboardInsightRow[];
  unresolvedRows: CommunicationDashboardUnresolvedRow[];
}): CommunicationsDashboardData {
  const recentActionItems = args.insightRows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    entityType: row.parent_type,
    workspaceId: row.parent_id,
    createdAt: row.created_at,
  }));

  const seenPhones = new Set<string>();
  const unresolvedCallers: CommunicationsDashboardData["unresolvedCallers"] = [];
  for (const row of args.unresolvedRows) {
    const phone = normalizePhone(row.phone_from);
    if (!phone || seenPhones.has(phone)) continue;
    seenPhones.add(phone);
    unresolvedCallers.push({
      phone,
      claudeSummary: row.claude_summary,
      createdAt: row.created_at,
    });
  }

  return { recentActionItems, unresolvedCallers };
}
