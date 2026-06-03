import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { LifecycleStage } from "@/lib/admin/contact-types";
import type { Database } from "@/types/supabase";

type QueryError = { message: string };
type QueryResult<T> = { data: T | null; error: QueryError | null };
type QueryBuilder<T> = PromiseLike<QueryResult<T>> & {
  select(columns?: string, options?: { count?: "exact"; head?: boolean }): QueryBuilder<T>;
  eq(column: string, value: string | number | boolean | null): QueryBuilder<T>;
  in(column: string, values: string[]): QueryBuilder<T>;
  order(column: string, options?: { ascending?: boolean }): QueryBuilder<T>;
  limit(count: number): QueryBuilder<T>;
  single(): Promise<QueryResult<T>>;
  maybeSingle(): Promise<QueryResult<T>>;
};
type UntypedDatabaseClient = {
  from<T = unknown>(table: string): QueryBuilder<T>;
};

function untypedDatabase(client: unknown): UntypedDatabaseClient {
  return client as UntypedDatabaseClient;
}

export type WorkspaceContactProperty = {
  id: string;
  label: string;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  setupStatus: string;
  active: boolean;
  bedrooms: number | null;
  bathrooms: number | null;
  createdAt: string;
};

export type AddressComponents = {
  street_number?: string;
  route?: string;
  locality?: string;
  administrative_area_level_1?: string;
  postal_code?: string;
  country?: string;
};

export type SocialLinks = {
  linkedin?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  x?: string | null;
  website?: string | null;
};

export type WorkspaceContactDetail = {
  // Contact fields (always present)
  id: string;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  source: string | null;
  lifecycleStage: LifecycleStage;
  stageChangedAt: string;
  assignedTo: string | null;
  assignedToName: string | null;
  createdAt: string;
  addressFormatted: string | null;
  addressComponents: AddressComponents | null;
  social: SocialLinks;
  preferredContactMethod: 'email' | 'phone' | 'text' | 'whatsapp' | null;
  contractStartAt: string | null;
  contractEndAt: string | null;
  nextFollowUpAt: string | null;
  totalPropertiesOwned: number | null;
  newsletterSubscribed: boolean;
  managementFeePercent: number | null;
  lastActivityAt: string | null;

  // Email verification (true when auth email_confirmed_at is set)
  emailVerified: boolean;

  // Owner fields (null when contact is a pre-profile lead)
  profileId: string | null;
  workspaceId: string | null;
  onboardingCompletedAt: string | null;
  properties: WorkspaceContactProperty[];
  lifetimeRevenue: number | null;
};

type WorkspaceContactPropertyQueryRow = {
  id: string;
  name: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  setup_status: string | null;
  active: boolean | null;
  bedrooms: number | null;
  bathrooms: number | null;
  created_at: string;
};

type WorkspaceMemberContactRow = {
  id: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  profile_id: string | null;
  lifecycle_stage: LifecycleStage;
  metadata: unknown;
};

type ProxyTeamMemberBase = Database["public"]["Tables"]["proxy_team"]["Row"];

export type ProxyTeamMember = ProxyTeamMemberBase & {
  company_name: string | null;
  hours: string | null;
  services: string[] | null;
};

