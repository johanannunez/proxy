// apps/web/src/lib/admin/dashboard-v2.ts
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { LifecycleStage } from './contact-types';

// ─── Pipeline Pulse ───────────────────────────────────────────────────────────

export type PipelineStageRow = {
  stage: LifecycleStage;
  label: string;
  count: number;
  totalMrr: number;
};

export type PipelinePulseData = {
  stages: PipelineStageRow[];
  totalPipelineValue: number;
  totalLeads: number;
};

const STAGE_LABELS: Partial<Record<LifecycleStage, string>> = {
  lead_new: 'Inquiry',
  qualified: 'Qualified',
  in_discussion: 'In Talks',
  contract_sent: 'Contract Sent',
};

const LEAD_STAGES: LifecycleStage[] = ['lead_new', 'qualified', 'in_discussion', 'contract_sent'];

export async function fetchPipelinePulse(): Promise<PipelinePulseData> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('contacts')
    .select('lifecycle_stage, estimated_mrr')
    .in('lifecycle_stage', LEAD_STAGES);

  const stageMap = new Map<LifecycleStage, { count: number; mrr: number }>();
  for (const stage of LEAD_STAGES) {
    stageMap.set(stage, { count: 0, mrr: 0 });
  }

  for (const row of data ?? []) {
    const s = stageMap.get(row.lifecycle_stage as LifecycleStage);
    if (s) {
      s.count++;
      s.mrr += row.estimated_mrr ?? 0;
    }
  }

  const stages: PipelineStageRow[] = LEAD_STAGES.map((stage) => ({
    stage,
    label: STAGE_LABELS[stage] ?? stage,
    count: stageMap.get(stage)!.count,
    totalMrr: stageMap.get(stage)!.mrr,
  }));

  const totalLeads = stages.reduce((s, r) => s + r.count, 0);
  const totalPipelineValue = stages.reduce((s, r) => s + r.totalMrr, 0);

  return { stages, totalLeads, totalPipelineValue };
}

// ─── Cold Leads ───────────────────────────────────────────────────────────────

export type ColdLead = {
  id: string;
  name: string;
  daysDormant: number;
  estimatedMrr: number;
  lastStage: LifecycleStage;
};

export type ColdLeadsData = {
  total: number;
  topLeads: ColdLead[];
};

export async function fetchColdLeads(): Promise<ColdLeadsData> {
  const supabase = await createClient();
  const { data, count } = await supabase
    .from('contacts')
    .select('id, full_name, last_activity_at, estimated_mrr, lifecycle_stage', { count: 'exact' })
    .eq('lifecycle_stage', 'lead_cold')
    .order('last_activity_at', { ascending: true, nullsFirst: true })
    .limit(5);

  const now = Date.now();
  const topLeads: ColdLead[] = (data ?? []).map((c) => ({
    id: c.id,
    name: c.full_name,
    daysDormant: c.last_activity_at
      ? Math.floor((now - new Date(c.last_activity_at).getTime()) / 86_400_000)
      : 999,
    estimatedMrr: c.estimated_mrr ?? 0,
    lastStage: c.lifecycle_stage as LifecycleStage,
  }));

  return { total: count ?? 0, topLeads };
}

// ─── Today's Schedule ─────────────────────────────────────────────────────────

export type ScheduleItem = {
  id: string;
  title: string;
  taskType: string;
  dueAt: string;
  propertyName: string | null;
  contactName: string | null;
  isOverdue: boolean;
  assigneeName: string | null;
};

export type TodayScheduleData = {
  items: ScheduleItem[];
  overdueCount: number;
};

export async function fetchTodaySchedule(): Promise<TodayScheduleData> {
  const supabase = await createClient();
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const twoDaysAgo = new Date(now.getTime() - 2 * 86_400_000).toISOString();

  const { data } = await supabase
    .from('tasks')
    .select(`
      id, title, task_type, due_at,
      assignee:profiles!tasks_assignee_id_fkey(full_name),
      contact:contacts!tasks_linked_contact_id_fkey(full_name),
      property:properties!tasks_linked_property_id_fkey(address_line1, name)
    `)
    .not('status', 'in', '("done")')
    .gte('due_at', twoDaysAgo)
    .lte('due_at', endOfToday.toISOString())
    .is('parent_task_id', null)
    .order('due_at', { ascending: true })
    .limit(20);

  const nowIso = now.toISOString();
  const items: ScheduleItem[] = (data ?? [])
    .filter((t) => t.due_at !== null)
    .map((t) => {
      const assignee = Array.isArray(t.assignee) ? t.assignee[0] : t.assignee;
      const contact = Array.isArray(t.contact) ? t.contact[0] : t.contact;
      const property = Array.isArray(t.property) ? t.property[0] : t.property;
      const dueAt = t.due_at as string;

      return {
        id: t.id,
        title: t.title,
        taskType: t.task_type ?? 'todo',
        dueAt,
        propertyName: (property as { address_line1?: string; name?: string } | null)?.address_line1 ??
          (property as { address_line1?: string; name?: string } | null)?.name ?? null,
        contactName: (contact as { full_name?: string } | null)?.full_name ?? null,
        isOverdue: dueAt < nowIso,
        assigneeName: (assignee as { full_name?: string } | null)?.full_name ?? null,
      };
    });

  const overdueCount = items.filter((i) => i.isOverdue).length;
  return { items, overdueCount };
}

