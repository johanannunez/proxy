// apps/web/src/lib/admin/communication-intelligence.ts
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import type { CommunicationInsightPayload } from './communication-types';

const OPENROUTER_MODEL = 'anthropic/claude-haiku-4-5';

type EventRow = {
  id: string;
  channel: 'call' | 'sms';
  direction: 'inbound' | 'outbound';
  phone_from: string;
  raw_transcript: string | null;
  duration_seconds: number | null;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
};

type ClaudeAnalysis = {
  tier: 'action_required' | 'fyi' | 'noise';
  summary: string;
  actionItems: string[];
  sentiment: 'positive' | 'neutral' | 'concerned';
};

type CommunicationTargetGroup = {
  targetType: 'owner' | 'contact' | 'vendor' | 'unknown';
  targetId: string | null;
  phoneFrom: string;
  events: EventRow[];
};

type QueryResult<Row> = {
  data: Row[] | null;
  error: { message: string } | null;
};

type MaybeSingleResult<Row> = {
  data: Row | null;
  error: { message: string } | null;
};

type QueryChain<Row> = PromiseLike<QueryResult<Row>> & {
  select(columns: string): QueryChain<Row>;
  update(values: Record<string, unknown>): QueryChain<Row>;
  upsert(values: Record<string, unknown>, options?: Record<string, unknown>): Promise<QueryResult<Row>>;
  eq(column: string, value: unknown): QueryChain<Row>;
  lte(column: string, value: unknown): QueryChain<Row>;
  is(column: string, value: unknown): QueryChain<Row>;
  order(column: string, options?: Record<string, unknown>): QueryChain<Row>;
  in(column: string, values: unknown[]): QueryChain<Row>;
  maybeSingle(): Promise<MaybeSingleResult<Row>>;
};

type UntypedServiceClient = {
  from<Row extends Record<string, unknown>>(table: string): QueryChain<Row>;
};

function table<Row extends Record<string, unknown>>(
  supabase: ReturnType<typeof createServiceClient>,
  name: string
): QueryChain<Row> {
  return (supabase as unknown as UntypedServiceClient).from<Row>(name);
}

