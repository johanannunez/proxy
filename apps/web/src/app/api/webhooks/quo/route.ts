// apps/web/src/app/api/webhooks/quo/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { createServiceClient } from '@/lib/supabase/service';
import { resolvePhone } from '@/lib/admin/resolve-phone';
import {
  buildOwnerSmsMessage,
  getPayloadObject,
  isHandledQuoEvent,
  normalizeQuoWebhookPayload,
  readTextField,
  shouldAppendOwnerSmsMessage,
} from './routing';

export const dynamic = 'force-dynamic';

type WebhookQueryError = { code?: string; message?: string };
type WebhookQueryResult = {
  data: Record<string, unknown> | null;
  error: WebhookQueryError | null;
};
type WebhookQuery = PromiseLike<WebhookQueryResult> & {
  select(columns: string): WebhookQuery;
  eq(column: string, value: unknown): WebhookQuery;
  insert(values: Record<string, unknown>): WebhookQuery;
  update(values: Record<string, unknown>): WebhookQuery;
  upsert(values: Record<string, unknown>, options?: { onConflict?: string; ignoreDuplicates?: boolean }): WebhookQuery;
  limit(count: number): WebhookQuery;
  maybeSingle(): Promise<WebhookQueryResult>;
  single(): Promise<WebhookQueryResult>;
};
type WebhookDatabase = {
  from(table: string): WebhookQuery;
};

async function appendOwnerSmsMessage(args: {
  supabase: WebhookDatabase;
  ownerId: string;
  senderId: string;
  body: string;
  quoId: string;
  direction: 'inbound' | 'outbound';
  phoneFrom: string;
  phoneTo: string;
}): Promise<void> {
  const existingMessage = await args.supabase
    .from('messages')
    .select('id')
    .eq('metadata->>quo_id', args.quoId)
    .maybeSingle();

  if (existingMessage.data) return;

  const { data: conversation, error: conversationError } = await args.supabase
    .from('conversations')
    .select('id')
    .eq('owner_id', args.ownerId)
    .eq('type', 'direct')
    .maybeSingle();

  if (conversationError) {
    console.error('[quo-webhook] conversation lookup error:', conversationError.code, conversationError.message);
    return;
  }

  let conversationId = conversation?.id as string | undefined;
  if (!conversationId) {
    const { data: createdConversation, error: createError } = await args.supabase
      .from('conversations')
      .insert({ owner_id: args.ownerId, type: 'direct', subject: null })
      .select('id')
      .single();

    if (createError || !createdConversation) {
      console.error('[quo-webhook] conversation create error:', createError?.code, createError?.message);
      return;
    }

    conversationId = createdConversation.id as string;
  }

  const { error: messageError } = await args.supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: args.senderId,
    body: args.body,
    delivery_method: 'sms',
    metadata: {
      source: 'quo',
      quo_id: args.quoId,
      direction: args.direction,
      phone_from: args.phoneFrom,
      phone_to: args.phoneTo,
    },
  });

  if (messageError) {
    console.error('[quo-webhook] message insert error:', messageError.code, messageError.message);
  }
}

function verifySignature(body: string, signatureHeader: string, secret: string): boolean {
  const signatures = signatureHeader.split(',').map((signature) => signature.trim()).filter(Boolean);
  if (signatures.length === 0) return false;

  return signatures.some((signature) => verifySingleSignature(body, signature, secret));
}

function verifySingleSignature(body: string, signature: string, secret: string): boolean {
  const parts = signature.split(';');
  if (parts.length === 4 && parts[0] === 'hmac' && parts[1] === '1') {
    const timestamp = parts[2];
    const providedDigest = parts[3];
    if (!timestamp || !providedDigest) return false;

    const timestampMs = Number(timestamp);
    if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) {
      return false;
    }

    const signedData = `${timestamp}.${body}`;
    const expected = createHmac('sha256', Buffer.from(secret, 'base64'))
      .update(Buffer.from(signedData, 'utf8'))
      .digest('base64');

    return timingSafeStringEqual(expected, providedDigest);
  }

  const expected = createHmac('sha256', secret).update(body).digest('hex');
  return timingSafeStringEqual(expected, signature);
}

