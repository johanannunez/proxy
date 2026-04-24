import { createClient } from '@/lib/supabase/server';

export type InsightSeverity = 'info' | 'recommendation' | 'warning' | 'success';

export type Insight = {
  id: string;
  parentType: 'contact' | 'property' | 'project';
  parentId: string;
  agentKey: string;
  severity: InsightSeverity;
  title: string;
  body: string;
  actionLabel: string | null;
  createdAt: string;
};

export async function fetchInsightsByParent(
  parentType: Insight['parentType'],
  parentIds: string[],
): Promise<Record<string, Insight[]>> {
  if (parentIds.length === 0) return {};
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('ai_insights')
    .select('id, parent_type, parent_id, agent_key, severity, title, body, action_label, created_at')
    .eq('parent_type', parentType)
    .in('parent_id', parentIds)
    .is('dismissed_at', null)
    .is('completed_at', null)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[ai-insights] fetch error:', error.code, error.message);
    return {};
  }
  const map: Record<string, Insight[]> = {};
  for (const r of data ?? []) {
    if (!map[r.parent_id]) map[r.parent_id] = [];
    map[r.parent_id].push({
      id: r.id,
      parentType: r.parent_type as Insight['parentType'],
      parentId: r.parent_id,
      agentKey: r.agent_key,
      severity: r.severity as InsightSeverity,
      title: r.title,
      body: r.body,
      actionLabel: r.action_label,
      createdAt: r.created_at,
    });
  }
  return map;
}

export async function fetchInsightsByParentWithPayload(
  parentType: Insight['parentType'],
  parentIds: string[],
): Promise<Record<string, Array<Insight & { actionPayload: unknown }>>> {
  if (parentIds.length === 0) return {};
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('ai_insights')
    .select('id, parent_type, parent_id, agent_key, severity, title, body, action_label, action_payload, created_at')
    .eq('parent_type', parentType)
    .in('parent_id', parentIds)
    .is('dismissed_at', null)
    .is('completed_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const map: Record<string, Array<Insight & { actionPayload: unknown }>> = {};
  for (const r of data ?? []) {
    if (!map[r.parent_id]) map[r.parent_id] = [];
    map[r.parent_id].push({
      id: r.id,
      parentType: r.parent_type as Insight['parentType'],
      parentId: r.parent_id,
      agentKey: r.agent_key,
      severity: r.severity as InsightSeverity,
      title: r.title,
      body: r.body,
      actionLabel: r.action_label,
      createdAt: r.created_at,
      actionPayload: r.action_payload,
    });
  }
  return map;
}
