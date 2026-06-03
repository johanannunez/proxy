import type { Metadata } from "next";
import { getWorkspaceContext } from "@/lib/workspace-context";
import { WorkspaceTasksShell } from "./WorkspaceTasksShell";

export const metadata: Metadata = { title: "Tasks" };
export const dynamic = "force-dynamic";

export type TaskSubtask = {
  id: string;
  title: string;
  completed: boolean;
  sort_order: number | null;
};

export type TaskComment = {
  id: string;
  author_id: string;
  content: string;
  created_at: string;
};

export type WorkspaceTask = {
  id: string;
  title: string;
  description: string | null;
  task_type: string;
  status: string;
  priority: string | null;
  due_date: string | null;
  created_at: string;
  completed_at: string | null;
  property_id: string | null;
  tags: string[] | null;
  task_subtasks: TaskSubtask[];
};

export type PropertyOption = {
  id: string;
  label: string;
};

export default async function TasksPage() {
  const { userId, client } = await getWorkspaceContext();

  const [tasksResult, { data: propertiesRaw }] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any)
      .from("tasks")
      .select(
        "id, title, description, task_type, status, priority, due_date, created_at, completed_at, property_id, tags, task_subtasks(id, title, completed, sort_order)",
      )
      .eq("owner_id", userId)
      .order("created_at", { ascending: false }),
    client
      .from("properties")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select("id, address_line1, address_line2, city, state" as any)
      .eq("owner_id", userId),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tasks: WorkspaceTask[] = (tasksResult.data ?? []).map((t: any) => ({
    ...t,
    tags: Array.isArray(t.tags) ? t.tags : [],
    task_subtasks: Array.isArray(t.task_subtasks)
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [...t.task_subtasks].sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      : [],
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: PropertyOption[] = (propertiesRaw ?? []).map((p: any) => {
    const street = [p.address_line1?.trim(), p.address_line2?.trim()].filter(Boolean).join(", ");
    const label = street || "Property";
    return { id: p.id, label };
  });

  return <WorkspaceTasksShell tasks={tasks} properties={properties} />;
}
