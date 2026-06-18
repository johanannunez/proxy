'use server';

import { revalidatePath } from 'next/cache';
import type { ParentType, TaskStatus, TaskType } from './task-types';
import type { RecurrenceRule } from './recurrence';
import { nextOccurrence } from './recurrence';
import { sanitizeHtml } from './sanitize-html';
import { requireAdminUser } from './auth';
import type { Database } from '@/types/supabase';
import { untypedDatabase } from '@/lib/supabase/untyped';

type TaskUpdate = Database['public']['Tables']['tasks']['Update'];

// `priority`, `caldav_uid` and recurrence columns are not yet in the generated
// Supabase types, so inserts/updates go through the untyped helper.
type TaskInsertRow = Record<string, unknown>;

export type CreateTaskInput = {
  title: string;
  description?: string;
  parentType?: ParentType | null;
  parentId?: string | null;
  parentTaskId?: string | null;
  assigneeId?: string | null;
  dueAt?: string | null;
  taskType?: TaskType | null;
  tags?: string[];
  estimatedMinutes?: number | null;
  recurrenceRule?: RecurrenceRule | null;
  preNotifyHours?: number | null;
  priority?: 1 | 2 | 3 | 4;
};

export async function createTask(input: CreateTaskInput): Promise<{ id: string }> {
  const { supabase, user } = await requireAdminUser();

  const caldav_uid = `task-${crypto.randomUUID()}@myproxyhost.com`;

  // Compute next_spawn_at when creating a recurring task
  let next_spawn_at: string | null = null;
  if (input.recurrenceRule && input.dueAt) {
    next_spawn_at = nextOccurrence(new Date(input.dueAt), input.recurrenceRule)?.toISOString() ?? null;
  }

  const trimmedDescription = input.description?.trim();
  const row = {
    title: input.title.trim(),
    description: trimmedDescription ? sanitizeHtml(trimmedDescription) : null,
    parent_type: input.parentType ?? null,
    parent_id: input.parentId ?? null,
    parent_task_id: input.parentTaskId ?? null,
    assignee_id: input.assigneeId ?? null,
    created_by: user.id,
    due_at: input.dueAt ?? null,
    task_type: input.taskType ?? undefined,
    tags: input.tags && input.tags.length > 0 ? input.tags : undefined,
    estimated_minutes: input.estimatedMinutes ?? null,
    recurrence_rule: input.recurrenceRule ?? null,
    pre_notify_hours: input.preNotifyHours ?? null,
    next_spawn_at,
    priority: input.priority ?? 4,
    caldav_uid,
  };

  const db = untypedDatabase(supabase);
  const { data, error } = await db
    .from<{ id: string }>('tasks')
    .insert(row satisfies TaskInsertRow)
    .select('id')
    .single();
  if (error) throw error;
  if (!data) throw new Error('Task insert returned no row');

  revalidatePath('/admin/tasks');
  if (input.parentType && input.parentId) {
    if (input.parentType === 'contact') revalidatePath('/admin/people');
    if (input.parentType === 'property') revalidatePath('/admin/properties');
    if (input.parentType === 'project') revalidatePath('/admin/projects');
  }
  return { id: data.id };
}

export async function updateTask(
  id: string,
  patch: Partial<{
    title: string;
    description: string | null;
    status: TaskStatus;
    assigneeId: string | null;
    dueAt: string | null;
    taskType: TaskType | null;
    tags: string[];
    estimatedMinutes: number | null;
    priority: 1 | 2 | 3 | 4;
  }>,
): Promise<void> {
  const { supabase } = await requireAdminUser();
  // `priority` is not yet in the generated TaskUpdate type.
  const update: TaskUpdate & { priority?: 1 | 2 | 3 | 4 } = {};
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.description !== undefined) {
    update.description =
      patch.description === null ? null : sanitizeHtml(patch.description);
  }
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.assigneeId !== undefined) update.assignee_id = patch.assigneeId;
  if (patch.dueAt !== undefined) update.due_at = patch.dueAt;
  if (patch.taskType !== undefined && patch.taskType !== null) update.task_type = patch.taskType;
  if (patch.tags !== undefined) update.tags = patch.tags && patch.tags.length > 0 ? patch.tags : [];
  if (patch.estimatedMinutes !== undefined) update.estimated_minutes = patch.estimatedMinutes;
  if (patch.priority !== undefined) update.priority = patch.priority;

  // Cast: `priority` is not yet in the generated TaskUpdate type (see above),
  // so the typed client rejects it as an excess property. The column exists at
  // runtime; the value is still sent.
  const { error } = await supabase
    .from('tasks')
    .update(update as TaskUpdate)
    .eq('id', id);
  if (error) throw error;
  revalidatePath('/admin/tasks');
}

export async function completeTask(id: string): Promise<void> {
  const { supabase } = await requireAdminUser();

  // Fetch the task first so we know if it's recurring
  const { data: task, error: fetchError } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', id)
    .single();
  if (fetchError) throw fetchError;

  // Mark done
  const { error: updateError } = await supabase
    .from('tasks')
    .update({ status: 'done' })
    .eq('id', id);
  if (updateError) throw updateError;

  // Spawn next occurrence if recurring
  if (task.recurrence_rule && task.due_at) {
    const rule = task.recurrence_rule as unknown as RecurrenceRule;
    const next = nextOccurrence(new Date(task.due_at), rule);
    if (next) {
      const nextDue = next.toISOString();
      // Compute the spawn after THAT one so next_spawn_at is always one step ahead
      const afterNext = nextOccurrence(next, rule)?.toISOString() ?? null;

      // `priority` is not yet in the generated row type; read it from an
      // untyped view of the same row rather than asserting `any`.
      const priority = (task as { priority?: number }).priority ?? 4;

      const insertRow: TaskInsertRow = {
        title: task.title,
        description: task.description,
        parent_type: task.parent_type,
        parent_id: task.parent_id,
        assignee_id: task.assignee_id,
        created_by: task.created_by,
        task_type: task.task_type,
        tags: task.tags,
        estimated_minutes: task.estimated_minutes,
        linked_contact_id: task.linked_contact_id,
        linked_property_id: task.linked_property_id,
        recurrence_rule: task.recurrence_rule,
        pre_notify_hours: task.pre_notify_hours,
        priority,
        caldav_uid: `task-${crypto.randomUUID()}@myproxyhost.com`,
        spawned_from_task_id: task.id,
        due_at: nextDue,
        next_spawn_at: afterNext,
        status: 'todo',
      };
      await untypedDatabase(supabase).from('tasks').insert(insertRow);
    }
  }

  revalidatePath('/admin/tasks');
}

export async function uncompleteTask(id: string): Promise<void> {
  await updateTask(id, { status: 'todo' });
}

export async function deleteTask(id: string): Promise<void> {
  const { supabase } = await requireAdminUser();
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw error;
  revalidatePath('/admin/tasks');
}
