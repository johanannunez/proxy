"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PROPERTY_FORM_KEYS, type PropertyFormKey } from "@/lib/admin/documents-hub-shared";
import {
  FORM_REGISTRY,
  allFields,
  computeFormCompletion,
  fieldMaxLength,
} from "./form-registry";

export type SaveFormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

function isFormKey(value: string): value is PropertyFormKey {
  return (PROPERTY_FORM_KEYS as readonly string[]).includes(value);
}

/**
 * Build a clean { key: value } map from FormData using ONLY the registry's
 * known field keys (ignores stray inputs like property_id / form_key / CSRF),
 * and enforce per-field maxLength. Returns validation errors per field.
 */
function collectAnswers(
  formKey: PropertyFormKey,
  formData: FormData,
): { data: Record<string, string>; fieldErrors: Record<string, string> } {
  const def = FORM_REGISTRY[formKey];
  const data: Record<string, string> = {};
  const fieldErrors: Record<string, string> = {};

  for (const field of allFields(def)) {
    const raw = formData.get(field.key);
    const value = typeof raw === "string" ? raw.trim() : "";
    const max = fieldMaxLength(field);
    if (value.length > max) {
      fieldErrors[field.key] = `Must be ${max} characters or fewer.`;
      continue;
    }
    if (field.required && value.length === 0) {
      fieldErrors[field.key] = "This field is required.";
    }
    data[field.key] = value;
  }

  return { data, fieldErrors };
}

function revalidateDocumentSurfaces() {
  revalidatePath("/portal/documents");
  revalidatePath("/admin/documents");
  revalidatePath("/portal/setup");
}

async function upsertForm(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  propertyId: string,
  formKey: PropertyFormKey,
  data: Record<string, string>,
): Promise<string | null> {
  const completion = computeFormCompletion(FORM_REGISTRY[formKey], data);
  const { error } = await client.from("property_forms").upsert(
    {
      property_id: propertyId,
      form_key: formKey,
      data,
      completed_at: completion.requiredMet ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "property_id,form_key" },
  );
  return error ? error.message : null;
}

function logActivity(
  propertyId: string,
  formKey: PropertyFormKey,
  actorId: string,
  onBehalf: boolean,
) {
  const svc = createServiceClient();
  svc
    .from("activity_log" as never)
    .insert({
      action: "property_updated",
      entity_type: "property",
      entity_id: propertyId,
      actor_id: actorId,
      metadata: {
        field_name: formKey,
        description: `Documents: ${FORM_REGISTRY[formKey].label} saved${onBehalf ? " (on behalf)" : ""}`,
        on_behalf: onBehalf,
      },
    } as never)
    .then(
      () => {},
      () => {},
    );
}

/**
 * Owner (or impersonating admin) saves answers for one form on one property.
 * The form must include hidden `form_key` and `property_id` inputs.
 *
 * Designed for use with React's useActionState — signature is
 * (prevState, formData) => Promise<SaveFormState>.
 */
export async function saveFormAnswers(
  _prev: SaveFormState,
  formData: FormData,
): Promise<SaveFormState> {
  const formKeyRaw = String(formData.get("form_key") ?? "");
  const propertyId = String(formData.get("property_id") ?? "");

  if (!isFormKey(formKeyRaw)) return { error: "Unknown form." };
  if (!propertyId) return { error: "Missing property." };
  const formKey = formKeyRaw;

  // Resolve identity. getPortalContext handles both the owner-self case and
  // the admin-impersonation case (service client scoped to the target owner).
  const { getPortalContext } = await import("@/lib/portal-context");
  const ctx = await getPortalContext();

  // Ownership check: the property must belong to the owner we're scoped to.
  const { data: prop, error: propErr } = await ctx.client
    .from("properties")
    .select("id, owner_id")
    .eq("id", propertyId)
    .single();

  if (propErr || !prop) return { error: "Property not found." };
  if ((prop as { owner_id: string }).owner_id !== ctx.userId) {
    return { error: "You don't have access to this property." };
  }

  const { data, fieldErrors } = collectAnswers(formKey, formData);
  if (Object.keys(fieldErrors).length > 0) {
    return { error: "A few fields need your attention.", fieldErrors };
  }

  const errMsg = await upsertForm(ctx.client, propertyId, formKey, data);
  if (errMsg) return { error: errMsg };

  logActivity(propertyId, formKey, ctx.realUserId, ctx.isImpersonating);
  revalidateDocumentSurfaces();
  return { ok: true };
}

/**
 * Admin saves answers on behalf of an owner from the admin surfaces (hub
 * drawer / workspace tab), where there is no impersonation cookie. Requires
 * the caller to be an admin and the property to belong to `profile_id`.
 *
 * The form must include hidden `form_key`, `property_id`, and `profile_id`.
 */
export async function saveFormAnswersAsAdmin(
  _prev: SaveFormState,
  formData: FormData,
): Promise<SaveFormState> {
  const formKeyRaw = String(formData.get("form_key") ?? "");
  const propertyId = String(formData.get("property_id") ?? "");
  const profileId = String(formData.get("profile_id") ?? "");

  if (!isFormKey(formKeyRaw)) return { error: "Unknown form." };
  if (!propertyId || !profileId) return { error: "Missing property or owner." };
  const formKey = formKeyRaw;

  // Verify the caller is an authenticated admin.
  const userClient = await createClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data: profile } = await userClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    return { error: "Admin access required." };
  }

  // Service client bypasses RLS; assert ownership explicitly.
  const svc = createServiceClient();
  const { data: prop, error: propErr } = await svc
    .from("properties")
    .select("id, owner_id")
    .eq("id", propertyId)
    .single();

  if (propErr || !prop) return { error: "Property not found." };
  if ((prop as { owner_id: string }).owner_id !== profileId) {
    return { error: "Property does not belong to this owner." };
  }

  const { data, fieldErrors } = collectAnswers(formKey, formData);
  if (Object.keys(fieldErrors).length > 0) {
    return { error: "A few fields need your attention.", fieldErrors };
  }

  const errMsg = await upsertForm(svc, propertyId, formKey, data);
  if (errMsg) return { error: errMsg };

  logActivity(propertyId, formKey, user.id, true);
  revalidateDocumentSurfaces();
  revalidatePath(`/admin/workspaces`);
  return { ok: true };
}
