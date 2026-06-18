"use server";

import { requireAdminUser } from "@/lib/admin/auth";
import { createServiceClient } from "@/lib/supabase/service";

export type MessageTemplate = {
  id: string;
  name: string;
  channel: "email" | "sms" | "any";
  subject: string | null;
  body: string;
};

export async function listMessageTemplates(): Promise<MessageTemplate[]> {
  try {
    await requireAdminUser();
  } catch {
    return [];
  }
  const svc = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (svc as any)
    .from("message_templates")
    .select("id, name, channel, subject, body")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[templates] list error:", error.message);
    return [];
  }
  return (data ?? []) as MessageTemplate[];
}

export async function createMessageTemplate(input: {
  name: string;
  channel: "email" | "sms" | "any";
  subject?: string;
  body: string;
}): Promise<{ ok: boolean; message: string }> {
  let adminId: string;
  try {
    adminId = (await requireAdminUser()).user.id;
  } catch {
    return { ok: false, message: "Not authorized." };
  }
  if (!input.name.trim() || !input.body.trim()) {
    return { ok: false, message: "Name and body are required." };
  }

  const svc = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc as any).from("message_templates").insert({
    name: input.name.trim(),
    channel: input.channel,
    subject: input.subject?.trim() || null,
    body: input.body,
    created_by: adminId,
  });

  if (error) {
    console.error("[templates] create error:", error.message);
    return { ok: false, message: "Failed to save template." };
  }
  return { ok: true, message: "Template saved." };
}

export async function deleteMessageTemplate(id: string): Promise<{ ok: boolean }> {
  try {
    await requireAdminUser();
  } catch {
    return { ok: false };
  }
  const svc = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc as any).from("message_templates").delete().eq("id", id);
  return { ok: !error };
}
