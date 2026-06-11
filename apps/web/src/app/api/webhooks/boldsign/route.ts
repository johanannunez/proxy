import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/service';
import { ONBOARDING_TASKS, phaseTag } from '@/lib/admin/onboarding-templates';

export const dynamic = 'force-dynamic';

// Only these events trigger database writes
const HANDLED_EVENTS = new Set(['Completed', 'Declined', 'Expired', 'Revoked', 'Viewed']);

// Spine statuses a webhook event maps to. Viewed is logged, never a status.
const EVENT_TO_STATUS: Record<string, string> = {
  Completed: 'on_file',
  Declined: 'action_required',
  Revoked: 'action_required',
  Expired: 'expired',
};

// BoldSign sends the secret as a plain header value (X-BoldSign-Secret).
// Use timingSafeEqual to prevent timing attacks.
function verifySecret(provided: string, expected: string): boolean {
  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    return false;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function seedOnboardingTasksForContact(supabase: any, contactId: string, createdBy: string): Promise<void> {
  const { data: contact } = await supabase
    .from('contacts')
    .select('profile_id')
    .eq('id', contactId)
    .maybeSingle();

  if (!contact?.profile_id) return;

  const [{ data: direct }, { data: coOwned }] = await Promise.all([
    supabase.from('properties').select('id').eq('owner_id', contact.profile_id),
    supabase.from('property_owners').select('property_id').eq('owner_id', contact.profile_id),
  ]);

  const propertyIds: string[] = Array.from(new Set([
    ...(direct ?? []).map((p: { id: string }) => p.id),
    ...(coOwned ?? []).map((p: { property_id: string }) => p.property_id),
  ]));

  if (propertyIds.length === 0) return;

  // Skip if tasks already exist (idempotent)
  const { data: existing } = await supabase
    .from('tasks')
    .select('id')
    .eq('parent_type', 'property')
    .in('parent_id', propertyIds)
    .contains('tags', ['onboarding'])
    .limit(1);

  if ((existing ?? []).length > 0) return;

  const rows = propertyIds.flatMap((propertyId: string) =>
    ONBOARDING_TASKS.map((task) => ({
      title: task.title,
      parent_type: 'property',
      parent_id: propertyId,
      created_by: createdBy,
      tags: ['onboarding', phaseTag(task.phase)],
      estimated_minutes: task.estimatedMinutes,
      status: 'todo',
      task_type: 'todo',
    })),
  );

  const { error } = await supabase.from('tasks').insert(rows);
  if (error) {
    console.error('[boldsign-webhook] task seeding error:', error.message);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.BOLDSIGN_WEBHOOK_SECRET;
  const rawBody = await req.text();

  if (secret) {
    const provided = req.headers.get('x-boldsign-secret') ?? '';
    if (!provided || !verifySecret(provided, secret)) {
      console.warn('[boldsign-webhook] invalid secret header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } else if (process.env.NODE_ENV !== 'development') {
    console.error('[boldsign-webhook] BOLDSIGN_WEBHOOK_SECRET not configured');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const event = payload.event as Record<string, unknown> | undefined;
  const eventType = event?.eventType as string | undefined;
  const document = event?.document as Record<string, unknown> | undefined;
  const documentId = document?.documentId as string | undefined;

  console.log('[boldsign-webhook] received:', eventType ?? 'unknown', documentId ?? 'no-id');

  if (!eventType || !documentId || !HANDLED_EVENTS.has(eventType)) {
    return NextResponse.json({ ok: true, skipped: eventType ?? 'missing event' });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any;

  // Look up the spine document. For signature documents, source_ref stores the
  // provider document id (legacy BoldSign id or DocuSeal submission id).
  const { data: docRow } = await supabase
    .from('documents')
    .select('id, owner_id, document_key, title')
    .eq('source', 'signed_document')
    .eq('source_ref', documentId)
    .maybeSingle();

  if (!docRow) {
    console.warn('[boldsign-webhook] no documents row for provider id:', documentId);
    return NextResponse.json({ ok: true, skipped: 'document not found' });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let updateError: any = null;
  if (eventType === 'Viewed') {
    // Viewed is an activity event, never a status transition — a late Viewed
    // must not overwrite a final status.
    const { error } = await supabase.from('document_events').insert({
      document_id: docRow.id,
      event_type: 'form.viewed',
      occurred_at: new Date().toISOString(),
    });
    updateError = error;
  } else {
    const status = EVENT_TO_STATUS[eventType] ?? 'action_required';
    const { error } = await supabase
      .from('documents')
      .update({
        status,
        ...(eventType === 'Completed' ? { completed_at: new Date().toISOString() } : {}),
      })
      .eq('id', docRow.id);
    updateError = error;
  }

  if (updateError) {
    console.error('[boldsign-webhook] document update error:', updateError.message);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  // Completing the host rental agreement triggers the onboarding flow
  if (
    eventType === 'Completed' &&
    (docRow.document_key === 'host_rental_agreement' || docRow.title === 'hostRentalAgreement')
  ) {
    const { data: contact } = await supabase
      .from('contacts')
      .select('id')
      .eq('profile_id', docRow.owner_id)
      .maybeSingle();

    if (contact) {
      // Idempotent: .neq prevents downgrading from a later stage
      const { error: stageError } = await supabase
        .from('contacts')
        .update({
          lifecycle_stage: 'onboarding',
          stage_changed_at: new Date().toISOString(),
        })
        .eq('id', contact.id)
        .neq('lifecycle_stage', 'onboarding');

      if (stageError) {
        console.error('[boldsign-webhook] stage update error:', stageError.message);
      } else {
        const { data: adminProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'admin')
          .limit(1)
          .maybeSingle();

        if (adminProfile) {
          await seedOnboardingTasksForContact(supabase, contact.id, adminProfile.id);
        }

        revalidatePath('/admin/people');
        revalidatePath('/admin/workspaces');
        console.log('[boldsign-webhook] contact moved to onboarding:', contact.id);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