// ─── Onboarding Progress ──────────────────────────────────────────────────────

export type OnboardingContact = {
  id: string;
  name: string;
  daysInStage: number;
  properties: Array<{
    id: string;
    address: string;
    checklistPct: number;
    worstStatus: string | null;
  }>;
};

export type OnboardingProgressData = {
  contacts: OnboardingContact[];
  total: number;
};

export async function fetchOnboardingProgress(): Promise<OnboardingProgressData> {
  const supabase = await createClient();

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, full_name, stage_changed_at')
    .eq('lifecycle_stage', 'onboarding')
    .order('stage_changed_at', { ascending: true });

  if (!contacts?.length) return { contacts: [], total: 0 };

  const contactIds = contacts.map((c) => c.id);
  const { data: properties } = await supabase
    .from('properties')
    .select('id, name, address_line1, contact_id')
    .in('contact_id', contactIds)
    .eq('active', true);

  const propIds = (properties ?? []).map((p) => p.id);
  const { data: checklistItems } = propIds.length
    ? await supabase
        .from('property_checklist_items')
        .select('property_id, status')
        .in('property_id', propIds)
    : { data: [] };

  const now = Date.now();
  const STATUS_RANK: Record<string, number> = { stuck: 3, pending_owner: 2, in_progress: 1, not_started: 0, completed: -1 };

  const result: OnboardingContact[] = contacts.map((c) => {
    const props = (properties ?? []).filter((p) => p.contact_id === c.id);
    const daysInStage = Math.floor((now - new Date(c.stage_changed_at).getTime()) / 86_400_000);

    return {
      id: c.id,
      name: c.full_name,
      daysInStage,
      properties: props.map((p) => {
        const items = (checklistItems ?? []).filter((i) => i.property_id === p.id);
        const done = items.filter((i) => i.status === 'completed').length;
        const total = Math.max(items.length, 1);
        const worst = items.reduce<string | null>((acc, i) => {
          const rank = STATUS_RANK[i.status] ?? -1;
          return acc === null || rank > (STATUS_RANK[acc] ?? -1) ? i.status : acc;
        }, null);
        return {
          id: p.id,
          address: p.address_line1 ?? p.name ?? 'Property',
          checklistPct: Math.round((done / total) * 100),
          worstStatus: worst,
        };
      }),
    };
  });

  return { contacts: result, total: result.length };
}

// ─── AI Risk Digest ───────────────────────────────────────────────────────────

export type RiskInsight = {
  id: string;
  propertyId: string;
  propertyName: string;
  agentKey: string;
  severity: 'warning' | 'info' | 'recommendation' | 'success';
  title: string;
  body: string;
  createdAt: string;
  isCritical: boolean;
};

export type AIRiskDigestData = {
  insights: RiskInsight[];
  totalUnresolved: number;
  criticalCount: number;
  warningCount: number;
};

export async function fetchAIRiskDigest(): Promise<AIRiskDigestData> {
  const supabase = await createClient();

  const [{ data: warnings, count: warningCount }, { data: props }] = await Promise.all([
    supabase
      .from('ai_insights')
      .select('id, parent_id, agent_key, severity, title, body, action_payload, created_at', { count: 'exact' })
      .eq('parent_type', 'property')
      .in('severity', ['warning', 'recommendation'])
      .is('dismissed_at', null)
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('properties')
      .select('id, name, address_line1'),
  ]);

  const propMap = new Map((props ?? []).map((p) => [p.id, p.address_line1 ?? p.name ?? 'Property']));

  const insights: RiskInsight[] = (warnings ?? []).map((w) => {
    const payload = w.action_payload as { isCritical?: boolean } | null;
    return {
      id: w.id,
      propertyId: w.parent_id,
      propertyName: propMap.get(w.parent_id) ?? 'Unknown Property',
      agentKey: w.agent_key,
      severity: w.severity as RiskInsight['severity'],
      title: w.title,
      body: w.body,
      createdAt: w.created_at,
      isCritical: payload?.isCritical ?? false,
    };
  });

  const criticalCount = insights.filter((i) => i.isCritical).length;

  return {
    insights,
    totalUnresolved: warningCount ?? 0,
    criticalCount,
    warningCount: (warningCount ?? 0) - criticalCount,
  };
}

