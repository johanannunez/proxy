import { createClient } from "@/lib/supabase/server";
import { untypedDatabase } from "@/lib/supabase/untyped";

export type PaletteScope =
  | "all"
  | "contacts"
  | "owners"
  | "properties"
  | "tasks"
  | "projects";

export type PaletteHit = {
  id: string;
  kind: "contact" | "owner" | "property" | "task" | "project" | "document" | "template";
  label: string;
  subtitle?: string;
  href: string;
};

export type PaletteSearchResponse = {
  contacts: PaletteHit[];
  owners: PaletteHit[];
  properties: PaletteHit[];
  tasks: PaletteHit[];
  projects: PaletteHit[];
  documents: PaletteHit[];
  templates: PaletteHit[];
};

function ilikePattern(q: string): string {
  const escaped = q.replace(/[%_]/g, (c) => `\\${c}`);
  return `"%${escaped.replaceAll('"', '""')}%"`;
}

async function queryContacts(q: string, limit: number): Promise<PaletteHit[]> {
  const supabase = await createClient();
  let query = supabase
    .from("contacts")
    .select("id, full_name, display_name, company_name, email");

  if (q) {
    const pattern = ilikePattern(q);
    query = query.or(
      `full_name.ilike.${pattern},display_name.ilike.${pattern},company_name.ilike.${pattern},email.ilike.${pattern}`,
    );
  }
  query = query.order("full_name", { ascending: true }).limit(limit);

  const { data } = await query;
  return (data ?? []).map((r) => {
    const name = (r.display_name?.trim() || r.full_name?.trim() || r.company_name?.trim() || r.email || "Contact") as string;
    const subtitle = r.email ?? r.company_name ?? undefined;
    return {
      id: r.id as string,
      kind: "contact",
      label: name,
      subtitle,
      href: `/admin/people/${r.id}`,
    };
  });
}

async function queryOwners(q: string, limit: number): Promise<PaletteHit[]> {
  const supabase = await createClient();
  let query = supabase
    .from("profiles")
    .select("id, full_name, email, workspace_id")
    .eq("role", "owner");

  if (q) {
    const pattern = ilikePattern(q);
    query = query.or(`full_name.ilike.${pattern},email.ilike.${pattern}`);
  }
  query = query.order("full_name", { ascending: true }).limit(limit);

  const { data } = await query;
  return (data ?? []).map((r) => {
    const name = (r.full_name?.trim() || r.email || "Owner") as string;
    return {
      id: r.id as string,
      kind: "owner",
      label: name,
      subtitle: r.email ?? undefined,
      href: r.workspace_id ? `/admin/workspaces/${r.workspace_id}` : "/admin/workspaces?view=active-owners",
    };
  });
}

async function queryProperties(q: string, limit: number): Promise<PaletteHit[]> {
  const supabase = await createClient();
  let query = supabase
    .from("properties")
    .select("id, name, address_line1, city, state");

  if (q) {
    const pattern = ilikePattern(q);
    query = query.or(
      `name.ilike.${pattern},address_line1.ilike.${pattern},city.ilike.${pattern}`,
    );
  }
  query = query.order("address_line1", { ascending: true }).limit(limit);

  const { data } = await query;
  return (data ?? []).map((r) => {
    const label = (r.name?.trim() || r.address_line1 || "(unnamed property)") as string;
    const locality = [r.city, r.state].filter(Boolean).join(", ") || undefined;
    const subtitle = r.name?.trim() ? r.address_line1 ?? locality : locality;
    return {
      id: r.id as string,
      kind: "property",
      label,
      subtitle,
      href: `/admin/properties/${r.id}`,
    };
  });
}

async function queryTasks(q: string, limit: number): Promise<PaletteHit[]> {
  const supabase = await createClient();
  let query = supabase
    .from("tasks")
    .select("id, title, status, due_at");

  if (q) {
    query = query.ilike("title", `%${q.replace(/[%_]/g, (c) => `\\${c}`)}%`);
  }
  query = query.order("created_at", { ascending: false }).limit(limit);

  const { data } = await query;
  return (data ?? []).map((r) => {
    const title = (r.title as string | null)?.trim() || "Untitled task";
    const status = r.status as string | null;
    return {
      id: r.id as string,
      kind: "task",
      label: title,
      subtitle: status ? `Task · ${status}` : "Task",
      href: q
        ? `/admin/tasks?q=${encodeURIComponent(q)}`
        : `/admin/tasks`,
    };
  });
}

