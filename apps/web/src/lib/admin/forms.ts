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

type RawUnifiedFormResponseRow = {
  id: string;
  form_id: string;
  respondent_profile_id: string | null;
  property_id: string | null;
  data: Record<string, unknown> | null;
  submitted_at: string;
  completed_at: string | null;
  forms: { name: string | null } | null;
};

type FormProfileLookupRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  workspace_id: string | null;
};

type FormPropertyLookupRow = {
  id: string;
  name: string | null;
  contact_id: string | null;
  owner_id: string;
};

type FormContactLookupRow = {
  id: string;
  workspace_id: string | null;
};

type FormWorkspaceLookupRow = {
  id: string;
  name: string;
};

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

async function enrichUnifiedResponseRows(
  rows: RawUnifiedFormResponseRow[],
): Promise<UnifiedFormResponse[]> {
  const propertyIds = uniqueStrings(rows.map((row) => row.property_id));

  const { data: propertiesData } = propertyIds.length > 0
    ? await db()
        .from("properties")
        .select("id, name, contact_id, owner_id")
        .in("id", propertyIds)
    : { data: [] };

  const properties = (propertiesData ?? []) as FormPropertyLookupRow[];
  const profileIds = uniqueStrings([
    ...rows.map((row) => row.respondent_profile_id),
    ...properties.map((property) => property.owner_id),
  ]);
  const contactIds = uniqueStrings(properties.map((property) => property.contact_id));

  const [{ data: profilesData }, { data: contactsData }] = await Promise.all([
    profileIds.length > 0
      ? db()
          .from("profiles")
          .select("id, full_name, email, workspace_id")
          .in("id", profileIds)
      : Promise.resolve({ data: [] }),
    contactIds.length > 0
      ? db()
          .from("contacts")
          .select("id, workspace_id")
          .in("id", contactIds)
      : Promise.resolve({ data: [] }),
  ]);

  const profiles = (profilesData ?? []) as FormProfileLookupRow[];
  const contacts = (contactsData ?? []) as FormContactLookupRow[];
  const workspaceIds = uniqueStrings([
    ...profiles.map((profile) => profile.workspace_id),
    ...contacts.map((contact) => contact.workspace_id),
  ]);

  const { data: workspacesData } = workspaceIds.length > 0
    ? await db()
        .from("workspaces")
        .select("id, name")
        .in("id", workspaceIds)
    : { data: [] };

  const propertyById = new Map(properties.map((property) => [property.id, property]));
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const contactById = new Map(contacts.map((contact) => [contact.id, contact]));
  const workspaceById = new Map(
    ((workspacesData ?? []) as FormWorkspaceLookupRow[]).map((workspace) => [
      workspace.id,
      workspace,
    ]),
  );

  return rows.map((row) => {
    const property = row.property_id ? propertyById.get(row.property_id) : null;
    const respondent = row.respondent_profile_id
      ? profileById.get(row.respondent_profile_id)
      : null;
    const propertyContact = property?.contact_id
      ? contactById.get(property.contact_id)
      : null;
    const propertyOwner = property?.owner_id ? profileById.get(property.owner_id) : null;
    const workspaceId =
      propertyContact?.workspace_id ??
      propertyOwner?.workspace_id ??
      respondent?.workspace_id ??
      null;
    const workspace = workspaceId ? workspaceById.get(workspaceId) : null;

    return {
      id: row.id,
      form_id: row.form_id,
      form_name: row.forms?.name ?? "Untitled form",
      respondent_name: respondent?.full_name ?? null,
      respondent_email: respondent?.email ?? null,
      property_id: row.property_id ?? null,
      property_name: property?.name ?? null,
      workspace_id: workspaceId,
      workspace_name: workspace?.name ?? null,
      submitted_at: row.submitted_at,
      completed_at: row.completed_at ?? null,
      data: row.data ?? {},
    };
  });
}

/** Tracking/archive columns ship in migration 20260612090000; rows read
    before it is applied lack them, so normalize to safe defaults. */
function normalizeForm<T extends Form>(row: T): T {
  return {
    ...row,
    tracked: row.tracked ?? true,
    category: row.category ?? null,
    archived_at: row.archived_at ?? null,
    icon: row.icon ?? null,
    icon_color: row.icon_color ?? null,
  };
}

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
  return ((data ?? []).map((item: any) => ({
    ...item,
    form_responses: undefined,
    response_count: (item.form_responses as Array<{ count: number }>)?.[0]?.count ?? 0,
  })) as FormWithCount[]).map(normalizeForm);
}

export async function getForm(id: string): Promise<Form | null> {
  const { data } = await db().from("forms").select("*").eq("id", id).maybeSingle();
  const row = data as Form | null;
  return row ? normalizeForm(row) : null;
}

export async function getFormBySlug(slug: string): Promise<Form | null> {
  const { data } = await db().from("forms").select("*").eq("slug", slug).maybeSingle();
  const row = data as Form | null;
  return row ? normalizeForm(row) : null;
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
      tracked: true,
      created_by: input.created_by ?? null,
      icon: input.icon ?? null,
      icon_color: input.icon_color ?? null,
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
  return normalizeForm(data as Form);
}

/** Copy a form master (schema + meta) into a new unpublished draft. */
export async function duplicateForm(id: string, createdBy?: string): Promise<Form | null> {
  const source = await getForm(id);
  if (!source) return null;
  const { data, error } = await db()
    .from("forms")
    .insert({
      org_id: source.org_id,
      name: `${source.name} (copy)`,
      description: source.description,
      schema: source.schema,
      is_public: source.is_public,
      is_active: false,
      tracked: source.tracked,
      category: source.category,
      created_by: createdBy ?? null,
    })
    .select("*")
    .single();
  if (error) {
    console.error("[forms] duplicate:", error.message);
    return null;
  }
  return normalizeForm(data as Form);
}

/** Archive hides the form from the active list and unpublishes it. */
export async function archiveForm(id: string): Promise<Form | null> {
  return updateForm(id, { archived_at: new Date().toISOString(), is_active: false });
}

export async function unarchiveForm(id: string): Promise<Form | null> {
  return updateForm(id, { archived_at: null });
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

/**
 * Org-scoped cross-form response list for the Forms hub Activity tab.
 * Joins to forms to filter by org, and to profiles for respondent display name.
 * Ordered newest first, capped at `limit` rows (default 100).
 */
export async function listAllFormResponsesForOrg(
  orgId: string,
  limit = 100,
): Promise<UnifiedFormResponse[]> {
  const { data, error } = await db()
    .from("form_responses")
    .select(
      `id, form_id, respondent_profile_id, property_id, data, submitted_at, completed_at,
       forms:form_id!inner(name, org_id)`,
    )
    .eq("forms.org_id", orgId)
    .order("submitted_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[forms] listAllFormResponsesForOrg:", error.message);
    return [];
  }
  return enrichUnifiedResponseRows((data ?? []) as RawUnifiedFormResponseRow[]);
}

export async function listAllFormResponses(): Promise<UnifiedFormResponse[]> {
  const { data, error } = await db()
    .from("form_responses")
    .select(
      `id, form_id, respondent_profile_id, property_id, data, submitted_at, completed_at,
       forms:form_id(name)`,
    )
    .order("submitted_at", { ascending: false });
  if (error) {
    console.error("[forms] listAllFormResponses:", error.message);
    return [];
  }
  return enrichUnifiedResponseRows((data ?? []) as RawUnifiedFormResponseRow[]);
}
