"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createForm,
  updateForm,
  publishForm,
  deleteForm,
  createFormResponse,
  getForm,
  getRespondentCrossFormData,
  type RespondentFormEntry,
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

async function getOptionalUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
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

  revalidatePath("/admin/paperwork/forms");
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
  revalidatePath("/admin/paperwork/forms");
  return { ok: true, data: undefined };
}

export async function publishFormAction(id: string): Promise<FormActionResult> {
  const { error } = await requireAdmin();
  if (error) return { ok: false, error };

  const result = await publishForm(id);
  if (!result) return { ok: false, error: "Failed to publish form." };
  revalidatePath("/admin/paperwork/forms");
  return { ok: true, data: undefined };
}

export async function unpublishFormAction(id: string): Promise<FormActionResult> {
  const { error } = await requireAdmin();
  if (error) return { ok: false, error };

  const result = await updateForm(id, { is_active: false });
  if (!result) return { ok: false, error: "Failed to unpublish form." };
  revalidatePath("/admin/paperwork/forms");
  return { ok: true, data: undefined };
}

export async function deleteFormAction(id: string): Promise<FormActionResult> {
  const { error } = await requireAdmin();
  if (error) return { ok: false, error };

  const ok = await deleteForm(id);
  if (!ok) return { ok: false, error: "Failed to delete form." };
  revalidatePath("/admin/paperwork/forms");
  return { ok: true, data: undefined };
}

export async function toggleFormPublicAction(
  id: string,
  isPublic: boolean,
): Promise<void> {
  const { error } = await requireAdmin();
  if (error) return;
  await updateForm(id, { is_public: isPublic });
  revalidatePath(`/admin/paperwork/forms`);
}

export async function updateFormSlugAction(
  id: string,
  slug: string,
): Promise<{ error?: string }> {
  const { error: authError } = await requireAdmin();
  if (authError) return { error: authError };
  const trimmed = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
  if (!trimmed) return { error: "Slug cannot be empty" };
  try {
    await updateForm(id, { slug: trimmed });
    revalidatePath(`/admin/paperwork/forms`);
    return {};
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Slug already in use";
    return { error: msg };
  }
}

export async function getRespondentDataAction(
  orgId: string,
  profileId: string,
  propertyId?: string,
): Promise<RespondentFormEntry[]> {
  return getRespondentCrossFormData(orgId, profileId, propertyId);
}

export async function submitFormResponseAction(
  formId: string,
  data: Record<string, unknown>,
  propertyId?: string,
): Promise<FormActionResult> {
  const form = await getForm(formId);
  if (!form || !form.is_active || !form.is_public) {
    return { ok: false, error: "Form is not accepting responses." };
  }
  const userId = await getOptionalUserId();

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
