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
}

export async function createTaskFromInsight(params: {
  insightId: string;
  propertyId: string;
  title: string;
  body: string;
  suggestedFixes: string[];
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
