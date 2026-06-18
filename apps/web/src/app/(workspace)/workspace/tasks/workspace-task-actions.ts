"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function getAuthenticatedUserId(): Promise<string> {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect("/login");
  return user.id;
}

export async function updateTaskStatus(
  taskId: string,
  status: "done" | "todo",
): Promise<{ error?: string }> {
  try {
    const userId = await getAuthenticatedUserId();
    const client = await createClient();

    const updateData: Record<string, unknown> = { status };
    if (status === "done") {
      updateData.completed_at = new Date().toISOString();
    } else {
      updateData.completed_at = null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (client as any)
      .from("tasks")
      .update(updateData)
      .eq("id", taskId)
      .eq("owner_id", userId);

    if (error) return { error: error.message };

    revalidatePath("/workspace/tasks");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Something went wrong" };
  }
}

export async function toggleSubtask(
  subtaskId: string,
  completed: boolean,
): Promise<{ error?: string }> {
  try {
    await getAuthenticatedUserId();
    const client = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (client as any)
      .from("task_subtasks")
      .update({
        completed,
        completed_at: completed ? new Date().toISOString() : null,
      })
      .eq("id", subtaskId);

    if (error) return { error: error.message };

    revalidatePath("/workspace/tasks");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Something went wrong" };
  }
}

export async function addComment(
  taskId: string,
  content: string,
): Promise<{ error?: string }> {
  try {
    const userId = await getAuthenticatedUserId();
    const client = await createClient();

    const trimmed = content.trim();
    if (!trimmed) return { error: "Comment cannot be empty" };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (client as any)
      .from("task_comments")
      .insert({
        task_id: taskId,
        author_id: userId,
        content: trimmed,
      });

    if (error) return { error: error.message };

    revalidatePath("/workspace/tasks");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Something went wrong" };
  }
}