// ─── Open Invoices ────────────────────────────────────────────────────────────

export type OpenInvoiceRow = {
  id: string;
  ownerName: string;
  ownerId: string;
  amountCents: number;
  kind: string;
  status: string;
  dueAt: string | null;
  daysOverdue: number;
};

export type OpenInvoicesData = {
  invoices: OpenInvoiceRow[];
  totalCents: number;
  overdueCount: number;
  total: number;
};

export async function fetchOpenInvoices(): Promise<OpenInvoicesData> {
  const supabase = await createClient();
  const now = Date.now();

  const { data } = await supabase
    .from('invoices')
    .select(`
      id, owner_id, amount_cents, kind, status, due_at,
      owner:profiles!invoices_owner_id_fkey(full_name)
    `)
    .in('status', ['open', 'draft'])
    .order('due_at', { ascending: true, nullsFirst: false })
    .limit(10);

  const invoices: OpenInvoiceRow[] = (data ?? []).map((inv) => {
    const owner = Array.isArray(inv.owner) ? inv.owner[0] : inv.owner;
    const daysOverdue = inv.due_at && new Date(inv.due_at).getTime() < now
      ? Math.floor((now - new Date(inv.due_at).getTime()) / 86_400_000)
      : 0;
    return {
      id: inv.id,
      ownerName: (owner as { full_name?: string } | null)?.full_name ?? 'Unknown',
      ownerId: inv.owner_id,
      amountCents: inv.amount_cents ?? 0,
      kind: inv.kind,
      status: inv.status,
      dueAt: inv.due_at,
      daysOverdue,
    };
  });

  const totalCents = invoices.reduce((s, i) => s + i.amountCents, 0);
  const overdueCount = invoices.filter((i) => i.daysOverdue > 0).length;

  return { invoices, totalCents, overdueCount, total: data?.length ?? 0 };
}

// ─── Recurring Maintenance ────────────────────────────────────────────────────

export type MaintenanceTask = {
  id: string;
  templateName: string;
  propertyName: string;
  propertyId: string;
  nextDueAt: string;
  daysUntilDue: number;
  estimatedMinutes: number | null;
  isOverdue: boolean;
};

export type RecurringMaintenanceData = {
  tasks: MaintenanceTask[];
  overdueCount: number;
  dueSoonCount: number; // within 7 days
};

export async function fetchRecurringMaintenance(): Promise<RecurringMaintenanceData> {
  const supabase = await createClient();
  const now = new Date();
  const thirtyDaysOut = new Date(now.getTime() + 30 * 86_400_000).toISOString();
  const thirtyDaysBack = new Date(now.getTime() - 30 * 86_400_000).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('property_task_templates')
    .select(`
      id, next_due_at,
      template:task_templates!property_task_templates_template_id_fkey(name, estimated_minutes),
      property:properties!property_task_templates_property_id_fkey(id, name, address_line1)
    `)
    .eq('is_active', true)
    .gte('next_due_at', thirtyDaysBack)
    .lte('next_due_at', thirtyDaysOut)
    .order('next_due_at', { ascending: true })
    .limit(10);

  type RawTemplateRow = {
    id: string;
    next_due_at: string;
    template: { name: string; estimated_minutes: number | null } | null;
    property: { id: string; name: string | null; address_line1: string | null } | null;
  };

  const tasks: MaintenanceTask[] = ((data ?? []) as RawTemplateRow[]).map((row) => {
    const dueTime = new Date(row.next_due_at).getTime();
    const nowTime = now.getTime();
    const diffDays = Math.floor((dueTime - nowTime) / 86_400_000);
    const tmpl = Array.isArray(row.template) ? row.template[0] : row.template;
    const prop = Array.isArray(row.property) ? row.property[0] : row.property;

    return {
      id: row.id,
      templateName: (tmpl as { name?: string } | null)?.name ?? 'Maintenance',
      propertyName: (prop as { address_line1?: string; name?: string } | null)?.address_line1 ??
        (prop as { address_line1?: string; name?: string } | null)?.name ?? 'Property',
      propertyId: (prop as { id?: string } | null)?.id ?? '',
      nextDueAt: row.next_due_at,
      daysUntilDue: diffDays,
      estimatedMinutes: (tmpl as { estimated_minutes?: number } | null)?.estimated_minutes ?? null,
      isOverdue: diffDays < 0,
    };
  });

  const overdueCount = tasks.filter((t) => t.isOverdue).length;
  const dueSoonCount = tasks.filter((t) => !t.isOverdue && t.daysUntilDue <= 7).length;

  return { tasks, overdueCount, dueSoonCount };
}

