import { notFound, redirect } from "next/navigation";
import { fetchProxyTeamMembers, fetchWorkspaceContactDetail, fetchWorkspaceInfo, fetchWorkspaceMembers } from "@/lib/admin/workspace-contact-detail";
import type { AddressComponents } from "@/lib/admin/workspace-contact-detail";
import { fetchWorkspaceDetail } from "@/lib/admin/workspace-detail";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { untypedDatabase } from "@/lib/supabase/untyped";
import type { OwnerReceiptRow } from "@/app/(workspace)/workspace/finances/receipts-types";
import { fetchInternalNote } from "@/lib/admin/owner-facts-actions";
import { WorkspaceDetailShell } from "./WorkspaceDetailShell";
import { fetchAdminProfiles } from "./workspace-person-actions";
import { PropertiesTab } from "./PropertiesTab";
import { TabPlaceholder } from "@/app/(admin)/admin/workspaces/[workspaceId]/TabPlaceholder";
import { MeetingsTab } from "@/app/(admin)/admin/workspaces/[workspaceId]/MeetingsTab";
import { SettingsTab } from "@/app/(admin)/admin/workspaces/[workspaceId]/SettingsTab";
import { SETTINGS_SECTIONS, type SettingsSection } from "@/app/(admin)/admin/workspaces/[workspaceId]/settings-sections";
import type { SessionRow } from "@/app/(admin)/admin/workspaces/[workspaceId]/settings/AccountSecuritySection";
import type { ConnectionRow } from "@/app/(admin)/admin/workspaces/[workspaceId]/settings/DataPrivacySection";
import { fetchWorkspaceMeetings, fetchNextMeeting } from "@/lib/admin/workspace-meetings";
import { fetchInsightsByParent } from "@/lib/admin/ai-insights";
import { FinanceTab } from "./FinanceTab";
import { fetchWorkspaceFinance } from "@/lib/admin/workspace-finance";
import { DocumentsTab } from "./DocumentsTab";
import { fetchWorkspaceDocuments } from "@/lib/admin/workspace-documents";
import { fetchOwnerSpine } from "@/lib/documents/spine";
import { fetchDocumentGroupSettings } from "@/lib/admin/document-group-settings";
import { MessagingTab } from "./MessagingTab";
import { fetchWorkspacePersonMessages, fetchWorkspaceMessages, fetchWorkspaceInboxConversations } from "@/lib/admin/workspace-messages";
import { WorkspaceOverviewTab } from "./WorkspaceOverviewTab";
import { fetchWorkspaceContactOpenTasks } from "@/lib/admin/workspace-overview";
import { TasksTab } from "@/components/admin/tasks/TasksTab";
import { fetchWorkspaceProjects } from "@/lib/admin/workspace-projects";

export const dynamic = "force-dynamic";

type TabKey =
  | "home"
  | "inbox"
  | "tasks"
  | "meetings"
  | "documents"
  | "finances"
  | "properties"
  | "timeline"
  | "settings";

const KNOWN_TABS: readonly TabKey[] = [
  "home",
  "inbox",
  "tasks",
  "meetings",
  "documents",
  "finances",
  "properties",
  "timeline",
  "settings",
];

const LEGACY_TAB_MAP: Record<string, TabKey> = {
  overview: "home",
  team: "home",
  messaging: "inbox",
  finance: "finances",
  billing: "finances",
  projects: "home",
};

const CONTACT_METHODS = ["email", "sms", "phone", "whatsapp"] as const;
type StoredContactMethod = "email" | "sms" | "phone" | "whatsapp" | null;

function buildAddressLines(
  components: AddressComponents | null,
  formatted: string | null,
): { line1: string; line2: string } | null {
  if (components?.route) {
    const line1 = [components.street_number, components.route].filter(Boolean).join(" ");
    const city = components.locality ?? "";
    const state = components.administrative_area_level_1 ?? "";
    const zip = components.postal_code ?? "";
    const stateParts = [state, zip].filter(Boolean).join(" ");
    const line2 = [city, stateParts].filter(Boolean).join(", ");
    return line1 ? { line1, line2: line2 || "" } : null;
  }
  if (formatted) {
    const commaIdx = formatted.lastIndexOf(",", formatted.lastIndexOf(",") - 1);
    if (commaIdx > 0) {
      return { line1: formatted.slice(0, commaIdx).trim(), line2: formatted.slice(commaIdx + 1).trim() };
    }
  }
  return null;
}

type Props = {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ tab?: string; section?: string; person?: string; detail?: string }>;
};