export async function fetchWorkspaceContactDetail(contactId: string): Promise<WorkspaceContactDetail | null> {
  const supabase = await createClient();
  const db = untypedDatabase(supabase);

  const { data: contact, error } = await db
    .from<Record<string, unknown>>("contacts")
    .select(
      `id, profile_id, workspace_id, full_name, display_name, company_name,
       email, phone, avatar_url, source, lifecycle_stage,
       stage_changed_at, assigned_to, created_at, management_fee_percent`
    )
    .eq("id", contactId)
    .single();

  if (error || !contact) return null;

  const { data: extras } = await db
    .from<Record<string, unknown>>("contacts")
    .select(
      `first_name, last_name, address_formatted, address_components,
       social, preferred_contact_method, contract_start_at, contract_end_at,
       next_follow_up_at, total_properties_owned, newsletter_subscribed,
       last_activity_at`
    )
    .eq("id", contactId)
    .single();

  const profileId: string | null = (contact.profile_id as string | null) ?? null;
  let workspaceId: string | null = (contact.workspace_id as string | null) ?? null;
  let onboardingCompletedAt: string | null = null;
  let properties: WorkspaceContactProperty[] = [];
  let lifetimeRevenue: number | null = null;
  let assignedToName: string | null = null;
  let profileAvatarUrl: string | null = null;
  let emailVerified = false;

  const assignedToId = (contact.assigned_to as string | null) ?? null;
  if (assignedToId) {
    const { data: assignee } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", assignedToId)
      .single();
    assignedToName = assignee?.full_name ?? null;
  }

  if (profileId) {
    try {
      const serviceClient = createServiceClient();
      const { data: authData } = await serviceClient.auth.admin.getUserById(profileId);
      emailVerified = !!authData?.user?.email_confirmed_at;
    } catch {
      // Service key not available in this env; default to false
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("workspace_id, onboarding_completed_at, avatar_url")
      .eq("id", profileId)
      .single();

    profileAvatarUrl = profile?.avatar_url ?? null;

    if (profile?.workspace_id) {
      workspaceId = profile.workspace_id;
      onboardingCompletedAt = profile.onboarding_completed_at ?? null;

      // Fetch both direct-owner properties and co-owned properties from the
      // junction table, then deduplicate by ID using the same pattern as workspace-detail.ts.
      const [{ data: primaryProps }, { data: coOwnedProps }] = await Promise.all([
        supabase
          .from("properties")
          .select("id")
          .eq("owner_id", profileId),
        db
          .from<Array<{ property_id: string }>>("property_owners")
          .select("property_id")
          .eq("owner_id", profileId),
      ]);

      const propertyIds = Array.from(
        new Set([
          ...(primaryProps ?? []).map((p: { id: string }) => p.id),
          ...(coOwnedProps ?? []).map((p) => p.property_id),
        ]),
      );

      const { data: props } = propertyIds.length > 0
        ? await db
            .from<WorkspaceContactPropertyQueryRow[]>("properties")
            .select(
              "id, name, address_line1, city, state, setup_status, active, bedrooms, bathrooms, created_at"
            )
            .in("id", propertyIds)
        : { data: [] as WorkspaceContactPropertyQueryRow[] };

      properties = (props ?? []).map((p) => ({
        id: p.id,
        label: p.name ?? p.address_line1 ?? "Unnamed Property",
        addressLine1: p.address_line1,
        city: p.city,
        state: p.state,
        setupStatus: p.setup_status ?? "not_started",
        active: !!p.active,
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms,
        createdAt: p.created_at,
      }));

      if (propertyIds.length > 0) {
        const { data: payouts } = await supabase
          .from("payouts")
          .select("net_payout")
          .in("property_id", propertyIds);
        const total = (payouts ?? []).reduce(
          (sum, p) => sum + ((p.net_payout as number | null) ?? 0),
          0
        );
        lifetimeRevenue = total > 0 ? total : null;
      }
    }
  }

  return {
    id: contact.id as string,
    fullName: contact.full_name as string,
    firstName: (extras?.first_name as string | null) ?? null,
    lastName: (extras?.last_name as string | null) ?? null,
    displayName: (contact.display_name as string | null) ?? null,
    companyName: (contact.company_name as string | null) ?? null,
    email: (contact.email as string | null) ?? null,
    phone: (contact.phone as string | null) ?? null,
    avatarUrl: (contact.avatar_url as string | null) ?? profileAvatarUrl,
    source: (contact.source as string | null) ?? null,
    lifecycleStage: contact.lifecycle_stage as LifecycleStage,
    stageChangedAt: (contact.stage_changed_at as string | null) ?? "",
    assignedTo: assignedToId,
    assignedToName,
    createdAt: contact.created_at as string,
    managementFeePercent: (contact.management_fee_percent as number | null) ?? null,
    addressFormatted: (extras?.address_formatted as string | null) ?? null,
    addressComponents: (extras?.address_components as AddressComponents | null) ?? null,
    social: ((extras?.social as SocialLinks | null) ?? {}) as SocialLinks,
    preferredContactMethod: (extras?.preferred_contact_method as 'email' | 'phone' | 'text' | 'whatsapp' | null) ?? null,
    contractStartAt: (extras?.contract_start_at as string | null) ?? null,
    contractEndAt: (extras?.contract_end_at as string | null) ?? null,
    nextFollowUpAt: (extras?.next_follow_up_at as string | null) ?? null,
    totalPropertiesOwned: (extras?.total_properties_owned as number | null) ?? null,
    newsletterSubscribed: (extras?.newsletter_subscribed as boolean | null) ?? false,
    lastActivityAt: (extras?.last_activity_at as string | null) ?? null,
    emailVerified,
    profileId,
    workspaceId,
    onboardingCompletedAt,
    properties,
    lifetimeRevenue,
  };
}

// ---------------------------------------------------------------------------
// Workspace-first types
// ---------------------------------------------------------------------------

export type WorkspaceMember = {
  id: string;
  profileId: string | null;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  portalAccess: boolean;
  roleLabel: string;
  relationshipLabel: string;
  responsibilityLabel: string | null;
};

export type WorkspaceInfo = {
  id: string;
  name: string;
  type: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function metadataString(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function metadataArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().toLowerCase());
}

function titleizeRole(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(" ");
}

function relationshipLabelFromMetadata(
  index: number,
  lifecycleStage: LifecycleStage,
  metadata: Record<string, unknown>,
): string {
  const relationship = metadataString(metadata.workspace_relationship);
  const role = metadataString(metadata.workspace_role);
  const normalized = (relationship || role).replace(/\s+/g, "_");

  if (normalized === "owner" || normalized === "primary_owner" || normalized === "co_owner") return "Owner";
  if (normalized === "husband") return "Husband";
  if (normalized === "wife") return "Wife";
  if (normalized === "spouse" || normalized === "family" || normalized === "husband_wife") return "Family";
  if (normalized === "partner" || normalized === "business_partner") return "Partner";
  if (normalized === "accountant" || normalized === "advisor") return "Advisor";
  if (normalized === "cleaner" || normalized === "cleaning") return "Cleaner";
  if (normalized === "manager") return "Manager";
  if (normalized === "collaborator" || normalized === "other") return "Collaborator";
  if (lifecycleStage === "active_owner") return "Owner";
  return index === 0 ? "Owner" : "Collaborator";
}

function responsibilityLabelFromMetadata(
  index: number,
  relationshipLabel: string,
  metadata: Record<string, unknown>,
): string | null {
  const explicit = metadataString(metadata.workspace_responsibility);
  const relationship = metadataString(metadata.workspace_relationship);
  const role = metadataString(metadata.workspace_role);
  const responsibilities = metadataArray(metadata.responsibilities);
  const normalized = (explicit || relationship || role).replace(/\s+/g, "_");

  if (normalized === "primary" || normalized === "decision_maker") return "Lead contact";
  if (normalized === "day_to_day") return "Day to day";
  if (normalized === "finance") return "Finance";
  if (normalized === "accounting" || normalized === "accountant") return "Accounting";
  if (normalized === "operations" || normalized === "property_setup") return "Operations";
  if (normalized === "legal") return "Legal";
  if (normalized === "notices") return "Notices";
  if (normalized === "cleaner" || normalized === "cleaning") return "Cleaning";
  if (responsibilities.includes("decision_maker") && relationshipLabel === "Owner") return "Lead contact";
  if (responsibilities.includes("day_to_day")) return "Day to day";
  if (responsibilities.includes("finance")) return "Finance";
  if (responsibilities.includes("accounting") || responsibilities.includes("accountant")) return "Accounting";
  if (responsibilities.includes("property_setup")) return "Operations";
  return relationshipLabel === "Owner" && index === 0 ? "Lead contact" : null;
}

function memberRoleLabels(
  index: number,
  lifecycleStage: LifecycleStage,
  metadataValue: unknown,
): Pick<WorkspaceMember, "roleLabel" | "relationshipLabel" | "responsibilityLabel"> {
  const metadata = isRecord(metadataValue) ? metadataValue : {};
  const relationshipLabel = relationshipLabelFromMetadata(index, lifecycleStage, metadata);
  const responsibilityLabel = responsibilityLabelFromMetadata(index, relationshipLabel, metadata);
  const roleLabel = responsibilityLabel
    ? `${relationshipLabel}, ${responsibilityLabel}`
    : titleizeRole(relationshipLabel);
  return { roleLabel, relationshipLabel, responsibilityLabel };
}

// ---------------------------------------------------------------------------
// Workspace helpers
// ---------------------------------------------------------------------------

export async function fetchWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const supabase = createServiceClient();
  const db = untypedDatabase(supabase);

  const { data, error } = await db
    .from<WorkspaceMemberContactRow[]>("contacts")
    .select("id, full_name, first_name, last_name, email, phone, avatar_url, profile_id, lifecycle_stage, metadata")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return data.map((c, index) => {
    const labels = memberRoleLabels(index, c.lifecycle_stage, c.metadata);
    return {
      id: c.id,
      profileId: c.profile_id,
      fullName: c.full_name,
      firstName: c.first_name,
      lastName: c.last_name,
      email: c.email,
      phone: c.phone,
      avatarUrl: c.avatar_url,
      portalAccess: !!c.profile_id,
      ...labels,
    };
  });
}

export async function fetchProxyTeamMembers(): Promise<ProxyTeamMember[]> {
  const supabase = createServiceClient();

  const db = untypedDatabase(supabase);

  const { data, error } = await db
    .from<ProxyTeamMember[]>("proxy_team")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error || !data) return [];
  return data.map((member) => ({
    ...member,
    company_name: member.company_name ?? null,
    hours: member.hours ?? null,
    services: member.services ?? null,
  }));
}

export async function fetchWorkspaceInfo(workspaceId: string): Promise<WorkspaceInfo | null> {
  const supabase = createServiceClient();
  const db = untypedDatabase(supabase);

  const { data, error } = await db
    .from<WorkspaceInfo>("workspaces")
    .select("id, name, type")
    .eq("id", workspaceId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    name: data.name,
    type: data.type,
  };
}

export async function fetchPrimaryContactIdForWorkspace(workspaceId: string): Promise<string | null> {
  const supabase = createServiceClient();
  const db = untypedDatabase(supabase);

  const { data, error } = await db
    .from<{ id: string }>("contacts")
    .select("id")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data.id;
}
