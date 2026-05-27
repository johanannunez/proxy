import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { untypedDatabase } from "@/lib/supabase/untyped";
import { propertyLabel as formatPropertyAddress } from "@/lib/address";
import type { Database } from "@/types/supabase";

type WorkspaceRow = Database["public"]["Tables"]["workspaces"]["Row"];
type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type PropertyRow = Database["public"]["Tables"]["properties"]["Row"];
type PropertyOwnerRow = Database["public"]["Tables"]["property_owners"]["Row"];
type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];
type OwnerMeetingRow = Database["public"]["Tables"]["owner_meetings"]["Row"];
type SignedDocumentRow = Database["public"]["Tables"]["signed_documents"]["Row"];
type ContactRowWithOwnership = ContactRow & { ownership_percentage?: number | null };

type ClientMessageRow = {
  id: string;
  contact_id: string;
  sender_type: string;
  read_at: string | null;
};

export type WorkspaceGalleryView = "active" | "offboarding" | "archived";
export type WorkspaceGalleryStatus = "prospect" | "onboarding" | "active" | "attention" | "offboarding" | "archived";
export type WorkspacePersonRelationshipRole =
  | "owner"
  | "husband"
  | "wife"
  | "family"
  | "partner"
  | "advisor"
  | "collaborator";
export type WorkspacePersonResponsibilityRole =
  | "primary"
  | "day_to_day"
  | "finance"
  | "accounting"
  | "operations"
  | "legal"
  | "notices"
  | "none";

export type WorkspaceGalleryPerson = {
  id: string;
  profileId: string | null;
  contactId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  relationshipRole: WorkspacePersonRelationshipRole;
  responsibilityRole: WorkspacePersonResponsibilityRole;
  roleLabel: string;
  responsibility: string | null;
  ownershipPercentage: number | null;
};

export type WorkspaceGalleryProperty = {
  id: string;
  label: string;
  displayAddress: string;
  displayAddressLine1: string;
  displayAddressLine2: string | null;
  displayLocation: string;
  location: string;
  postalCode: string | null;
  coverPhotoUrl: string | null;
  setupStatus: string;
  active: boolean;
};

export type WorkspaceGalleryCounters = {
  openItemCount: number;
  taskOpenCount: number;
  taskCompletedCount: number;
  taskTotalCount: number;
  fileCount: number;
  fileCompletedCount: number;
  messageCount: number;
  unreadMessageCount: number;
  meetingCount: number;
  upcomingMeetingCount: number;
  meetingCompletedCount: number;
  completedCount: number;
  totalCount: number;
};

export type WorkspaceGalleryCard = {
  id: string;
  name: string;
  type: string;
  isTestWorkspace: boolean;
  status: WorkspaceGalleryStatus;
  statusLabel: string;
  people: WorkspaceGalleryPerson[];
  properties: WorkspaceGalleryProperty[];
  propertyCount: number;
  openTaskCount: number;
  documentCount: number;
  counters: WorkspaceGalleryCounters;
  estimatedMrr: number | null;
  lastActivityAt: string | null;
  nextMeetingAt: string | null;
  nextAction: string;
};

type FetchWorkspaceGalleryOptions = {
  view?: string | null;
  search?: string | null;
};

const PROPERTY_TEXT_COLLATOR = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});

function normalizeView(view: string | null | undefined): WorkspaceGalleryView {
  if (view === "offboarding") return "offboarding";
  if (view === "archived") return "archived";
  return "active";
}

function hasTestMarker(value: string | null | undefined): boolean {
  return /\btest\b/i.test(value ?? "");
}

function isTestWorkspaceCard(card: Pick<WorkspaceGalleryCard, "name" | "people" | "properties">): boolean {
  return (
    hasTestMarker(card.name) ||
    card.people.some((person) => hasTestMarker(person.name) || hasTestMarker(person.email)) ||
    card.properties.some((property) => hasTestMarker(property.label))
  );
}

function limitToOneTestWorkspace(cards: WorkspaceGalleryCard[]): WorkspaceGalleryCard[] {
  let hasVisibleTestWorkspace = false;

  return cards.filter((card) => {
    if (!card.isTestWorkspace) return true;
    if (hasVisibleTestWorkspace) return false;
    hasVisibleTestWorkspace = true;
    return true;
  });
}

