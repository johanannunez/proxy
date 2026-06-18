"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  createForm,
  updateForm,
  publishForm,
  deleteForm,
  duplicateForm,
  archiveForm,
  unarchiveForm,
  createFormResponse,
  countFormResponses,
  getForm,
  getRespondentCrossFormData,
  stripHiddenValues,
  type RespondentFormEntry,
} from "@/lib/admin/forms";
import { withFormCover } from "@/lib/admin/form-cover";
import type {
  FormCoverMode,
  FormCoverSettings,
  FormField,
  FormSchema,
} from "@/lib/admin/forms-types";

const FORM_COVER_BUCKET = "form-covers";
const FORM_COVER_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const FORM_COVER_MAX_BYTES = 6 * 1024 * 1024;

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

export async function createFormWithFieldsAction(
  orgId: string,
  name: string,
  fields: FormField[],
  appearance?: { icon?: string | null; iconColor?: string | null },
): Promise<FormActionResult<{ id: string }>> {
  const { userId, error } = await requireAdmin();
  if (error || !userId) return { ok: false, error: error ?? "Unauthorized." };

  const schema: FormSchema = { version: 1, fields, settings: {} };
  const form = await createForm({
    org_id: orgId,
    name,
    created_by: userId,
    schema,
    icon: normalizeAppearanceIcon(appearance?.icon ?? null),
    icon_color: normalizeAppearanceColor(appearance?.iconColor ?? null),
  });
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
    tracked?: boolean;
    category?: string | null;
  },
): Promise<FormActionResult> {
  const { error } = await requireAdmin();
  if (error) return { ok: false, error };

  const result = await updateForm(id, updates);
  if (!result) return { ok: false, error: "Failed to update form." };
  revalidatePath("/admin/paperwork/forms");
  return { ok: true, data: undefined };
}

// Server-side trust boundary for form appearance. The canonical resolver
// (form-symbols.tsx) is a client module and cannot be imported here, so we
// validate by charset instead: accept hex / tint-slug colors and the
// namespaced (icon:/emoji:), legacy bare-key, and legacy `ph:` icon forms that
// may already be stored, while rejecting anything that could break out of an
// attribute or inline style (quotes, spaces, angle brackets, parens, url(...),
// semicolons). Unknown-but-safe values render as a graceful fallback.
const HEX_RE = /^#?[0-9a-fA-F]{6}$/;
const TINT_SLUG_RE = /^[a-zA-Z0-9-]{2,24}$/;
const ICON_VALUE_RE = /^[a-zA-Z0-9:_-]{1,64}$/;

function normalizeAppearanceColor(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (HEX_RE.test(trimmed)) return `#${trimmed.slice(-6).toLowerCase()}`;
  if (TINT_SLUG_RE.test(trimmed)) return trimmed;
  return null;
}

function normalizeAppearanceIcon(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return ICON_VALUE_RE.test(trimmed) ? trimmed : null;
}

export async function updateFormAppearanceAction(
  id: string,
  appearance: { icon: string | null; icon_color: string | null },
): Promise<FormActionResult> {
  const { error } = await requireAdmin();
  if (error) return { ok: false, error };

  const icon = normalizeAppearanceIcon(appearance.icon);
  const icon_color = normalizeAppearanceColor(appearance.icon_color);
  if (appearance.icon != null && icon == null) {
    return { ok: false, error: "That icon is not valid." };
  }
  if (appearance.icon_color != null && icon_color == null) {
    return { ok: false, error: "That color is not valid." };
  }

  const result = await updateForm(id, { icon, icon_color });
  if (!result) return { ok: false, error: "Failed to update appearance." };
  revalidatePath("/admin/paperwork/forms");
  return { ok: true, data: undefined };
}

function revalidateFormSurfaces(formId: string, slug?: string | null) {
  revalidatePath("/admin/paperwork/forms");
  revalidatePath(`/admin/paperwork/templates/${formId}`);
  if (slug) revalidatePath(`/f/${slug}`);
}

async function removeStoredCover(path: string | null | undefined) {
  if (!path) return;
  const service = createServiceClient();
  await service.storage.from(FORM_COVER_BUCKET).remove([path]);
}