async function queryProjects(q: string, limit: number): Promise<PaletteHit[]> {
  const supabase = await createClient();
  let query = supabase
    .from("projects")
    .select("id, name, status");

  if (q) {
    const pattern = ilikePattern(q);
    query = query.or(`name.ilike.${pattern}`);
  }
  query = query.order("updated_at", { ascending: false }).limit(limit);

  const { data } = await query;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    kind: "project",
    label: (r.name as string | null)?.trim() || "Untitled project",
    subtitle: (r.status as string | null) ?? undefined,
    href: `/admin/projects/${r.id}`,
  }));
}

/* ─── Paperwork (2026-06-12 IA amendment): document instances + masters ─── */

type DocumentRow = {
  id: string;
  title: string | null;
  document_key: string | null;
  status: string | null;
  owner_id: string;
};

/** Document instances on the spine. Deep links open the Documents drawer. */
async function queryDocuments(q: string, limit: number): Promise<PaletteHit[]> {
  const supabase = await createClient();
  const db = untypedDatabase(supabase);
  const pattern = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;

  const { data, error } = await db
    .from<DocumentRow[]>("documents")
    .select("id, title, document_key, status, owner_id")
    .is("form_key", null)
    .not("owner_id", "is", null)
    .or(`title.ilike.${pattern},document_key.ilike.${pattern}`)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];

  const ownerIds = [...new Set(data.map((r) => r.owner_id))];
  const names = new Map<string, string>();
  if (ownerIds.length > 0) {
    const { data: profiles } = await db
      .from<Array<{ id: string; full_name: string | null }>>("profiles")
      .select("id, full_name")
      .in("id", ownerIds);
    for (const p of profiles ?? []) names.set(p.id, p.full_name ?? "Owner");
  }

  return data.map((r) => {
    const status = r.status ? r.status.replace(/_/g, " ") : null;
    const ownerName = names.get(r.owner_id) ?? "Owner";
    return {
      id: r.id,
      kind: "document" as const,
      label: r.title?.trim() || r.document_key || "Document",
      subtitle: status ? `${ownerName} · ${status}` : ownerName,
      href: r.document_key
        ? `/admin/paperwork/signatures?owner=${r.owner_id}&doc=${r.document_key}`
        : "/admin/paperwork/signatures",
    };
  });
}

/** Masters: signature templates + form templates, merged. */
async function queryTemplates(q: string, limit: number): Promise<PaletteHit[]> {
  const supabase = await createClient();
  const db = untypedDatabase(supabase);
  const pattern = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;

  const [templateRes, formRes] = await Promise.all([
    db
      .from<Array<{ id: string; display_name: string }>>("document_templates")
      .select("id, display_name")
      .eq("is_active", true)
      .ilike("display_name", pattern)
      .limit(limit),
    db
      .from<Array<{ id: string; name: string }>>("forms")
      .select("id, name")
      .ilike("name", pattern)
      .limit(limit),
  ]);

  const hits: PaletteHit[] = [
    ...(templateRes.data ?? []).map((r) => ({
      id: r.id,
      kind: "template" as const,
      label: r.display_name,
      subtitle: "Signature template",
      href: `/admin/paperwork/templates/${r.id}`,
    })),
    ...(formRes.data ?? []).map((r) => ({
      id: r.id,
      kind: "template" as const,
      label: r.name,
      subtitle: "Form",
      href: `/admin/paperwork/templates/${r.id}`,
    })),
  ];
  return hits.slice(0, limit);
}

export async function searchAll(
  q: string,
  perGroup = 5,
): Promise<PaletteSearchResponse> {
  const query = q.trim();
  if (!query) {
    return {
      contacts: [], owners: [], properties: [], tasks: [], projects: [],
      documents: [], templates: [],
    };
  }
  const [contacts, owners, properties, tasks, projects, documents, templates] =
    await Promise.all([
      queryContacts(query, perGroup),
      queryOwners(query, perGroup),
      queryProperties(query, perGroup),
      queryTasks(query, perGroup),
      queryProjects(query, perGroup),
      queryDocuments(query, perGroup),
      queryTemplates(query, perGroup),
    ]);
  return { contacts, owners, properties, tasks, projects, documents, templates };
}

export async function listScope(
  scope: PaletteScope,
  limit = 10,
): Promise<PaletteHit[]> {
  switch (scope) {
    case "contacts":
      return queryContacts("", limit);
    case "owners":
      return queryOwners("", limit);
    case "properties":
      return queryProperties("", limit);
    case "tasks":
      return queryTasks("", limit);
    case "projects":
      return queryProjects("", limit);
    case "all":
    default:
      return [];
  }
}
