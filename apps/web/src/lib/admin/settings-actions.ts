"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

const BusinessEntitySchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  // Canonical workspaces.type values, matching the create form (WorkspaceForm)
  // and the display maps in WorkspaceDetailShell / WorkspaceDetailSidebar. The
  // settings form previously sent display strings ("LLC", "S-Corp"), which the
  // rest of the app could not match, so saved values rendered without a label.
  type: z.enum(["", "individual", "llc", "s_corp", "c_corp", "trust", "partnership"]),
  ein: z.string().trim().max(20),
  notes: z.string().trim().max(4000),
});

export async function updateWorkspaceBusinessEntity(input: z.infer<typeof BusinessEntitySchema>): Promise<ActionResult> {
  const parsed = BusinessEntitySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid business entity data." };
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("workspaces")
    .update({
      name: parsed.data.name,
      type: parsed.data.type ? parsed.data.type : null,
      ein: parsed.data.ein ? parsed.data.ein : null,
      notes: parsed.data.notes ? parsed.data.notes : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.workspaceId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/workspaces/${parsed.data.workspaceId}`);
  return { ok: true };
}

const RegionSchema = z.object({
  profileId: z.string().uuid(),
  timezone: z.string().trim().max(64),
});

export async function updateProfileRegion(
  input: z.infer<typeof RegionSchema>,
): Promise<ActionResult> {
  const parsed = RegionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid region data." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ timezone: parsed.data.timezone, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.profileId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/workspaces");
  return { ok: true };
}