function timingSafeStringEqual(expected: string, actual: string): boolean {
  try {
    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(actual);
    return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.QUO_WEBHOOK_SECRET;
  const rawBody = await req.text();

  if (!secret) {
    if (process.env.NODE_ENV !== 'development') {
      console.error('[quo-webhook] QUO_WEBHOOK_SECRET not configured');
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  } else {
    const sig = req.headers.get('openphone-signature') ?? req.headers.get('x-openphone-signature') ?? '';
    if (!verifySignature(rawBody, sig, secret)) {
      console.warn('[quo-webhook] invalid signature');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const event = payload.type as string | undefined;
  const data = getPayloadObject(payload);

  if (!isHandledQuoEvent(event) || !data) {
    return NextResponse.json({ ok: true, skipped: event ?? 'missing event' });
  }

  const quoId = readTextField(data.id) ?? readTextField(data.callId) ?? readTextField(data.messageId) ?? readTextField(payload.id);
  if (!quoId) {
    return NextResponse.json({ ok: true, skipped: 'no id' });
  }

  const supabase = createServiceClient() as unknown as WebhookDatabase;

  // call.recording.completed and call.summary.completed update an existing row.
  if (event === 'call.recording.completed') {
    const recordingUrl = readTextField(data.recordingUrl) ?? readTextField(data.url);
    if (recordingUrl) {
      const { error: recordingError } = await supabase
        .from('communication_events')
        .update({ recording_url: recordingUrl })
        .eq('quo_id', quoId);
      if (recordingError) {
        console.error('[quo-webhook] recording update error:', recordingError.code, recordingError.message);
      }
    }
    return NextResponse.json({ ok: true });
  }

  if (event === 'call.summary.completed') {
    const summary = readTextField(data.summary) ?? readTextField(data.text);
    if (summary) {
      const { error: summaryError } = await supabase
        .from('communication_events')
        .update({ quo_summary: summary })
        .eq('quo_id', quoId);
      if (summaryError) {
        console.error('[quo-webhook] summary update error:', summaryError.code, summaryError.message);
      }
    }
    return NextResponse.json({ ok: true });
  }

  // Insert path: call.transcript.completed, message.received, message.sent, message.delivered
  const normalizedEvent = normalizeQuoWebhookPayload(payload);
  if (!normalizedEvent) {
    return NextResponse.json({ ok: true, skipped: 'missing event data' });
  }
  const resolved = await resolvePhone(normalizedEvent.resolvedPhone);

  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle();

  if (!adminProfile) {
    console.error('[quo-webhook] no admin profile found. Cannot insert communication_events row because profile_id is NOT NULL. Skipping event', quoId);
    return NextResponse.json({ ok: true, skipped: 'no admin profile' });
  }

  const processAfter = normalizedEvent.processAfter
    ? new Date(Date.now() + 25 * 60 * 1000).toISOString()
    : null;

  const { error } = await supabase.from('communication_events').upsert(
    {
      profile_id: adminProfile.id,
      quo_id: normalizedEvent.quoId,
      channel: normalizedEvent.channel,
      direction: normalizedEvent.direction,
      phone_from: normalizedEvent.phoneFrom,
      phone_to: normalizedEvent.phoneTo,
      raw_transcript: normalizedEvent.rawTranscript,
      duration_seconds: normalizedEvent.durationSeconds,
      entity_type: resolved?.type ?? null,
      entity_id: resolved && resolved.type !== 'unknown' ? resolved.targetId : null,
      process_after: processAfter,
    },
    { onConflict: 'quo_id', ignoreDuplicates: true }
  );

  if (error) {
    console.error('[quo-webhook] insert error:', (error as { code?: string; message?: string }).code, (error as { code?: string; message?: string }).message);
  }

  if (resolved.type === 'owner' && shouldAppendOwnerSmsMessage({
    channel: normalizedEvent.channel,
    resolvedType: resolved.type,
    rawTranscript: normalizedEvent.rawTranscript,
  })) {
    const ownerSmsMessage = buildOwnerSmsMessage({
      ownerId: resolved.targetId,
      adminId: adminProfile.id as string,
      event: normalizedEvent,
    });
    if (ownerSmsMessage) {
      await appendOwnerSmsMessage({
        supabase,
        ownerId: resolved.targetId,
        ...ownerSmsMessage,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