// ─── Project Board ────────────────────────────────────────────────────────────

export type ProjectBoardData = {
  notStarted: number;
  inProgress: number;
  blocked: number;
  done: number;
  blockedProjects: Array<{ id: string; name: string; emoji: string | null; daysSinceUpdate: number }>;
  total: number;
};

export async function fetchProjectBoard(): Promise<ProjectBoardData> {
  const supabase = await createClient();
  const now = Date.now();

  const { data } = await supabase
    .from('projects')
    .select('id, name, status, emoji, updated_at')
    .neq('status', 'archived')
    .order('updated_at', { ascending: false });

  const counts = { not_started: 0, in_progress: 0, blocked: 0, done: 0 };
  const blockedProjects: ProjectBoardData['blockedProjects'] = [];

  for (const p of data ?? []) {
    const s = p.status as keyof typeof counts;
    if (s in counts) counts[s]++;
    if (p.status === 'blocked') {
      blockedProjects.push({
        id: p.id,
        name: p.name,
        emoji: p.emoji,
        daysSinceUpdate: Math.floor((now - new Date(p.updated_at).getTime()) / 86_400_000),
      });
    }
  }

  return {
    notStarted: counts.not_started,
    inProgress: counts.in_progress,
    blocked: counts.blocked,
    done: counts.done,
    blockedProjects,
    total: data?.length ?? 0,
  };
}

// ─── Winback Queue ────────────────────────────────────────────────────────────

export type WinbackContact = {
  id: string;
  name: string;
  stage: LifecycleStage;
  daysDormant: number;
  estimatedMrr: number;
  insightTitle: string | null;
  insightBody: string | null;
};

export type WinbackQueueData = {
  contacts: WinbackContact[];
  total: number;
};

export async function fetchWinbackQueue(): Promise<WinbackQueueData> {
  const supabase = await createClient();
  const now = Date.now();

  const [{ data: dormant }, { data: insights }] = await Promise.all([
    supabase
      .from('contacts')
      .select('id, full_name, lifecycle_stage, last_activity_at, estimated_mrr')
      .in('lifecycle_stage', ['paused', 'churned'])
      .order('estimated_mrr', { ascending: false, nullsFirst: false })
      .limit(6),
    supabase
      .from('ai_insights')
      .select('parent_id, title, body')
      .eq('agent_key', 'winback_agent')
      .is('dismissed_at', null),
  ]);

  const insightMap = new Map<string, { title: string; body: string }>();
  for (const i of insights ?? []) {
    if (!insightMap.has(i.parent_id)) {
      insightMap.set(i.parent_id, { title: i.title, body: i.body });
    }
  }

  const contacts: WinbackContact[] = (dormant ?? []).map((c) => {
    const insight = insightMap.get(c.id);
    return {
      id: c.id,
      name: c.full_name,
      stage: c.lifecycle_stage as LifecycleStage,
      daysDormant: c.last_activity_at
        ? Math.floor((now - new Date(c.last_activity_at).getTime()) / 86_400_000)
        : 999,
      estimatedMrr: c.estimated_mrr ?? 0,
      insightTitle: insight?.title ?? null,
      insightBody: insight?.body ?? null,
    };
  });

  return { contacts, total: contacts.length };
}

// ─── Trend Data ─────────────────────────────────────────────────────────────

export type TrendPoint = { date: string; value: number };

export async function fetchRevenueCollectedTrend(): Promise<TrendPoint[]> {
  try {
    const supabase = await createClient();
    const { data: rows } = await (supabase as unknown as {
      from(table: 'invoices'): {
        select(cols: string): {
          not(col: string, op: string, val: null): {
            gte(col: string, val: string): Promise<{ data: Array<{ paid_at: string; amount_cents: number }> | null }>;
          };
        };
      };
    })
      .from('invoices')
      .select('paid_at, amount_cents')
      .not('paid_at', 'is', null)
      .gte('paid_at', new Date(Date.now() - 210 * 86_400_000).toISOString());

    if (!rows || rows.length === 0) return [];

    const buckets = new Map<string, number>();
    for (const row of rows) {
      const d = new Date(row.paid_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      buckets.set(key, (buckets.get(key) ?? 0) + row.amount_cents);
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([date, value]) => ({ date, value: Math.round(value / 100) }));
  } catch {
    return [];
  }
}
