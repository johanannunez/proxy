"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createForm,
  updateForm,
  publishForm,
  deleteForm,
  createFormResponse,
} from "@/lib/admin/forms";
import type { FormSchema } from "@/lib/admin/forms-types";

async function requireAdmin(): Promise<{ userId: string | null; error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { userId: null, error: "You must be signed in." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile as { role: string } | null)?.role !== "admin") {
    return { userId: user.id, error: "Admin access required." };
  }
  return { userId: user.id, error: null };
}

async function requireAuth(): Promise<{ userId: string | null; error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { userId: null, error: "You must be signed in." };
  return { userId: user.id, error: null };
}

export type FormActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function createFormAction(
  orgId: string,
  name: string,
): Promise<FormActionResult<{ id: string }>> {
  const { userId, error } = await requireAdmin();
  if (error || !userId) return { ok: false, error: error ?? "Unauthorized." };

  const form = await createForm({ org_id: orgId, name, created_by: userId });
  if (!form) return { ok: false, error: "Failed to create form." };

  revalidatePath("/admin/documents/forms");
  return { ok: true, data: { id: form.id } };
}

export async function updateFormSchemaAction(
  id: string,
  schema: FormSchema,
): Promise<FormActionResult> {
  const { error } = await requireAdmin();
  if (error) return { ok: false, error };

  const result = await updateForm(id, { schema });
  if (!result) return { ok: false, error: "Failed to save schema." };
  return { ok: true, data: undefined };
}

export async function updateFormMetaAction(
  id: string,
  updates: {
    name?: string;
    description?: string;
    is_public?: boolean;
    slug?: string | null;
    is_active?: boolean;
  },
): Promise<FormActionResult> {
  const { error } = await requireAdmin();
  if (error) return { ok: false, error };

  const result = await updateForm(id, updates);
  if (!result) return { ok: false, error: "Failed to update form." };
  revalidatePath("/admin/documents/forms");
  return { ok: true, data: undefined };
}

export async function publishFormAction(id: string): Promise<FormActionResult> {
  const { error } = await requireAdmin();
  if (error) return { ok: false, error };

  const result = await publishForm(id);
  if (!result) return { ok: false, error: "Failed to publish form." };
  revalidatePath("/admin/documents/forms");
  return { ok: true, data: undefined };
}

export async function unpublishFormAction(id: string): Promise<FormActionResult> {
  const { error } = await requireAdmin();
  if (error) return { ok: false, error };

  const result = await updateForm(id, { is_active: false });
  if (!result) return { ok: false, error: "Failed to unpublish form." };
  revalidatePath("/admin/documents/forms");
  return { ok: true, data: undefined };
}

export async function deleteFormAction(id: string): Promise<FormActionResult> {
  const { error } = await requireAdmin();
  if (error) return { ok: false, error };

  const ok = await deleteForm(id);
  if (!ok) return { ok: false, error: "Failed to delete form." };
  revalidatePath("/admin/documents/forms");
  return { ok: true, data: undefined };
}

export async function submitFormResponseAction(
  formId: string,
  data: Record<string, unknown>,
  propertyId?: string,
): Promise<FormActionResult> {
  const { userId } = await requireAuth();

  const result = await createFormResponse({
    form_id: formId,
    respondent_profile_id: userId,
    property_id: propertyId ?? null,
    data,
    metadata: {},
  });
  if (!result) return { ok: false, error: "Failed to submit response." };
  return { ok: true, data: undefined };
}
