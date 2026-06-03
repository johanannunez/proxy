// apps/web/src/lib/admin/guest-intelligence.ts
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { getProperties, getPropertyReviews, getPropertyConversations } from '@/lib/hospitable';
import type { InsightPayload } from './insight-types';

const OPENROUTER_MODEL = 'anthropic/claude-haiku-4-5';

type ClaudeInsight = {
  title: string;
  body: string;
  severity: 'info' | 'recommendation' | 'warning' | 'critical';
  severityReason: string;
  sourceCount: number;
  sourceExcerpts: InsightPayload['sourceExcerpts'];
  suggestedFixes: string[];
};

type ClaudeResponse = {
  ownerUpdates: ClaudeInsight[];
  houseActionItems: ClaudeInsight[];
};

const SYSTEM_PROMPT = `You are an expert short-term rental property manager analyzing guest feedback for a management company. You will receive reviews and messages for a property and extract two lists of insights.

Rules for severity:
- "info": positive feedback or minor non-recurring suggestions worth noting
- "recommendation": recurring preference or opportunity for improvement
- "warning": recurring issue affecting guest experience, mentioned 2+ times
- "critical": safety/security concern, broken essential appliance, or severe issue regardless of mention count (e.g., smoke detector, door lock failure, flooding, no hot water)

sourceCount is the number of distinct reviews or messages that mention the issue.

suggestedFixes should be 1-3 concrete actionable steps specific to the issue. Not generic advice.

Return ONLY valid JSON matching this schema:
{
  "ownerUpdates": [ClaudeInsight],
  "houseActionItems": [ClaudeInsight]
}

ClaudeInsight schema:
{
  "title": "string (max 80 chars)",
  "body": "string (2-4 sentences, plain language synthesis)",
  "severity": "info" | "recommendation" | "warning" | "critical",
  "severityReason": "string (1 sentence explaining the severity decision)",
  "sourceCount": number,
  "sourceExcerpts": [{ "type": "review" | "message", "guestFirstName": "string", "approximateDate": "string", "quote": "string (relevant excerpt only)" }],
  "suggestedFixes": ["string"]
}

ownerUpdates: things the property owner should know (praise worth sharing, recurring concerns, revenue opportunities, patterns the owner needs context on).
houseActionItems: physical or operational issues that need to be fixed, maintained, or addressed at the property.

If there is nothing meaningful to report in a category, return an empty array. Do not invent issues.`;

function buildUserPrompt(propertyName: string, content: string): string {
  return `Property: ${propertyName}

Guest feedback (reviews and messages from the past 90 days):

${content}

Analyze this feedback and return the JSON response.`;
}

