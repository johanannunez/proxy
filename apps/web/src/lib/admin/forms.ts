import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import type {
  Form,
  FormResponse,
  CreateFormInput,
  UpdateFormInput,
  CreateFormResponseInput,
  FormSchema,
} from "./forms-types";
import { DEFAULT_FORM_SCHEMA } from "./forms-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;
function db(): DB {
  return createServiceClient() as DB;
}

function generateSlug(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
}

export async function listForms(orgId: string): Promise<Form[]> {
  const { data, error } = await db()
    .from("forms")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[forms] list:", error.message);
    return [];
  }
  return (data ?? []) as Form[];
}

export async function getForm(id: string): Promise<Form | null> {
  const { data } = await db().from("forms").select("*").eq("id", id).maybeSingle();
  return (data as Form | null) ?? null;
}

export async function getFormBySlug(slug: string): Promise<Form | null> {
  const { data } = await db().from("forms").select("*").eq("slug", slug).maybeSingle();
  return (data as Form | null) ?? null;
}

export async function createForm(input: CreateFormInput): Promise<Form | null> {
  const schema: FormSchema = input.schema ?? DEFAULT_FORM_SCHEMA;
  const { data, error } = await db()
    .from("forms")
    .insert({
      org_id: input.org_id,
      name: input.name,
      description: input.description ?? null,
      schema,
      is_public: input.is_public ?? false,
      is_active: false,
      created_by: input.created_by ?? null,
    })
    .select("*")
    .single();
  if (error) {
    console.error("[forms] create:", error.message);
    return null;
  }
  return data as Form;
}

export async function updateForm(id: string, updates: UpdateFormInput): Promise<Form | null> {
  const { data, error } = await db()
    .from("forms")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();
  if (error) {
    console.error("[forms] update:", error.message);
    return null;
  }
  return data as Form;
}

export async function publishForm(id: string): Promise<Form | null> {
  const form = await getForm(id);
  if (!form) return null;

  const slug = form.slug ?? generateSlug();
  return updateForm(id, { is_active: true, slug });
}

export async function deleteForm(id: string): Promise<boolean> {
  const { error } = await db().from("forms").delete().eq("id", id);
  if (error) {
    console.error("[forms] delete:", error.message);
    return false;
  }
  return true;
}

export async function listFormResponses(formId: string): Promise<FormResponse[]> {
  const { data, error } = await db()
    .from("form_responses")
    .select("*")
    .eq("form_id", formId)
    .order("submitted_at", { ascending: false });
  if (error) {
    console.error("[forms] listResponses:", error.message);
    return [];
  }
  return (data ?? []) as FormResponse[];
}

export async function createFormResponse(
  input: CreateFormResponseInput,
): Promise<FormResponse | null> {
  const { data, error } = await db()
    .from("form_responses")
    .insert({
      form_id: input.form_id,
      respondent_profile_id: input.respondent_profile_id ?? null,
      property_id: input.property_id ?? null,
      data: input.data,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();
  if (error) {
    console.error("[forms] createResponse:", error.message);
    return null;
  }
  return data as FormResponse;
}

export async function countFormResponses(formId: string): Promise<number> {
  const { count } = await db()
    .from("form_responses")
    .select("id", { count: "exact", head: true })
    .eq("form_id", formId);
  return count ?? 0;
}
