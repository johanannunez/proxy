'use server';

import { revalidatePath } from 'next/cache';
import type { LifecycleStage } from './contact-types';
import { requireAdminUser } from './auth';
import { seedOnboardingTasks } from './onboarding-actions';
import { untypedDatabase } from '@/lib/supabase/untyped';

type DbLifecycleStage = LifecycleStage;

export type CreateContactInput = {
  fullName: string;
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  source?: string | null;
  estimatedMrr?: number | null;
  lifecycleStage?: LifecycleStage;
  notes?: string | null;
};

export async function createContact(
  input: CreateContactInput,
): Promise<{ id: string; workspaceId: string }> {
  const { supabase, user } = await requireAdminUser();

  const workspaceName = input.companyName?.trim() || input.fullName.trim();

  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .insert({ name: workspaceName, type: 'individual' })
    .select('id')
    .single();

  if (workspaceError) throw workspaceError;

  const metadata = input.notes?.trim()
    ? { notes: input.notes.trim() }
    : {};

  // Some contacts columns are not yet in the generated Supabase types, so the
  // insert goes through the untyped helper.
  const { data, error } = await untypedDatabase(supabase)
    .from<{ id: string }>('contacts')
    .insert({
      full_name: input.fullName.trim(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      company_name: input.companyName?.trim() || null,
      source: input.source?.trim() || null,
      estimated_mrr: input.estimatedMrr ?? null,
      lifecycle_stage: (input.lifecycleStage ?? 'lead_new') as DbLifecycleStage,
      metadata,
      assigned_to: user.id,
      workspace_id: workspace.id,
    })
    .select('id')
    .single();

  if (error) throw error;
  if (!data) throw new Error('Contact insert returned no row');
  revalidatePath('/admin/people');
  return { id: data.id, workspaceId: workspace.id as string };
}

export async function updateContactStage(
  contactId: string,
  stage: LifecycleStage,
): Promise<void> {
  const { supabase } = await requireAdminUser();
  const { error } = await supabase
    .from('contacts')
    .update({ lifecycle_stage: stage as DbLifecycleStage })
    .eq('id', contactId);
  if (error) throw error;

  if (stage === 'onboarding') {
    await seedOnboardingTasks(contactId);
  }

  revalidatePath('/admin/people');
  revalidatePath(`/admin/people/${contactId}`);
}

export type UpdatableContactField =
  | 'fullName'
  | 'email'
  | 'phone'
  | 'companyName'
  | 'source'
  | 'estimatedMrr';

const FIELD_TO_COLUMN: Record<UpdatableContactField, string> = {
  fullName: 'full_name',
  email: 'email',
  phone: 'phone',
  companyName: 'company_name',
  source: 'source',
  estimatedMrr: 'estimated_mrr',
};

export async function updateContactField(
  contactId: string,
  field: UpdatableContactField,
  value: string | number | null,
): Promise<void> {
  const { supabase } = await requireAdminUser();
  const column = FIELD_TO_COLUMN[field];

  const normalized =
    field === 'estimatedMrr'
      ? value === null || value === ''
        ? null
        : Number(value)
      : typeof value === 'string'
      ? value.trim() || null
      : value;

  const update: Record<string, string | number | null> = {};
  update[column] = normalized;
  const { error } = await supabase
    .from('contacts')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(update as any)
    .eq('id', contactId);
  if (error) throw error;
  revalidatePath(`/admin/people/${contactId}`);
  revalidatePath('/admin/people');
}