function coverFileExt(type: string): "jpg" | "png" | "webp" {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

export async function updateFormCoverAction(
  id: string,
  cover: FormCoverSettings & { mode: FormCoverMode },
): Promise<FormActionResult> {
  const { error } = await requireAdmin();
  if (error) return { ok: false, error };

  const form = await getForm(id);
  if (!form) return { ok: false, error: "Form not found." };

  const previousPath = form.schema.settings.cover?.imagePath ?? null;
  const nextSchema = withFormCover(form.schema, cover);
  const result = await updateForm(id, { schema: nextSchema });
  if (!result) return { ok: false, error: "Failed to update cover." };

  const nextPath = nextSchema.settings.cover?.imagePath ?? null;
  if (previousPath && previousPath !== nextPath) {
    await removeStoredCover(previousPath);
  }

  revalidateFormSurfaces(id, form.slug);
  return { ok: true, data: undefined };
}

export async function uploadFormCoverAction(
  id: string,
  formData: FormData,
): Promise<FormActionResult> {
  const { error } = await requireAdmin();
  if (error) return { ok: false, error };

  const form = await getForm(id);
  if (!form) return { ok: false, error: "Form not found." };

  const fileValue = formData.get("cover");
  if (!(fileValue instanceof File)) {
    return { ok: false, error: "Choose an image to upload." };
  }
  if (!FORM_COVER_TYPES.has(fileValue.type)) {
    return { ok: false, error: "Use a JPEG, PNG, or WebP image." };
  }
  if (fileValue.size > FORM_COVER_MAX_BYTES) {
    return { ok: false, error: "Choose an image under 6MB." };
  }

  const previousPath = form.schema.settings.cover?.imagePath ?? null;
  const ext = coverFileExt(fileValue.type);
  const path = `${form.org_id}/${form.id}/${crypto.randomUUID()}.${ext}`;
  const bytes = Buffer.from(await fileValue.arrayBuffer());
  const service = createServiceClient();

  const { error: uploadError } = await service.storage
    .from(FORM_COVER_BUCKET)
    .upload(path, bytes, {
      cacheControl: "31536000",
      contentType: fileValue.type,
      upsert: false,
    });

  if (uploadError) {
    if (
      uploadError.message.includes("Bucket") ||
      uploadError.message.includes("not found")
    ) {
      return {
        ok: false,
        error: "Cover storage is not configured yet. Create the form-covers bucket.",
      };
    }
    return { ok: false, error: "Cover image could not be uploaded." };
  }

  const { data: urlData } = service.storage.from(FORM_COVER_BUCKET).getPublicUrl(path);
  const imageUrl = `${urlData.publicUrl}?v=${Date.now()}`;
  const nextSchema = withFormCover(form.schema, {
    mode: "upload",
    imageUrl,
    imagePath: path,
    alt: `${form.name} cover image`,
  });
  const result = await updateForm(id, { schema: nextSchema });
  if (!result) {
    await removeStoredCover(path);
    return { ok: false, error: "Failed to save cover." };
  }

  if (previousPath && previousPath !== path) {
    await removeStoredCover(previousPath);
  }

  revalidateFormSurfaces(id, form.slug);
  return { ok: true, data: undefined };
}

export async function removeFormCoverAction(id: string): Promise<FormActionResult> {
  const { error } = await requireAdmin();
  if (error) return { ok: false, error };

  const form = await getForm(id);
  if (!form) return { ok: false, error: "Form not found." };

  const previousPath = form.schema.settings.cover?.imagePath ?? null;
  const nextSchema = withFormCover(form.schema, { mode: "smart" });
  const result = await updateForm(id, { schema: nextSchema });
  if (!result) return { ok: false, error: "Failed to remove cover." };

  if (previousPath) await removeStoredCover(previousPath);

  revalidateFormSurfaces(id, form.slug);
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

export async function duplicateFormAction(
  id: string,
): Promise<FormActionResult<{ id: string }>> {
  const { userId, error } = await requireAdmin();
  if (error || !userId) return { ok: false, error: error ?? "Unauthorized." };

  const copy = await duplicateForm(id, userId);
  if (!copy) return { ok: false, error: "Failed to duplicate form." };
  revalidatePath("/admin/paperwork/forms");
  return { ok: true, data: { id: copy.id } };
}

export async function archiveFormAction(id: string): Promise<FormActionResult> {
  const { error } = await requireAdmin();
  if (error) return { ok: false, error };

  const result = await archiveForm(id);
  if (!result) return { ok: false, error: "Failed to archive form." };
  revalidatePath("/admin/paperwork/forms");
  return { ok: true, data: undefined };
}

export async function unarchiveFormAction(id: string): Promise<FormActionResult> {
  const { error } = await requireAdmin();
  if (error) return { ok: false, error };

  const result = await unarchiveForm(id);
  if (!result) return { ok: false, error: "Failed to restore form." };
  revalidatePath("/admin/paperwork/forms");
  return { ok: true, data: undefined };
}

export async function deleteFormAction(id: string): Promise<FormActionResult> {
  const { error } = await requireAdmin();
  if (error) return { ok: false, error };

  const responseCount = await countFormResponses(id);
  if (responseCount > 0) {
    return {
      ok: false,
      error: "Forms with responses cannot be deleted. Archive the form instead.",
    };
  }

  const ok = await deleteForm(id);
  if (!ok) return { ok: false, error: "Failed to delete form." };
  revalidatePath("/admin/paperwork/forms");
  return { ok: true, data: undefined };
}

export async function toggleFormPublicAction(
  id: string,
  isPublic: boolean,
): Promise<FormActionResult> {
  const { error } = await requireAdmin();
  if (error) return { ok: false, error };
  const result = await updateForm(id, { is_public: isPublic });
  if (!result) return { ok: false, error: "Failed to update access." };
  revalidatePath("/admin/paperwork/forms");
  return { ok: true, data: undefined };
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
    revalidatePath("/admin/paperwork/forms");
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

  // Trust boundary: re-resolve conditional visibility server-side so values
  // for hidden fields (or keys not in the schema) never reach storage, even
  // from a tampered client.
  const visibleData = stripHiddenValues(form.schema.fields, data);

  const result = await createFormResponse({
    form_id: formId,
    respondent_profile_id: userId,
    property_id: propertyId ?? null,
    data: visibleData,
    metadata: {},
  });
  if (!result) return { ok: false, error: "Failed to submit response." };
  return { ok: true, data: undefined };
}
