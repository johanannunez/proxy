import "server-only";
import { createClient } from "@/lib/supabase/server";
import { untypedDatabase } from "@/lib/supabase/untyped";
import type { Database } from "@/types/supabase";
import type { ProjectRow, ProjectStatus, ProjectType, ProjectVisibility } from "./project-types";

type ProjectDbRow = Database["public"]["Tables"]["projects"]["Row"] & {
  visibility?: ProjectVisibility | null;
};
type ContactRow = { id: string; full_name: string | null; profile_id: string | null };
type PropertyRow = { id: string; name: string | null; address_line1: string | null };
type ProfileRow = { id: string; full_name: string | null };

function compactIds(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((id): id is string => Boolean(id))));
}

function toProjectRow(
  project: ProjectDbRow,
  taskStats: { total: number; done: number },
  contactsById: Map<string, ContactRow>,
  propertiesById: Map<string, PropertyRow>,
  ownersById: Map<string, ProfileRow>,
): ProjectRow {
  const linkedContact = project.linked_contact_id ? contactsById.get(project.linked_contact_id) : null;
  const linkedProperty = project.linked_property_id ? propertiesById.get(project.linked_property_id) : null;
  const owner = project.owner_user_id ? ownersById.get(project.owner_user_id) : null;

  return {
    id: project.id,
    name: project.name,
    description: project.description,
    projectType: project.project_type as ProjectType,
    status: project.status as ProjectStatus,
    visibility: (project.visibility ?? "internal") as ProjectVisibility,
    ownerUserId: project.owner_user_id,
    ownerUserName: owner?.full_name ?? null,
    targetDate: project.target_date,
    linkedContactId: project.linked_contact_id,
    linkedContactName: linkedContact?.full_name ?? null,
    linkedContactProfileId: linkedContact?.profile_id ?? null,
    linkedPropertyId: project.linked_property_id,
    linkedPropertyName: linkedProperty?.name ?? linkedProperty?.address_line1 ?? null,
    archivedAt: project.archived_at,
    emoji: project.emoji,
    color: project.color,
    taskCount: taskStats.total,
    taskDoneCount: taskStats.done,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
  };
}

export async function fetchWorkspaceProjects({
  contactIds,
  propertyIds,
}: {
  contactIds: string[];
  propertyIds: string[];
}): Promise<ProjectRow[]> {
  const supabase = await createClient();
  const db = untypedDatabase(supabase);
  const projectMap = new Map<string, ProjectDbRow>();
  const columns =
    "id, name, description, project_type, status, visibility, owner_user_id, target_date, linked_contact_id, linked_property_id, archived_at, emoji, color, created_at, updated_at";

  if (contactIds.length > 0) {
    const { data, error } = await db
      .from<ProjectDbRow[]>("projects")
      .select(columns)
      .in("linked_contact_id", contactIds)
      .neq("status", "archived")
      .order("updated_at", { ascending: false });
    if (error) {
      console.error("[workspace-projects] contact project fetch error:", error.code, error.message);
    }
    for (const project of data ?? []) projectMap.set(project.id, project);
  }

  if (propertyIds.length > 0) {
    const { data, error } = await db
      .from<ProjectDbRow[]>("projects")
      .select(columns)
      .in("linked_property_id", propertyIds)
      .neq("status", "archived")
      .order("updated_at", { ascending: false });
    if (error) {
      console.error("[workspace-projects] property project fetch error:", error.code, error.message);
    }
    for (const project of data ?? []) projectMap.set(project.id, project);
  }

  const projects = Array.from(projectMap.values()).sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
  if (projects.length === 0) return [];

  const projectIds = projects.map((project) => project.id);
  const linkedContactIds = compactIds(projects.map((project) => project.linked_contact_id));
  const linkedPropertyIds = compactIds(projects.map((project) => project.linked_property_id));
  const ownerIds = compactIds(projects.map((project) => project.owner_user_id));

  const [taskResult, contactResult, propertyResult, ownerResult] = await Promise.all([
    supabase.from("tasks").select("parent_id, status").eq("parent_type", "project").in("parent_id", projectIds),
    linkedContactIds.length > 0
      ? supabase.from("contacts").select("id, full_name, profile_id").in("id", linkedContactIds)
      : Promise.resolve({ data: [] }),
    linkedPropertyIds.length > 0
      ? supabase.from("properties").select("id, name, address_line1").in("id", linkedPropertyIds)
      : Promise.resolve({ data: [] }),
    ownerIds.length > 0
      ? supabase.from("profiles").select("id, full_name").in("id", ownerIds)
      : Promise.resolve({ data: [] }),
  ]);

  const tasksByProject: Record<string, { total: number; done: number }> = {};
  for (const task of taskResult.data ?? []) {
    if (!task.parent_id) continue;
    tasksByProject[task.parent_id] ??= { total: 0, done: 0 };
    tasksByProject[task.parent_id].total += 1;
    if (task.status === "done") tasksByProject[task.parent_id].done += 1;
  }

  const contactsById = new Map((contactResult.data ?? []).map((row) => [row.id, row]));
  const propertiesById = new Map((propertyResult.data ?? []).map((row) => [row.id, row]));
  const ownersById = new Map((ownerResult.data ?? []).map((row) => [row.id, row]));

  return projects.map((project) =>
    toProjectRow(
      project,
      tasksByProject[project.id] ?? { total: 0, done: 0 },
      contactsById,
      propertiesById,
      ownersById,
    ),
  );
}
