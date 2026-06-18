import "server-only";
/**
 * Property form sections live in the `documents` spine as raw form rows:
 *   source = 'property_form', form_key set, payload in form_data,
 *   visibility = 'internal' (the catalog spine rows are what clients see).
 * One row per (property_id, form_key) — enforced by uq_documents_property_form.
 *
 * Reads go through the caller's RLS-scoped client (owners can read their own
 * documents rows). Writes verify property access explicitly, then use the
 * service client, because only admins have write RLS on `documents`.
 */

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { untypedDatabase, type UntypedDatabaseClient } from "@/lib/supabase/untyped";
import { syncSpineForProperty } from "@/lib/documents/spine";

export type PropertyFormRow = {
  id: string;
  property_id: string;
  form_key: string;
  data: Record<string, unknown>;
  completed_at: string | null;
  updated_at: string;
};

type RawFormRow = {
  id: string;
  property_id: string;
  form_key: string;
  form_data: Record<string, unknown> | null;
  completed_at: string | null;
  updated_at: string;
};

const FORM_ROW_SELECT = "id, property_id, form_key, form_data, completed_at, updated_at";

function mapRawRow(row: RawFormRow): PropertyFormRow {
  return {
    id: row.id,
    property_id: row.property_id,
    form_key: row.form_key,
    data: row.form_data ?? {},
    completed_at: row.completed_at,
    updated_at: row.updated_at,
  };
}

/** Humanize a form_key for the documents row title ("setup_basic" → "Setup Basic"). */
function titleForFormKey(formKey: string): string {
  return formKey
    .split("_")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

async function fetchFormRow(
  db: UntypedDatabaseClient,
  propertyId: string,
  formKey: string,
): Promise<PropertyFormRow | null> {
  const { data } = await db
    .from<RawFormRow>("documents")
    .select(FORM_ROW_SELECT)
    .eq("source", "property_form")
    .eq("property_id", propertyId)
    .eq("form_key", formKey)
    .maybeSingle();
  return data ? mapRawRow(data) : null;
}

/**
 * Read a single form section for a property.
 * Ownership is enforced via RLS on the user client.
 */
export async function getPropertyForm(
  propertyId: string,
  formKey: string,
): Promise<PropertyFormRow | null> {
  const supabase = await createClient();
  return fetchFormRow(untypedDatabase(supabase), propertyId, formKey);
}

/**
 * Read all form rows for a property (for progress display).
 * Returns a map of form_key → completed boolean.
 */
export async function getPropertyFormCompletionMap(
  propertyId: string,
): Promise<Map<string, boolean>> {
  const supabase = await createClient();
  const { data } = await untypedDatabase(supabase)
    .from<Array<{ form_key: string; completed_at: string | null }>>("documents")
    .select("form_key, completed_at")
    .eq("source", "property_form")
    .eq("property_id", propertyId)
    .not("form_key", "is", null);

  const map = new Map<string, boolean>();
  for (const row of data ?? []) {
    map.set(row.form_key, row.completed_at !== null);
  }
  return map;
}

/** Set of form_keys with a completed raw form row, for setup-hub step states. */
export async function getCompletedFormKeys(propertyId: string): Promise<Set<string>> {
  const map = await getPropertyFormCompletionMap(propertyId);
  const done = new Set<string>();
  for (const [key, completed] of map) {
    if (completed) done.add(key);
  }
  return done;
}

/**
 * Admin-only: read form data bypassing RLS (service client).
 */
export async function getPropertyFormAdmin(
  propertyId: string,
  formKey: string,
): Promise<PropertyFormRow | null> {
  const svc = createServiceClient();
  return fetchFormRow(untypedDatabase(svc), propertyId, formKey);
}

type PropertyAccessRow = { id: string; owner_id: string | null; contact_id: string | null };

/** Resolve the property and the profile id that owns its documents rows. */
async function resolvePropertyOwner(
  db: UntypedDatabaseClient,
  propertyId: string,
): Promise<{ property: PropertyAccessRow; ownerProfileId: string | null } | null> {
  const { data: property } = await db
    .from<PropertyAccessRow>("properties")
    .select("id, owner_id, contact_id")
    .eq("id", propertyId)
    .maybeSingle();
  if (!property) return null;

  let ownerProfileId = property.owner_id;
  if (!ownerProfileId && property.contact_id) {
    const { data: contact } = await db
      .from<{ profile_id: string | null }>("contacts")
      .select("profile_id")
      .eq("id", property.contact_id)
      .maybeSingle();
    ownerProfileId = contact?.profile_id ?? null;
  }
  return { property, ownerProfileId };
}

/** Write (insert or update) the raw form row for a property + form_key. */
async function writeFormRow(
  db: UntypedDatabaseClient,
  ownerProfileId: string,
  propertyId: string,
  formKey: string,
  data: Record<string, unknown>,
): Promise<string | null> {
  const now = new Date().toISOString();
  const { data: existing } = await db
    .from<{ id: string }>("documents")
    .select("id")
    .eq("source", "property_form")
    .eq("property_id", propertyId)
    .eq("form_key", formKey)
    .maybeSingle();

  if (existing) {
    const { error } = await db
      .from("documents")
      .update({ form_data: data, completed_at: now, status: "on_file" })
      .eq("id", existing.id);
    return error ? error.message : null;
  }

  const { error } = await db.from("documents").insert({
    owner_id: ownerProfileId,
    property_id: propertyId,
    document_key: formKey,
    title: titleForFormKey(formKey),
    status: "on_file",
    source: "property_form",
    scope_kind: "property",
    visibility: "internal",
    form_key: formKey,
    form_data: data,
    completed_at: now,
  });
  return error ? error.message : null;
}

/**
 * Upsert a form section. Used directly from server actions.
 * Verifies the caller owns the property (or is an admin), then writes via the
 * service client. Returns null on success, or an error string.
 */
export async function upsertPropertyForm(
  propertyId: string,
  formKey: string,
  data: Record<string, unknown>,
): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "You must be signed in.";

  const svc = untypedDatabase(createServiceClient());
  const resolved = await resolvePropertyOwner(svc, propertyId);
  if (!resolved) return "Property not found.";

  const { property, ownerProfileId } = resolved;

  let allowed = property.owner_id === user.id || ownerProfileId === user.id;
  if (!allowed) {
    const { data: profile } = await svc
      .from<{ role: string | null }>("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    allowed = profile?.role === "admin";
  }
  if (!allowed) return "You do not have access to this property.";

  // documents.owner_id is NOT NULL: prefer the property's owner profile, fall
  // back to the acting user (covers ownerless properties edited by an admin).
  const effectiveOwner = ownerProfileId ?? user.id;
  const writeError = await writeFormRow(svc, effectiveOwner, propertyId, formKey, data);
  if (writeError) return writeError;

  // Keep the documents spine catalog in sync with this form submission.
  await syncSpineForProperty(propertyId);
  return null;
}

/**
 * Admin/back-office upsert that skips the caller check (callers gate access).
 * Returns null on success, or an error string.
 */
export async function upsertPropertyFormAdmin(
  propertyId: string,
  formKey: string,
  data: Record<string, unknown>,
): Promise<string | null> {
  const svc = untypedDatabase(createServiceClient());
  const resolved = await resolvePropertyOwner(svc, propertyId);
  if (!resolved) return "Property not found.";
  if (!resolved.ownerProfileId) return "Property has no linked owner profile.";

  const writeError = await writeFormRow(svc, resolved.ownerProfileId, propertyId, formKey, data);
  if (writeError) return writeError;

  await syncSpineForProperty(propertyId);
  return null;
}