export default async function WorkspaceDetailPage({ params, searchParams }: Props) {
  const { workspaceId } = await params;
  const { tab: tabParam, section: sectionParam, person: personParam, detail: detailParam } = await searchParams;

  if (tabParam && LEGACY_TAB_MAP[tabParam]) {
    const nextSearchParams = new URLSearchParams({ tab: LEGACY_TAB_MAP[tabParam] });
    if (sectionParam) nextSearchParams.set("section", sectionParam);
    if (personParam) nextSearchParams.set("person", personParam);
    if (detailParam) nextSearchParams.set("detail", detailParam);
    redirect(`/admin/workspaces/${workspaceId}?${nextSearchParams.toString()}`);
  }

  const workspaceInfo = await fetchWorkspaceInfo(workspaceId);

  if (!workspaceInfo) {
    notFound();
  }

  // Resolve the active contact: prefer ?person= param, else first member
  const members = await fetchWorkspaceMembers(workspaceId);
  const activeContactId = (personParam && members.find((m) => m.id === personParam))
    ? personParam
    : members[0]?.id ?? null;

  if (!activeContactId) notFound();

  const tab: TabKey = (KNOWN_TABS as readonly string[]).includes(tabParam ?? "")
    ? (tabParam as TabKey)
    : "home";

  const section: SettingsSection = (SETTINGS_SECTIONS as readonly string[]).includes(sectionParam ?? "")
    ? (sectionParam as SettingsSection)
    : "personal";

  const [workspaceContact, adminProfiles] = await Promise.all([
    fetchWorkspaceContactDetail(activeContactId),
    fetchAdminProfiles(),
  ]);
  void detailParam;
  if (!workspaceContact) notFound();

  const meetingProfileId = workspaceContact.profileId ?? activeContactId;
  const messagingContactIds = members.map((m) => m.id);
  const propertyIds = workspaceContact.properties.map((property) => property.id);
  const contactIds = members.map((member) => member.id);
  const [
    nextMeeting,
    workspaceData,
    workspaceMeetings,
    contactInsights,
    financeData,
    workspaceDocuments,
    ownerSpineDocuments,
    documentGroupSettings,
    allWorkspaceMessages,
    workspaceInboxConversations,
    overviewMessages,
    openTasks,
    workspaceProjects,
    proxyTeam,
    receiptsForExplorer,
  ] = await Promise.all([
    workspaceContact.profileId ? fetchNextMeeting(workspaceContact.profileId) : Promise.resolve(null),
    workspaceContact.workspaceId ? fetchWorkspaceDetail(workspaceContact.workspaceId) : Promise.resolve(null),
    meetingProfileId ? fetchWorkspaceMeetings(meetingProfileId) : Promise.resolve([]),
    fetchInsightsByParent("contact", [activeContactId]),
    fetchWorkspaceFinance(workspaceId, workspaceContact.id, workspaceContact.properties.length, workspaceContact.profileId),
    workspaceContact.profileId ? fetchWorkspaceDocuments(workspaceContact.profileId, propertyIds) : Promise.resolve([]),
    workspaceContact.profileId ? fetchOwnerSpine(workspaceContact.profileId) : Promise.resolve([]),
    workspaceContact.profileId ? fetchDocumentGroupSettings(workspaceContact.profileId) : Promise.resolve([]),
    fetchWorkspaceMessages(messagingContactIds),
    fetchWorkspaceInboxConversations(workspaceContact.profileId),
    fetchWorkspacePersonMessages(activeContactId),
    fetchWorkspaceContactOpenTasks(activeContactId),
    fetchWorkspaceProjects({ contactIds, propertyIds }),
    fetchProxyTeamMembers(),
    workspaceContact.profileId
      ? (async () => {
          const svc = createServiceClient();
          const db = untypedDatabase(svc);
          const { data } = await db
            .from<OwnerReceiptRow[]>("owner_receipts")
            .select(
              "id, vendor, amount, currency, category, purchase_date, notes, image_url, storage_path, reviewed_at, analysis_kind, analysis_summary, analysis_source, payment_source, reimbursement_status, line_items, file_hash, property:properties(name, address_line1, city, state)",
            )
            .eq("owner_id", workspaceContact.profileId!)
            .order("purchase_date", { ascending: false })
            .limit(500);
          return (data as unknown as OwnerReceiptRow[]) ?? [];
        })()
      : Promise.resolve([] as OwnerReceiptRow[]),
  ]);
  const insightList = contactInsights[activeContactId] ?? [];

  // Preload settings data so switching to the tab does not block on a server navigation.
  let profileExtras: { preferredName: string | null; contactMethod: StoredContactMethod; timezone: string | null } =
    { preferredName: null, contactMethod: null, timezone: null };
  let internalNote: Awaited<ReturnType<typeof fetchInternalNote>> = null;
  let sessions: SessionRow[] = [];
  let connections: ConnectionRow[] = [];
  let workspaceDetail: { id: string; name: string; type: string | null; ein: string | null; notes: string | null } | null = null;

  if (workspaceData) {
    const supabase = await createClient();
    const profileId = workspaceData.primaryMember.id;

    const [{ data: extras }, fetchedNote, { data: rawSessions }, { data: rawConnections }] =
      await Promise.all([
        supabase.from("profiles").select("preferred_name, contact_method, timezone").eq("id", profileId).maybeSingle(),
        fetchInternalNote(profileId),
        supabase.from("session_log").select("id, logged_in_at, device_type, browser, os, city, country").eq("user_id", profileId).order("logged_in_at", { ascending: false }).limit(8),
        supabase.from("connections").select("id, provider, external_account_id, status, metadata, connected_at").eq("owner_id", profileId).order("connected_at", { ascending: false }),
      ]);

    const rawContact = extras?.contact_method ?? null;
    profileExtras = {
      preferredName: extras?.preferred_name ?? null,
      contactMethod: rawContact && (CONTACT_METHODS as readonly string[]).includes(rawContact as (typeof CONTACT_METHODS)[number])
        ? (rawContact as StoredContactMethod)
        : null,
      timezone: extras?.timezone ?? null,
    };
    internalNote = fetchedNote;
    sessions = (rawSessions ?? []).map((r) => ({
      id: r.id,
      loggedInAt: r.logged_in_at,
      deviceType: r.device_type,
      browser: r.browser,
      os: r.os,
      city: r.city,
      country: r.country,
    }));
    connections = (rawConnections ?? []).map((r) => {
      const meta = (r.metadata ?? {}) as Record<string, unknown>;
      const label =
        (meta["listing_title"] as string | undefined) ??
        (meta["calendar_email"] as string | undefined) ??
        r.external_account_id ??
        "";
      return {
        id: r.id,
        provider: r.provider,
        label,
        status: r.status ?? "connected",
        connectedAt: r.connected_at,
      };
    });

    if (workspaceData.workspace) {
      const { data: workspaceRow } = await supabase
        .from("workspaces")
        .select("id, name, type, ein, notes")
        .eq("id", workspaceData.workspace.id)
        .maybeSingle();
      workspaceDetail = workspaceRow ?? null;
    }
  }

  const tabContents: Record<TabKey, React.ReactNode> = {
    home: (
      <WorkspaceOverviewTab
        workspaceContact={workspaceContact}
        workspaceId={workspaceId}
        projects={workspaceProjects}
        documents={workspaceDocuments}
        messages={overviewMessages}
        insights={insightList}
        openTasks={openTasks}
        activityLog={workspaceData?.activity ?? []}
        members={members}
        proxyTeam={proxyTeam}
      />
    ),
    inbox: (
      <MessagingTab
        contactId={activeContactId}
        messages={allWorkspaceMessages}
        inboxConversations={workspaceInboxConversations}
        members={members}
        activeContactId={activeContactId}
        ownerId={workspaceContact.profileId}
      />
    ),
    tasks: <TasksTab parentType="contact" parentId={activeContactId} />,
    meetings: (
      <MeetingsTab
        ownerId={workspaceContact.profileId ?? activeContactId}
        ownerFirstName={workspaceContact.fullName.split(" ")[0] ?? workspaceContact.fullName}
        ownerEmail={workspaceContact.email ?? ""}
        ownerPhone={workspaceContact.phone ?? null}
        meetings={workspaceMeetings}
        properties={workspaceContact.properties.map((p) => ({
          id: p.id,
          label: p.label,
        }))}
        contactId={activeContactId}
        adminProfiles={adminProfiles}
      />
    ),
    documents: workspaceContact.profileId ? (
      <DocumentsTab
        documents={workspaceDocuments}
        spineDocuments={ownerSpineDocuments}
        groupSettings={documentGroupSettings}
        workspaceId={workspaceId}
        members={members}
        owner={{
          profileId: workspaceContact.profileId,
          fullName: workspaceContact.fullName,
          email: workspaceContact.email ?? "",
          phone: workspaceContact.phone ?? null,
        }}
        properties={workspaceContact.properties.map((p) => ({ id: p.id, label: p.label }))}
      />
    ) : (
      <TabPlaceholder
        title="Documents"
        body="Documents are available once the workspace begins onboarding."
      />
    ),
    finances: financeData ? (
      <FinanceTab
        workspaceId={workspaceId}
        finance={financeData}
        contactId={workspaceContact.id}
        ownerEmail={workspaceContact.email}
        ownerId={workspaceContact.profileId}
        ownerName={workspaceContact.fullName}
        ownerPhone={workspaceContact.phone}
        ownerAddress={buildAddressLines(workspaceContact.addressComponents, workspaceContact.addressFormatted)}
        properties={workspaceContact.properties}
        receiptsForExplorer={receiptsForExplorer}
      />
    ) : (
      <TabPlaceholder
        title="Finances"
        body="Finances are not available for this workspace yet."
      />
    ),
    properties: <PropertiesTab properties={workspaceContact.properties} />,
    timeline: (
      <TabPlaceholder
        title="Timeline"
        body="Activity timeline for this workspace."
      />
    ),
    settings: workspaceData ? (
      <SettingsTab
        data={workspaceData}
        activeSection={section}
        profileExtras={profileExtras}
        internalNote={internalNote}
        sessions={sessions}
        connections={connections}
        workspaceDetail={workspaceDetail}
        basePath={`/admin/workspaces/${workspaceId}`}
      />
    ) : (
      <TabPlaceholder
        title="Settings"
        body="Settings are available once the workspace completes onboarding."
      />
    ),
  };

  return (
    <WorkspaceDetailShell
      workspaceContact={workspaceContact}
      adminProfiles={adminProfiles}
      nextMeeting={nextMeeting}
      workspaceInfo={workspaceInfo}
      members={members}
      activeContactId={activeContactId as string}
      initialTab={tab}
      tabContents={tabContents}
    />
  );
}
