"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

const BusinessEntitySchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  // workspaces.type has no DB constraint and some existing rows hold legacy
  // values (e.g. "family"). The settings form (BusinessEntitySection) only
  // offers the canonical values — individual/llc/s_corp/c_corp/trust/partnership
  // — for new selections, so it is the enforcement point. The action accepts any
  // short string so a legacy value round-trips instead of failing the whole save
  // when an unrelated field (name/EIN/notes) is edited. Legacy values are
  // normalized separately.
  type: z.string().trim().max(40),
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
