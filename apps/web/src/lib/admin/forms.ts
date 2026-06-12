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
import type { UnifiedFormResponse } from "./responses-csv";

// Conditional visibility engine lives in the client-safe forms-conditions
// module (the builder UI and public renderer import it directly); re-export
// here so server-side code keeps a single entry point.
export {
  evaluateConditions,
  getVisibleFieldIds,
  stripHiddenValues,
  MAX_FIELD_CONDITIONS,
} from "./forms-conditions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;
function db(): DB {
  return createServiceClient() as DB;
}

function generateSlug(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
}

export type FormWithCount = Form & { response_count: number };

export async function listForms(orgId: string): Promise<FormWithCount[]> {
  // form_responses is not in generated types; cast via any-typed db().
  const { data, error } = await db()
    .from("forms")
    .select("*, form_responses(count)")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[forms] list:", error.message);
    return [];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((item: any) => ({
    ...item,
    form_responses: undefined,
    response_count: (item.form_responses as Array<{ count: number }>)?.[0]?.count ?? 0,
  })) as FormWithCount[];
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
      // completed_at marks when the respondent fully submitted the form.
      // The column was added in migration 20260603100000_form_tracking.
      // DB types are stale; cast happens via the any-typed db() helper above.
      completed_at: new Date().toISOString(),
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

export type FormResponseWithProfile = {
  id: string;
  form_id: string;
  respondent_profile_id: string | null;
  property_id: string | null;
  data: Record<string, unknown>;
  submitted_at: string;
  metadata: Record<string, unknown>;
  started_at: string | null;
  completed_at: string | null;
  respondent_name: string | null;
};

export async function listFormResponsesDetailed(
  formId: string,
): Promise<FormResponseWithProfile[]> {
  // Supabase types are stale — form_responses columns (started_at, completed_at)
  // were added in migration 20260603100000_form_tracking. Cast via any-typed db().
  const { data, error } = await db()
    .from("form_responses")
    .select(
      `id, form_id, respondent_profile_id, property_id, data,
       submitted_at, metadata, started_at, completed_at,
       profiles:respondent_profile_id(full_name)`,
    )
    .eq("form_id", formId)
    .order("submitted_at", { ascending: false });
  if (error) {
    console.error("[forms] listResponsesDetailed:", error.message);
    return [];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    id: r.id,
    form_id: r.form_id,
    respondent_profile_id: r.respondent_profile_id,
    property_id: r.property_id,
    data: r.data ?? {},
    submitted_at: r.submitted_at,
    metadata: r.metadata ?? {},
    started_at: r.started_at ?? null,
    completed_at: r.completed_at ?? null,
    respondent_name: r.profiles?.full_name ?? null,
  }));
}

export async function getFormViewCount(formId: string): Promise<number> {
  // form_views was added in migration 20260603100000_form_tracking; types are stale.
  const { count, error } = await db()
    .from("form_views" as string)
    .select("id", { count: "exact", head: true })
    .eq("form_id", formId);
  if (error) return 0;
  return count ?? 0;
}

// ── Cross-form respondent filter ──────────────────────────────────────────────

export type RespondentProfile = { id: string; name: string };

export async function listRespondentProfiles(orgId: string): Promise<RespondentProfile[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await db()
    .from("form_responses")
    .select(
      "respondent_profile_id, profiles:respondent_profile_id(full_name), forms!inner(org_id)",
    )
    .eq("forms.org_id", orgId)
    .not("respondent_profile_id", "is", null);
  if (error) return [];
  const seen = new Set<string>();
  const result: RespondentProfile[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (data ?? []) as any[]) {
    if (r.respondent_profile_id && !seen.has(r.respondent_profile_id)) {
      seen.add(r.respondent_profile_id);
      result.push({
        id: r.respondent_profile_id,
        name: r.profiles?.full_name ?? "Unknown",
      });
    }
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

export type FormPropertyOption = { id: string; name: string };

export async function listPropertyOptionsForForms(
  orgId: string,
): Promise<FormPropertyOption[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await db()
    .from("form_responses")
    .select("property_id, properties:property_id(name), forms!inner(org_id)")
    .eq("forms.org_id", orgId)
    .not("property_id", "is", null);
  if (error) return [];
  const seen = new Set<string>();
  const result: FormPropertyOption[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (data ?? []) as any[]) {
    if (r.property_id && !seen.has(r.property_id)) {
      seen.add(r.property_id);
      result.push({
        id: r.property_id,
        name: r.properties?.name ?? r.property_id,
      });
    }
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

export type RespondentFormEntry = {
  form_id: string;
  response_id: string;
  submitted_at: string;
  completed_at: string | null;
  data: Record<string, unknown>;
  property_id: string | null;
};

export async function getRespondentCrossFormData(
  orgId: string,
  profileId: string,
  propertyId?: string,
): Promise<RespondentFormEntry[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = db()
    .from("form_responses")
    .select(
      "id, form_id, submitted_at, completed_at, data, property_id, forms!inner(org_id)",
    )
    .eq("forms.org_id", orgId)
    .eq("respondent_profile_id", profileId);
  if (propertyId) q = q.eq("property_id", propertyId);
  const { data, error } = await q.order("submitted_at", { ascending: false });
  if (error) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    form_id: r.form_id,
    response_id: r.id,
    submitted_at: r.submitted_at,
    completed_at: r.completed_at ?? null,
    data: r.data ?? {},
    property_id: r.property_id ?? null,
  }));
}

// ── Unified cross-form responses view (Today cockpit / cross-form consumers) ──

export async function listAllFormResponses(): Promise<UnifiedFormResponse[]> {
  const { data, error } = await db()
    .from("form_responses")
    .select(
      `id, form_id, property_id, data, submitted_at, completed_at,
       forms:form_id(name),
       profiles:respondent_profile_id(full_name, email),
       properties:property_id(name)`,
    )
    .order("submitted_at", { ascending: false });
  if (error) {
    console.error("[forms] listAllFormResponses:", error.message);
    return [];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    id: r.id,
    form_id: r.form_id,
    form_name: r.forms?.name ?? "Untitled form",
    respondent_name: r.profiles?.full_name ?? null,
    respondent_email: r.profiles?.email ?? null,
    property_id: r.property_id ?? null,
    property_name: r.properties?.name ?? null,
    submitted_at: r.submitted_at,
    completed_at: r.completed_at ?? null,
    data: r.data ?? {},
  }));
}
