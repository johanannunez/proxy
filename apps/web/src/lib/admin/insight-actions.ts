'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { runGuestIntelligenceSync } from './guest-intelligence';

export async function triggerGuestIntelligenceSync(): Promise<{ processed: number; skipped: number }> {
  const result = await runGuestIntelligenceSync();
  revalidatePath('/admin');
  return result;
}

export async function dismissInsight(insightId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('ai_insights')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', insightId);
  if (error) throw error;
  revalidatePath('/admin');
  revalidatePath('/admin/guest-pulse');
  revalidatePath('/admin/properties', 'layout');
}

export async function completeInsight(insightId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('ai_insights')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', insightId);
  if (error) throw error;
  revalidatePath('/admin');
  revalidatePath('/admin/guest-pulse');
  revalidatePath('/admin/properties', 'layout');
}

export type AssignableProfile = {
  id: string;
  fullName: string | null;
};

export async function fetchAssignableProfiles(): Promise<AssignableProfile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name')
    .order('full_name', { ascending: true, nullsFirst: false })
    .limit(50);
  if (error) {
    console.error('[insight-actions] fetchAssignableProfiles error:', error.message);
    return [];
  }
  return (data ?? []).map((p) => ({ id: p.id, fullName: p.full_name }));
}

export async function createTaskFromInsight(params: {
  insightId: string;
  propertyId: string;
  title: string;
  body: string;
  suggestedFixes: string[];
  assigneeId?: string | null;
  dueDate?: string | null;
}): Promise<{ taskId: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: task, error: taskErr } = await supabase
    .from('tasks')
    .insert({
      parent_type: 'property',
      parent_id: params.propertyId,
      title: params.title,
      description: params.body,
      status: 'todo',
      created_by: user.id,
      ...(params.assigneeId ? { assignee_id: params.assigneeId } : {}),
      ...(params.dueDate ? { due_at: new Date(params.dueDate + 'T00:00:00').toISOString() } : {}),
    })
    .select('id')
    .single();

  if (taskErr || !task) throw taskErr ?? new Error('Failed to create task');

  if (params.suggestedFixes.length > 1) {
    const subtasks = params.suggestedFixes.map((fix) => ({
      parent_type: 'property' as const,
      parent_id: params.propertyId,
      parent_task_id: task.id,
      title: fix,
      status: 'todo' as const,
      created_by: user.id,
    }));
    await supabase.from('tasks').insert(subtasks);
  }

  revalidatePath('/admin');
  revalidatePath('/admin/tasks');
  return { taskId: task.id };
}