async function callClaude(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<ClaudeAnalysis | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        max_tokens: 1000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenRouter error ${res.status}: ${body}`);
    }
    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const text = data.choices[0]?.message?.content ?? '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]) as ClaudeAnalysis;
  } catch (err) {
    console.error('[comm-intel] claude error:', err);
    return null;
  }
}

function buildSystemPrompt(): string {
  return `You are an AI assistant for a short-term rental property management company. Your job is to analyze a communication thread (calls and/or texts) between the property manager and one of their contacts, and classify the conversation.

Return a JSON object with exactly these fields:
{
  "tier": "action_required" | "fyi" | "noise",
  "summary": "One clear paragraph summarizing what was discussed.",
  "actionItems": ["string", ...],
  "sentiment": "positive" | "neutral" | "concerned"
}

Tier definitions:
- "action_required": The contact wants something, mentioned a problem, referenced an invoice or date/deadline, or the conversation needs a follow-up decision.
- "fyi": Informational update, confirmation, or check-in. Worth logging but no action needed.
- "noise": Purely social ("thanks", "sounds good", "on my way") with no substance. Do NOT surface this.

If tier is "noise", actionItems must be an empty array.
Always return valid JSON. No markdown, no explanation outside the JSON object.`;
}

function buildUserPrompt(group: CommunicationTargetGroup, targetContext: string): string {
  const lines: string[] = [
    `Contact: ${targetContext}`,
    `Communication window:`,
  ];
  for (const ev of group.events) {
    const direction = ev.direction === 'inbound' ? 'THEM' : 'YOU';
    const type = ev.channel === 'call' ? `[CALL ${ev.duration_seconds ?? '?'}s]` : '[SMS]';
    lines.push(`${type} ${direction}: ${ev.raw_transcript ?? '(no content)'}`);
  }
  return lines.join('\n');
}

async function getTargetContext(
  supabase: ReturnType<typeof createServiceClient>,
  group: CommunicationTargetGroup
): Promise<string> {
  if (!group.targetId || group.targetType === 'unknown') {
    return `Unknown caller (${group.phoneFrom})`;
  }
  if (group.targetType === 'owner') {
    const { data } = await table<{ full_name: string | null }>(supabase, 'profiles')
      .select('full_name')
      .eq('id', group.targetId)
      .maybeSingle();
    return data?.full_name ? `Owner: ${data.full_name}` : `Owner (${group.phoneFrom})`;
  }
  if (group.targetType === 'contact') {
    const { data } = await table<{ full_name: string | null; display_name: string | null; lifecycle_stage: string | null }>(supabase, 'contacts')
      .select('full_name, display_name, lifecycle_stage')
      .eq('id', group.targetId)
      .maybeSingle();
    const name = data?.display_name ?? data?.full_name ?? group.phoneFrom;
    return `Contact: ${name} (${data?.lifecycle_stage ?? 'unknown stage'})`;
  }
  if (group.targetType === 'vendor') {
    const { data } = await table<{ full_name: string | null; trade: string | null; company_name: string | null }>(supabase, 'vendors')
      .select('full_name, trade, company_name')
      .eq('id', group.targetId)
      .maybeSingle();
    const name = data?.full_name ?? group.phoneFrom;
    const trade = data?.trade ?? data?.company_name ?? 'vendor';
    return `Vendor: ${name} (${trade})`;
  }
  return group.phoneFrom;
}

export async function runCommunicationIntelligenceSync(): Promise<{
  processed: number;
  skipped: number;
  errors: number;
}> {
  const supabase = createServiceClient();
  const apiKey = process.env.OPENROUTER_API_PROXY;
  if (!apiKey) throw new Error('OPENROUTER_API_PROXY is not set');

  const now = new Date().toISOString();
  const { data: events, error } = await table<EventRow>(supabase, 'communication_events')
    .select(
      'id, channel, direction, phone_from, raw_transcript, duration_seconds, entity_type, entity_id, created_at'
    )
    .lte('process_after', now)
    .is('processed_at', null)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`[comm-intel] query error: ${error.message}`);
  if (!events || events.length === 0) return { processed: 0, skipped: 0, errors: 0 };

  const groupMap = new Map<string, CommunicationTargetGroup>();
  for (const ev of events as EventRow[]) {
    const key =
      ev.entity_id && ev.entity_type && ev.entity_type !== 'unknown'
        ? `${ev.entity_type}:${ev.entity_id}`
        : `unknown:${ev.phone_from}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        targetType: (ev.entity_type as CommunicationTargetGroup['targetType']) ?? 'unknown',
        targetId: ev.entity_id,
        phoneFrom: ev.phone_from,
        events: [],
      });
    }
    groupMap.get(key)!.events.push(ev);
  }

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const [, group] of groupMap) {
    const hasContent = group.events.some((e) => e.raw_transcript);
    if (!hasContent) {
      const ids = group.events.map((e) => e.id);
      await table<EventRow>(supabase, 'communication_events')
        .update({ processed_at: now, tier: 'noise' })
        .in('id', ids);
      skipped++;
      continue;
    }

    const targetContext = await getTargetContext(supabase, group);
    const analysis = await callClaude(
      apiKey,
      buildSystemPrompt(),
      buildUserPrompt(group, targetContext)
    );

    if (!analysis) {
      errors++;
      continue;
    }

    const eventIds = group.events.map((e) => e.id);
    const channel: CommunicationInsightPayload['channel'] =
      group.events.every((e) => e.channel === 'call')
        ? 'call'
        : group.events.every((e) => e.channel === 'sms')
        ? 'sms'
        : 'mixed';

    const { error: evUpdateError } = await table<EventRow>(supabase, 'communication_events')
      .update({
        processed_at: now,
        tier: analysis.tier,
        claude_summary: analysis.summary,
      })
      .in('id', eventIds);
    if (evUpdateError) {
      console.error('[comm-intel] event update error:', evUpdateError.message);
    }

    if (
      analysis.tier !== 'noise' &&
      group.targetType !== 'unknown' &&
      group.targetId
    ) {
      const hourKey = now.slice(0, 13).replace('T', ':');
      const agentKey = `communication:${hourKey}`;
      const payload: CommunicationInsightPayload = {
        bucket: 'communication',
        tier: analysis.tier,
        actionItems: analysis.actionItems,
        sentiment: analysis.sentiment,
        eventIds,
        channel,
      };

      const { error: insightError } = await table<Record<string, unknown>>(supabase, 'ai_insights').upsert(
        {
          parent_type: group.targetType,
          parent_id: group.targetId,
          agent_key: agentKey,
          severity: analysis.tier === 'action_required' ? 'recommendation' : 'info',
          title:
            analysis.tier === 'action_required'
              ? `Action needed: ${analysis.actionItems[0] ?? 'follow up'}`
              : `Update from ${targetContext.split(':')[1]?.trim() ?? 'contact'}`,
          body: analysis.summary,
          action_payload: payload,
          dismissed_at: null,
        },
        { onConflict: 'parent_type,parent_id,agent_key' }
      );
      if (insightError) {
        console.error('[comm-intel] insight upsert error:', insightError.message);
      }
    }

    processed++;
  }

  return { processed, skipped, errors };
}