function displayName(value: string | null, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

const RELATIONSHIP_LABELS: Record<WorkspacePersonRelationshipRole, string> = {
  owner: "Owner",
  husband: "Husband",
  wife: "Wife",
  family: "Family",
  partner: "Partner",
  advisor: "Advisor",
  collaborator: "Collaborator",
};

const RESPONSIBILITY_LABELS: Record<WorkspacePersonResponsibilityRole, string> = {
  primary: "Lead contact",
  day_to_day: "Day to day",
  finance: "Finance",
  accounting: "Accounting",
  operations: "Operations",
  legal: "Legal",
  notices: "Notices",
  none: "None",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function metadataString(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

function metadataArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").map((item) => item.toLowerCase());
}

function metadataNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeRelationshipRole(value: string): WorkspacePersonRelationshipRole | null {
  const normalizedValue = value.replace(/\s+/g, "_");
  if (normalizedValue === "owner" || normalizedValue === "primary_owner" || normalizedValue === "co_owner") {
    return "owner";
  }
  if (normalizedValue === "husband") return "husband";
  if (normalizedValue === "wife") return "wife";
  if (normalizedValue === "family" || normalizedValue === "spouse" || normalizedValue === "husband_wife") {
    return "family";
  }
  if (normalizedValue === "partner" || normalizedValue === "business_partner") return "partner";
  if (normalizedValue === "advisor" || normalizedValue === "accountant") return "advisor";
  if (normalizedValue === "collaborator" || normalizedValue === "manager" || normalizedValue === "other") {
    return "collaborator";
  }
  return null;
}

function normalizeResponsibilityRole(value: string): WorkspacePersonResponsibilityRole | null {
  if (value === "primary" || value === "decision_maker") return "primary";
  if (value === "day_to_day" || value === "day to day") return "day_to_day";
  if (value === "finance") return "finance";
  if (value === "accounting" || value === "accountant") return "accounting";
  if (value === "operations" || value === "property_setup") return "operations";
  if (value === "legal") return "legal";
  if (value === "notices") return "notices";
  if (value === "none") return "none";
  return null;
}

function knownSpouseRelationshipRole(name: string): "husband" | "wife" | null {
  const normalizedName = name.trim().toLowerCase();
  if (["darryl olive", "vicente romero", "alex hirtle"].includes(normalizedName)) return "husband";
  if (["tina olive", "lisbeth romero", "cassandra hirtle"].includes(normalizedName)) return "wife";
  return null;
}

function knownFamilyRelationshipRole(name: string): WorkspacePersonRelationshipRole | null {
  const normalizedName = name.trim().toLowerCase();
  if (["olga karastanov"].includes(normalizedName)) return "family";
  return null;
}

function knownRelationshipRole(name: string): WorkspacePersonRelationshipRole | null {
  const normalizedName = name.trim().toLowerCase();
  if (normalizedName === "sergey stefoglo") return "owner";
  return knownFamilyRelationshipRole(name);
}

function knownResponsibilityRole(name: string): WorkspacePersonResponsibilityRole | null {
  const normalizedName = name.trim().toLowerCase();
  if (normalizedName === "sergey stefoglo") return "day_to_day";
  if (normalizedName === "olga karastanov") return "accounting";
  return null;
}

function explicitRelationshipRole(contact: ContactRow | null, name: string): WorkspacePersonRelationshipRole | null {
  const metadata = isRecord(contact?.metadata) ? contact.metadata : null;
  if (!metadata) return null;

  const workspaceRelationship = metadataString(metadata.workspace_relationship);
  const normalizedWorkspaceRelationship = workspaceRelationship.replace(/\s+/g, "_");
  if (workspaceRelationship === "accountant") return knownFamilyRelationshipRole(name) ?? "advisor";
  if (normalizedWorkspaceRelationship === "husband_wife") {
    return knownSpouseRelationshipRole(name) ?? "family";
  }

  const explicitRelationship = normalizeRelationshipRole(workspaceRelationship);
  if (explicitRelationship) return explicitRelationship;

  const workspaceRole = metadataString(metadata.workspace_role);
  if (workspaceRole === "spouse") return knownSpouseRelationshipRole(name) ?? "family";
  if (workspaceRole === "accountant") return knownFamilyRelationshipRole(name) ?? "advisor";
  return normalizeRelationshipRole(workspaceRole);
}

function hasQuickRelationshipOverride(contact: ContactRow | null): boolean {
  const metadata = isRecord(contact?.metadata) ? contact.metadata : null;
  return metadataString(metadata?.workspace_relationship_source) === "quick_settings";
}

function hasQuickResponsibilityOverride(contact: ContactRow | null): boolean {
  const metadata = isRecord(contact?.metadata) ? contact.metadata : null;
  return metadataString(metadata?.workspace_responsibility_source) === "quick_settings";
}

function explicitResponsibilityRole(
  contact: ContactRow | null,
  relationshipRole: WorkspacePersonRelationshipRole,
): WorkspacePersonResponsibilityRole | null {
  const metadata = isRecord(contact?.metadata) ? contact.metadata : null;
  if (!metadata) return null;

  const explicitResponsibility = normalizeResponsibilityRole(metadataString(metadata.workspace_responsibility));
  if (explicitResponsibility) return explicitResponsibility;

  const legacyRelationshipResponsibility = normalizeResponsibilityRole(metadataString(metadata.workspace_relationship));
  if (legacyRelationshipResponsibility) return legacyRelationshipResponsibility;

  if (metadataString(metadata.workspace_role) === "accountant") return "accounting";

  const responsibilities = metadataArray(metadata.responsibilities);
  if (responsibilities.includes("finance")) return "finance";
  if (responsibilities.includes("accounting") || responsibilities.includes("accountant")) return "accounting";
  if (responsibilities.includes("day_to_day")) return "day_to_day";
  if (responsibilities.includes("property_setup")) return "operations";
  if (
    responsibilities.includes("decision_maker") &&
    relationshipRole !== "husband" &&
    relationshipRole !== "wife" &&
    relationshipRole !== "family"
  ) {
    return "primary";
  }

  return null;
}

function personRelationshipRole(
  index: number,
  workspaceName: string,
  personName: string,
  contact: ContactRow | null,
): WorkspacePersonRelationshipRole {
  const knownRole = knownRelationshipRole(personName);
  const explicitRole = explicitRelationshipRole(contact, personName);
  if (explicitRole && hasQuickRelationshipOverride(contact)) return explicitRole;
  if (knownRole && (!explicitRole || explicitRole === "advisor" || explicitRole === "collaborator")) return knownRole;
  if (explicitRole) return explicitRole;

  const knownSpouseRole = knownSpouseRelationshipRole(personName);
  if (knownSpouseRole && (workspaceName.toLowerCase().includes(" family") || workspaceName.includes(" & "))) {
    return knownSpouseRole;
  }

  if (contact?.lifecycle_stage === "active_owner") return "owner";
  return index === 0 ? "owner" : "collaborator";
}

function personResponsibilityRole(
  index: number,
  personName: string,
  profile: ProfileRow | null,
  contact: ContactRow | null,
  relationshipRole: WorkspacePersonRelationshipRole,
): WorkspacePersonResponsibilityRole {
  const metadata = isRecord(contact?.metadata) ? contact.metadata : null;
  const quickResponsibility = metadata
    ? normalizeResponsibilityRole(metadataString(metadata.workspace_responsibility))
    : null;
  if (quickResponsibility && hasQuickResponsibilityOverride(contact)) return quickResponsibility;

  const knownResponsibility = knownResponsibilityRole(personName);

  const explicitRole = explicitResponsibilityRole(contact, relationshipRole);
  if (knownResponsibility && (!explicitRole || explicitRole === "primary" || explicitRole === "finance")) {
    return knownResponsibility;
  }
  if (explicitRole) return explicitRole;

  const responsibility = profile?.responsibility?.toLowerCase() ?? "";
  const normalizedResponsibility = normalizeResponsibilityRole(responsibility);
  if (normalizedResponsibility) return normalizedResponsibility;
  if (responsibility.includes("finance")) return "finance";
  if (responsibility.includes("account")) return "accounting";
  if (responsibility.includes("day") || responsibility.includes("operations")) return "day_to_day";
  if (contact?.lifecycle_stage === "active_owner" && index === 0) return "primary";
  return relationshipRole === "owner" && index === 0 ? "primary" : "none";
}

function personRoleLabel(
  relationshipRole: WorkspacePersonRelationshipRole,
  responsibilityRole: WorkspacePersonResponsibilityRole,
  ownershipPercentage: number | null,
): string {
  const relationshipLabel = RELATIONSHIP_LABELS[relationshipRole];
  const ownershipText =
    relationshipRole === "owner" && ownershipPercentage !== null
      ? ` (${Math.trunc(ownershipPercentage) === ownershipPercentage ? ownershipPercentage : ownershipPercentage.toFixed(2)}%)`
      : "";
  if (responsibilityRole === "none") return relationshipLabel;
  return `${relationshipLabel}${ownershipText}, ${RESPONSIBILITY_LABELS[responsibilityRole]}`;
}

function statusFor(contacts: ContactRow[], properties: WorkspaceGalleryProperty[]): WorkspaceGalleryStatus {
  const stages = new Set(contacts.map((contact) => contact.lifecycle_stage));
  if (stages.has("offboarding")) return "offboarding";
  if (stages.has("paused") || stages.has("churned") || stages.has("lead_cold")) return "archived";
  if (stages.has("active_owner")) return "active";
  if (stages.has("onboarding") || properties.length > 0) return "onboarding";
  return "prospect";
}

function statusLabel(status: WorkspaceGalleryStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "attention":
      return "Needs attention";
    case "archived":
      return "Archived";
    case "offboarding":
      return "Offboarding";
    case "onboarding":
      return "Onboarding";
    case "prospect":
      return "Prospect";
  }
}

function propertyLabel(property: PropertyRow): string {
  return abbreviateAddressSuffixes(formatPropertyAddress(property));
}

function propertyDisplayAddress(property: PropertyRow): string {
  return [propertyDisplayAddressLine1(property), propertyDisplayAddressLine2(property)]
    .filter((part): part is string => Boolean(part?.trim()))
    .map((part) => abbreviateAddressSuffixes(part.trim()))
    .join(", ");
}

function propertyDisplayAddressLine1(property: PropertyRow): string {
  return abbreviateAddressSuffixes(property.address_line1?.trim() ?? "");
}

function propertyDisplayAddressLine2(property: PropertyRow): string | null {
  const unit = propertyDisplayUnit(property.address_line2);
  return unit ? abbreviateAddressSuffixes(unit) : null;
}

function propertyDisplayUnit(value: string | null): string | null {
  const trimmedValue = value?.trim();
  if (!trimmedValue) return null;
  if (/^(unit|apt\.?|apartment|suite|ste\.?|#|bldg\.?|building|floor|fl\.?|penthouse)\b/i.test(trimmedValue)) {
    return trimmedValue;
  }
  return `Unit ${trimmedValue}`;
}

function propertyLocation(property: PropertyRow): string {
  const cityState = [property.city, property.state].filter(Boolean).join(", ");
  return [cityState, property.postal_code].filter(Boolean).join(" ");
}

function abbreviateAddressSuffixes(value: string): string {
  return value
    .replace(/\bNorth\b/gi, "N")
    .replace(/\bSouth\b/gi, "S")
    .replace(/\bEast\b/gi, "E")
    .replace(/\bWest\b/gi, "W")
    .replace(/\bStreet\b/gi, "St")
    .replace(/\bAvenue\b/gi, "Ave")
    .replace(/\bBoulevard\b/gi, "Blvd")
    .replace(/\bCourt\b/gi, "Ct")
    .replace(/\bDrive\b/gi, "Dr")
    .replace(/\bRoad\b/gi, "Rd")
    .replace(/\bLane\b/gi, "Ln")
    .replace(/\bPlace\b/gi, "Pl")
    .replace(/\bTerrace\b/gi, "Ter")
    .replace(/\bCircle\b/gi, "Cir")
    .replace(/\bParkway\b/gi, "Pkwy")
    .replace(/\bHighway\b/gi, "Hwy")
    .replace(/\bApartment\b/gi, "Apt")
    .replace(/\bSuite\b/gi, "Ste");
}

function propertyUnitSortValue(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .replace(/^(unit|apt\.?|apartment|suite|ste\.?|#|bldg\.?|building|floor|fl\.?|penthouse)\s*/i, "");
}

function normalizeOwnershipPercentage(value: unknown): number | null {
  const parsed = metadataNumber(value);
  if (parsed === null) return null;
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function normalizeOwnershipSource(
  contact: ContactRowWithOwnership | null,
): number | null {
  const metadata = isRecord(contact?.metadata) ? contact.metadata : null;
  return (
    normalizeOwnershipPercentage(metadata?.workspace_ownership_percentage) ??
    normalizeOwnershipPercentage(metadata?.ownership_percentage) ??
    normalizeOwnershipPercentage(contact?.ownership_percentage)
  );
}

function comparePropertyRows(a: PropertyRow, b: PropertyRow): number {
  const streetCompare = PROPERTY_TEXT_COLLATOR.compare(a.address_line1 ?? "", b.address_line1 ?? "");
  if (streetCompare !== 0) return streetCompare;

  const unitA = propertyUnitSortValue(a.address_line2);
  const unitB = propertyUnitSortValue(b.address_line2);
  if (unitA && unitB) {
    const unitCompare = PROPERTY_TEXT_COLLATOR.compare(unitA, unitB);
    if (unitCompare !== 0) return unitCompare;
  }

  if (unitA || unitB) return unitA ? 1 : -1;

  const cityCompare = PROPERTY_TEXT_COLLATOR.compare(a.city ?? "", b.city ?? "");
  if (cityCompare !== 0) return cityCompare;

  const stateCompare = PROPERTY_TEXT_COLLATOR.compare(a.state ?? "", b.state ?? "");
  if (stateCompare !== 0) return stateCompare;

  return PROPERTY_TEXT_COLLATOR.compare(a.postal_code ?? "", b.postal_code ?? "");
}

function nextActionFor(args: {
  status: WorkspaceGalleryStatus;
  openTaskCount: number;
  documentCount: number;
  propertyCount: number;
  estimatedMrr: number | null;
}): string {
  if (args.openTaskCount > 0) return `${args.openTaskCount} open ${args.openTaskCount === 1 ? "task" : "tasks"}`;
  if (args.documentCount === 0) return "No documents yet";
  if (args.propertyCount === 0) return "Add first property";
  if (!args.estimatedMrr) return "Review finance setup";
  if (args.status === "onboarding") return "Continue onboarding";
  return "Workspace healthy";
}

function isOpenTaskStatus(status: string): boolean {
  return status === "todo" || status === "pending" || status === "in_progress" || status === "blocked";
}

function isCompletedTaskStatus(status: string): boolean {
  return status === "done" || status === "completed";
}

function isCompletedDocumentStatus(status: string): boolean {
  const normalizedStatus = status.toLowerCase();
  return normalizedStatus === "signed" || normalizedStatus === "completed" || normalizedStatus === "complete";
}

function isPendingDocumentStatus(status: string): boolean {
  return !isCompletedDocumentStatus(status);
}

function isUpcomingMeeting(meeting: Pick<OwnerMeetingRow, "scheduled_at" | "status">, now: number): boolean {
  if (!meeting.scheduled_at || meeting.status !== "scheduled") return false;
  const meetingTime = new Date(meeting.scheduled_at).getTime();
  return Number.isFinite(meetingTime) && meetingTime >= now;
}

function isCompletedMeetingStatus(status: string): boolean {
  return status === "completed" || status === "complete";
}

export async function fetchWorkspaceGallery(options: FetchWorkspaceGalleryOptions = {}): Promise<{
  cards: WorkspaceGalleryCard[];
  counts: Record<WorkspaceGalleryView, number>;
  activeView: WorkspaceGalleryView;
}> {
  const supabase = createServiceClient();
  const untypedSupabase = untypedDatabase(supabase);
  const activeView = normalizeView(options.view);
  const search = options.search?.trim().toLowerCase() ?? "";

  const [
    { data: workspaces },
    { data: contacts },
    { data: profiles },
    { data: properties },
    { data: propertyOwners },
    { data: tasks },
    { data: documents },
    { data: signedDocuments },
    { data: ownerMeetings },
    { data: clientMessages },
  ] = await Promise.all([
    supabase.from("workspaces").select("*").order("updated_at", { ascending: false }),
    supabase.from("contacts").select("*").not("workspace_id", "is", null),
    supabase.from("profiles").select("*").not("workspace_id", "is", null),
    supabase.from("properties").select("*").order("created_at", { ascending: true }),
    supabase.from("property_owners").select("owner_id, property_id, role, created_at"),
    supabase.from("tasks").select("id, parent_type, parent_id, linked_contact_id, linked_property_id, status, due_at"),
    supabase.from("documents").select("id, owner_id, status"),
    supabase.from("signed_documents").select("id, user_id, status"),
    supabase
      .from("owner_meetings")
      .select("id, owner_id, scheduled_at, status")
      .not("scheduled_at", "is", null)
      .order("scheduled_at", { ascending: true }),
    untypedSupabase
      .from<ClientMessageRow[]>("client_messages")
      .select("id, contact_id, sender_type, read_at"),
  ]);

  const contactsByWorkspace = new Map<string, ContactRow[]>();
  for (const contact of contacts ?? []) {
    if (!contact.workspace_id) continue;
    const list = contactsByWorkspace.get(contact.workspace_id) ?? [];
    list.push(contact);
    contactsByWorkspace.set(contact.workspace_id, list);
  }

  const profilesByWorkspace = new Map<string, ProfileRow[]>();
  const workspaceByProfile = new Map<string, string>();
  for (const profile of profiles ?? []) {
    if (!profile.workspace_id) continue;
    workspaceByProfile.set(profile.id, profile.workspace_id);
    const list = profilesByWorkspace.get(profile.workspace_id) ?? [];
    list.push(profile);
    profilesByWorkspace.set(profile.workspace_id, list);
  }

  const contactsByProfile = new Map<string, ContactRow>();
  const workspaceByContact = new Map<string, string>();
  for (const contact of contacts ?? []) {
    if (contact.profile_id) contactsByProfile.set(contact.profile_id, contact);
    if (contact.workspace_id) workspaceByContact.set(contact.id, contact.workspace_id);
  }

  const propertyIdsByWorkspace = new Map<string, Set<string>>();
  const propertyById = new Map<string, PropertyRow>();

  function addProperty(workspaceId: string | null | undefined, propertyId: string): void {
    if (!workspaceId) return;
    const set = propertyIdsByWorkspace.get(workspaceId) ?? new Set<string>();
    set.add(propertyId);
    propertyIdsByWorkspace.set(workspaceId, set);
  }

  for (const property of properties ?? []) {
    propertyById.set(property.id, property);
    addProperty(workspaceByContact.get(property.contact_id ?? ""), property.id);
    addProperty(workspaceByProfile.get(property.owner_id), property.id);
  }

  for (const ownerLink of (propertyOwners ?? []) as PropertyOwnerRow[]) {
    addProperty(workspaceByProfile.get(ownerLink.owner_id), ownerLink.property_id);
  }

  const taskCountsByWorkspace = new Map<string, { open: number; completed: number; total: number }>();
  const propertyWorkspaceEntries = Array.from(propertyIdsByWorkspace.entries());
  for (const task of (tasks ?? []) as Pick<TaskRow, "parent_type" | "parent_id" | "linked_contact_id" | "linked_property_id" | "status">[]) {
    const workspaceId =
      task.parent_type === "workspace" && task.parent_id
        ? task.parent_id
        : workspaceByContact.get(task.linked_contact_id ?? "") ??
          (task.linked_property_id
            ? propertyWorkspaceEntries.find(([, ids]) => ids.has(task.linked_property_id ?? ""))?.[0]
            : undefined);
    if (!workspaceId) continue;
    const counts = taskCountsByWorkspace.get(workspaceId) ?? { open: 0, completed: 0, total: 0 };
    counts.total += 1;
    if (isOpenTaskStatus(task.status)) counts.open += 1;
    if (isCompletedTaskStatus(task.status)) counts.completed += 1;
    taskCountsByWorkspace.set(workspaceId, counts);
  }

  const documentsByWorkspace = new Map<string, number>();
  const documentCountsByWorkspace = new Map<string, { pending: number; completed: number; total: number }>();
  for (const doc of (documents ?? []) as Pick<DocumentRow, "owner_id">[]) {
    const workspaceId = workspaceByProfile.get(doc.owner_id);
    if (!workspaceId) continue;
    documentsByWorkspace.set(workspaceId, (documentsByWorkspace.get(workspaceId) ?? 0) + 1);
  }
  for (const doc of (signedDocuments ?? []) as Pick<SignedDocumentRow, "user_id" | "status">[]) {
    const workspaceId = workspaceByProfile.get(doc.user_id);
    if (!workspaceId) continue;
    const counts = documentCountsByWorkspace.get(workspaceId) ?? { pending: 0, completed: 0, total: 0 };
    counts.total += 1;
    if (isCompletedDocumentStatus(doc.status)) counts.completed += 1;
    if (isPendingDocumentStatus(doc.status)) counts.pending += 1;
    documentCountsByWorkspace.set(workspaceId, counts);
  }

  const messageCountsByWorkspace = new Map<string, { unread: number; total: number }>();
  for (const message of clientMessages ?? []) {
    const workspaceId = workspaceByContact.get(message.contact_id);
    if (!workspaceId) continue;
    const counts = messageCountsByWorkspace.get(workspaceId) ?? { unread: 0, total: 0 };
    counts.total += 1;
    if (message.sender_type !== "admin" && !message.read_at) counts.unread += 1;
    messageCountsByWorkspace.set(workspaceId, counts);
  }

  const nextMeetingByWorkspace = new Map<string, string>();
  const meetingCountsByWorkspace = new Map<string, { upcoming: number; completed: number; total: number }>();
  const now = Date.now();
  for (const meeting of (ownerMeetings ?? []) as Pick<OwnerMeetingRow, "owner_id" | "scheduled_at" | "status">[]) {
    const workspaceId = workspaceByProfile.get(meeting.owner_id);
    if (!workspaceId) continue;
    const counts = meetingCountsByWorkspace.get(workspaceId) ?? { upcoming: 0, completed: 0, total: 0 };
    counts.total += 1;
    if (isCompletedMeetingStatus(meeting.status)) counts.completed += 1;
    if (isUpcomingMeeting(meeting, now)) {
      counts.upcoming += 1;
      const meetingTime = new Date(meeting.scheduled_at ?? "").getTime();
      const currentMeetingAt = nextMeetingByWorkspace.get(workspaceId);
      if (!currentMeetingAt || meetingTime < new Date(currentMeetingAt).getTime()) {
        nextMeetingByWorkspace.set(workspaceId, meeting.scheduled_at ?? "");
      }
    }
    meetingCountsByWorkspace.set(workspaceId, counts);
  }

  const allCards = (workspaces ?? []).map((workspace: WorkspaceRow) => {
    const workspaceContacts = contactsByWorkspace.get(workspace.id) ?? [];
    const workspaceProfiles = profilesByWorkspace.get(workspace.id) ?? [];
    const people = workspaceProfiles.map((profile, index): WorkspaceGalleryPerson => {
      const contact = (contactsByProfile.get(profile.id) ?? null) as ContactRowWithOwnership | null;
      const personName = displayName(profile.full_name, profile.email);
      const relationshipRole = personRelationshipRole(index, workspace.name, personName, contact);
      const responsibilityRole = personResponsibilityRole(index, personName, profile, contact, relationshipRole);
      const ownershipPercentage = normalizeOwnershipSource(contact);
      return {
        id: profile.id,
        profileId: profile.id,
        contactId: contact?.id ?? null,
        name: personName,
        email: profile.email,
        phone: profile.phone ?? contact?.phone ?? null,
        avatarUrl: profile.avatar_url ?? contact?.avatar_url ?? null,
        relationshipRole,
        responsibilityRole,
        roleLabel: personRoleLabel(relationshipRole, responsibilityRole, ownershipPercentage),
        responsibility: profile.responsibility,
        ownershipPercentage,
      };
    });

    for (const contact of workspaceContacts) {
      if (contact.profile_id && people.some((person) => person.id === contact.profile_id)) continue;
      const personName = displayName(contact.full_name, contact.email ?? "Unnamed person");
      const relationshipRole = personRelationshipRole(people.length, workspace.name, personName, contact);
      const responsibilityRole = personResponsibilityRole(people.length, personName, null, contact, relationshipRole);
      const ownershipPercentage = normalizeOwnershipSource(contact);
      people.push({
        id: contact.id,
        profileId: null,
        contactId: contact.id,
        name: personName,
        email: contact.email,
        phone: contact.phone,
        avatarUrl: contact.avatar_url,
        relationshipRole,
        responsibilityRole,
        roleLabel: personRoleLabel(relationshipRole, responsibilityRole, ownershipPercentage),
        responsibility: null,
        ownershipPercentage,
      });
    }

    const workspaceProperties = Array.from(propertyIdsByWorkspace.get(workspace.id) ?? [])
      .map((id) => propertyById.get(id))
      .filter((property): property is PropertyRow => Boolean(property))
      .sort(comparePropertyRows)
      .map((property): WorkspaceGalleryProperty => ({
        id: property.id,
        label: propertyLabel(property),
        displayAddress: propertyDisplayAddress(property),
        displayAddressLine1: propertyDisplayAddressLine1(property),
        displayAddressLine2: propertyDisplayAddressLine2(property),
        displayLocation: propertyLocation(property),
        location: propertyLocation(property),
        postalCode: property.postal_code,
        coverPhotoUrl: property.cover_photo_url,
        setupStatus: property.setup_status,
        active: property.active,
      }));

    const baseStatus = statusFor(workspaceContacts, workspaceProperties);
    const taskCounts = taskCountsByWorkspace.get(workspace.id) ?? { open: 0, completed: 0, total: 0 };
    const documentCounts = documentCountsByWorkspace.get(workspace.id) ?? { pending: 0, completed: 0, total: 0 };
    const messageCounts = messageCountsByWorkspace.get(workspace.id) ?? { unread: 0, total: 0 };
    const meetingCounts = meetingCountsByWorkspace.get(workspace.id) ?? { upcoming: 0, completed: 0, total: 0 };
    const openTaskCount = taskCounts.open;
    const documentCount = documentCounts.total || documentsByWorkspace.get(workspace.id) || 0;
    const completedCount = taskCounts.completed + documentCounts.completed + meetingCounts.completed;
    const totalCount = taskCounts.total + documentCounts.total + meetingCounts.total;
    const counters: WorkspaceGalleryCounters = {
      openItemCount: taskCounts.open + documentCounts.pending + messageCounts.unread + meetingCounts.upcoming,
      taskOpenCount: taskCounts.open,
      taskCompletedCount: taskCounts.completed,
      taskTotalCount: taskCounts.total,
      fileCount: documentCount,
      fileCompletedCount: documentCounts.completed,
      messageCount: messageCounts.total,
      unreadMessageCount: messageCounts.unread,
      meetingCount: meetingCounts.total,
      upcomingMeetingCount: meetingCounts.upcoming,
      meetingCompletedCount: meetingCounts.completed,
      completedCount,
      totalCount,
    };
    const status: WorkspaceGalleryStatus = baseStatus === "active" && openTaskCount > 3 ? "attention" : baseStatus;
    const estimatedMrr = workspaceContacts.reduce<number | null>((sum, contact) => {
      if (contact.estimated_mrr == null) return sum;
      return (sum ?? 0) + contact.estimated_mrr;
    }, null);
    const lastActivityAt = workspaceContacts
      .map((contact) => contact.last_activity_at)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;

    const card = {
      id: workspace.id,
      name: workspace.name,
      type: workspace.type,
      isTestWorkspace: false,
      status,
      statusLabel: statusLabel(status),
      people,
      properties: workspaceProperties,
      propertyCount: workspaceProperties.length,
      openTaskCount,
      documentCount,
      counters,
      estimatedMrr,
      lastActivityAt,
      nextMeetingAt: nextMeetingByWorkspace.get(workspace.id) ?? null,
      nextAction: nextActionFor({
        status,
        openTaskCount,
        documentCount,
        propertyCount: workspaceProperties.length,
        estimatedMrr,
      }),
    };

    return {
      ...card,
      isTestWorkspace: isTestWorkspaceCard(card),
    };
  });

  const oneTestWorkspaceCards = limitToOneTestWorkspace(allCards);

  const visibleBySearch = search.length > 0
    ? oneTestWorkspaceCards.filter((card) => {
        const haystack = [
          card.name,
          card.nextMeetingAt ?? "",
          ...card.people.map((person) => `${person.name} ${person.email ?? ""} ${person.phone ?? ""}`),
          ...card.properties.map((property) => `${property.label} ${property.location}`),
        ].join(" ").toLowerCase();
        return haystack.includes(search);
      })
    : oneTestWorkspaceCards;

  const counts = visibleBySearch.reduce<Record<WorkspaceGalleryView, number>>(
    (acc, card) => {
      if (card.status === "offboarding") acc.offboarding += 1;
      else if (card.status === "archived") acc.archived += 1;
      else acc.active += 1;
      return acc;
    },
    { active: 0, offboarding: 0, archived: 0 },
  );

  return {
    cards: visibleBySearch,
    counts,
    activeView,
  };
}
