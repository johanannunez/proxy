'use server';
import { revalidatePath } from 'next/cache';
import type { Database } from '@/types/supabase';
import { untypedDatabase } from '@/lib/supabase/untyped';
import { requireAdminUser } from './auth';
import type { ProjectStatus, ProjectType, ProjectVisibility } from './project-types';

type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
type ProjectUpdate = Database['public']['Tables']['projects']['Update'];
type ProjectInsertWithVisibility = ProjectInsert & { visibility: ProjectVisibility };
type ProjectUpdateWithVisibility = ProjectUpdate & { visibility?: ProjectVisibility };

export type CreateProjectInput = {
  name: string;
  description?: string;
  projectType: ProjectType;
  status?: ProjectStatus;
  visibility?: ProjectVisibility;
  targetDate?: string;
  linkedContactId?: string | null;
  linkedPropertyId?: string | null;
  emoji?: string | null;
  color?: string | null;
};

export async function createProject(input: CreateProjectInput): Promise<{ id: string }> {
  const { supabase, user } = await requireAdminUser();

  const row: ProjectInsertWithVisibility = {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    project_type: input.projectType,
    status: input.status ?? 'not_started',
    visibility: input.visibility ?? 'internal',
    owner_user_id: user.id,
    target_date: input.targetDate ?? null,
    linked_contact_id: input.linkedContactId ?? null,
    linked_property_id: input.linkedPropertyId ?? null,
    emoji: input.emoji ?? null,
    color: input.color ?? null,
  };

  const db = untypedDatabase(supabase);
  const { data, error } = await db
    .from<{ id: string }>('projects')
    .insert(row)
    .select('id')
    .single();
  if (error) throw error;
  if (!data) throw new Error('Project was not created.');
  revalidatePath('/admin/projects');
  revalidatePath('/admin/workspaces');
  revalidatePath('/portal/projects');
  return { id: data.id as string };
}

export async function updateProject(
  id: string,
  patch: Partial<Omit<CreateProjectInput, 'projectType'>> & {
    projectType?: ProjectType;
    status?: ProjectStatus;
    visibility?: ProjectVisibility;
  },
): Promise<void> {
  const { supabase } = await requireAdminUser();
  const update: ProjectUpdateWithVisibility = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.projectType !== undefined) update.project_type = patch.projectType;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.visibility !== undefined) update.visibility = patch.visibility;
  if (patch.targetDate !== undefined) update.target_date = patch.targetDate;
  if (patch.linkedContactId !== undefined) update.linked_contact_id = patch.linkedContactId;
  if (patch.linkedPropertyId !== undefined) update.linked_property_id = patch.linkedPropertyId;
  if (patch.emoji !== undefined) update.emoji = patch.emoji;
  if (patch.color !== undefined) update.color = patch.color;

  const db = untypedDatabase(supabase);
  const { error } = await db.from('projects').update(update).eq('id', id);
  if (error) throw error;
  revalidatePath('/admin/projects');
  revalidatePath(`/admin/projects/${id}`);
  revalidatePath('/admin/workspaces');
  revalidatePath('/portal/projects');
}

export async function archiveProject(id: string): Promise<void> {
  await updateProject(id, { status: 'archived' });
}