function buildFeedbackText(
  reviews: Awaited<ReturnType<typeof getPropertyReviews>>,
  conversations: Awaited<ReturnType<typeof getPropertyConversations>>,
): string {
  const parts: string[] = [];

  for (const r of reviews) {
    // 'public' and 'private' are reserved words — bracket notation required
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = r as any;
    const publicReview = (raw['public'] as { review?: string } | undefined)?.review;
    const privateFeedback = (raw['private'] as { feedback?: string | null } | undefined)?.feedback;
    if (!publicReview && !privateFeedback) continue;
    const name = r.guest?.first_name ?? 'Guest';
    const date = r.reviewed_at
      ? new Date(r.reviewed_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
      : 'Unknown date';
    const rating = (raw['public'] as { rating?: number } | undefined)?.rating;
    const ratingStr = rating ? ` (${rating}/5 stars)` : '';
    if (publicReview) parts.push(`[REVIEW] ${name}, ${date}${ratingStr}: "${publicReview}"`);
    if (privateFeedback) parts.push(`[PRIVATE FEEDBACK] ${name}, ${date}: "${privateFeedback}"`);
  }

  for (const conv of conversations) {
    const guestMsgs = (conv.messages ?? []).filter((m) => m.from === 'guest' && m.body);
    if (!guestMsgs.length) continue;
    const name = conv.guest?.first_name ?? 'Guest';
    for (const msg of guestMsgs.slice(0, 5)) {
      const date = msg.created_at
        ? new Date(msg.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
        : 'Unknown date';
      parts.push(`[MESSAGE] ${name}, ${date}: "${msg.body}"`);
    }
  }

  return parts.length > 0 ? parts.join('\n\n') : 'No guest feedback available.';
}

function isValidInsight(i: unknown): boolean {
  if (!i || typeof i !== 'object') return false;
  const ins = i as Record<string, unknown>;
  return (
    typeof ins.title === 'string' &&
    typeof ins.body === 'string' &&
    Array.isArray(ins.suggestedFixes) &&
    Array.isArray(ins.sourceExcerpts)
  );
}

async function analyzeProperty(
  propertyId: string,
  propertyName: string,
): Promise<ClaudeResponse | null> {
  const [reviews, conversations] = await Promise.all([
    getPropertyReviews(propertyId, 20),
    getPropertyConversations(propertyId, 10),
  ]);

  const feedbackText = buildFeedbackText(reviews, conversations);
  if (feedbackText === 'No guest feedback available.') return null;

  const apiKey = process.env.OPENROUTER_API_PROXY;
  if (!apiKey) throw new Error('OPENROUTER_API_PROXY is not set');

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
        max_tokens: 2000,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(propertyName, feedbackText) },
        ],
      }),
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenRouter error ${res.status}: ${body}`);
    }

    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    const text = data.choices[0]?.message?.content ?? '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (
      !Array.isArray(parsed?.ownerUpdates) ||
      !Array.isArray(parsed?.houseActionItems) ||
      parsed.ownerUpdates.some((i: unknown) => !isValidInsight(i)) ||
      parsed.houseActionItems.some((i: unknown) => !isValidInsight(i))
    ) {
      console.error('[gi] unexpected LLM response shape:', JSON.stringify(parsed).slice(0, 200));
      return null;
    }
    return parsed as ClaudeResponse;
  } catch (err) {
    console.error('[gi] openrouter error:', err);
    return null;
  }
}

async function writeInsights(
  supabase: ReturnType<typeof createServiceClient>,
  propertyId: string,
  insights: ClaudeInsight[],
  bucket: 'owner_update' | 'house_action',
): Promise<void> {
  for (let i = 0; i < insights.length; i++) {
    const ins = insights[i];
    const agentKey = `guest_intelligence:${bucket}:${i}`;
    const payload: InsightPayload = {
      bucket,
      severityReason: ins.severityReason,
      sourceCount: ins.sourceCount,
      sourceExcerpts: ins.sourceExcerpts,
      suggestedFixes: ins.suggestedFixes,
      isCritical: ins.severity === 'critical',
    };

    const dbSeverity =
      ins.severity === 'critical' ? 'warning' :
      ins.severity === 'warning' ? 'warning' :
      ins.severity === 'recommendation' ? 'recommendation' :
      'info';

    await supabase.from('ai_insights').upsert(
      {
        parent_type: 'property',
        parent_id: propertyId,
        agent_key: agentKey,
        severity: dbSeverity,
        title: ins.title,
        body: ins.body,
        action_payload: payload,
        dismissed_at: null,
      },
      { onConflict: 'parent_type,parent_id,agent_key' },
    );
  }
}

export async function runGuestIntelligenceSync(): Promise<{ processed: number; skipped: number }> {
  const supabase = createServiceClient();
  const hospProperties = await getProperties();

  // Map Hospitable property IDs to Supabase property IDs.
  // ai_insights.parent_id must use Supabase IDs so the dashboard can join them.
  const hospIds = hospProperties.map((p) => p.id);
  const { data: dbProperties } = await supabase
    .from('properties')
    .select('id, hospitable_property_id')
    .in('hospitable_property_id', hospIds);

  const hospToSupabase = new Map<string, string>();
  for (const p of dbProperties ?? []) {
    if (p.hospitable_property_id) hospToSupabase.set(p.hospitable_property_id, p.id);
  }

  let processed = 0;
  let skipped = 0;

  for (const prop of hospProperties) {
    const supabaseId = hospToSupabase.get(prop.id);
    if (!supabaseId) {
      skipped++;
      continue;
    }

    const propertyName = prop.public_name ?? prop.name;

    await supabase
      .from('ai_insights')
      .delete()
      .eq('parent_type', 'property')
      .eq('parent_id', supabaseId)
      .like('agent_key', 'guest_intelligence:%');

    const result = await analyzeProperty(prop.id, propertyName);
    if (!result) {
      skipped++;
      continue;
    }

    await Promise.all([
      writeInsights(supabase, supabaseId, result.ownerUpdates, 'owner_update'),
      writeInsights(supabase, supabaseId, result.houseActionItems, 'house_action'),
    ]);

    processed++;
  }

  return { processed, skipped };
}
