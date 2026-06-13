"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowDown,
  ArrowUp,
  Bell,
  Buildings,
  CalendarBlank,
  CaretDown,
  CaretUp,
  CheckCircle,
  Clock,
  Copy,
  DownloadSimple,
  Eye,
  FilePdf,
  FolderSimple,
  LinkSimple,
  Lock,
  PaperPlaneTilt,
  ShieldCheck,
  Trash,
  Warning,
  X,
  XCircle,
} from "@phosphor-icons/react";
import { FileCard, type FormatFileProps } from "@/components/ui/file-card-collections";
import type { WorkspaceDocument } from "@/lib/admin/workspace-documents";
import type { SpineDocument } from "@/lib/documents/spine";
import {
  WORKSPACE_DOCUMENT_DEFINITIONS,
  WORKSPACE_DOCUMENT_ORDER,
  type DocumentLifecycleDefinition,
  type DocumentPreviewKind,
  type WorkspaceDocumentKey,
} from "@/lib/admin/documents-hub-shared";
import {
  buildWorkspaceRequestDraftUrl,
  deliveryButtonLabel,
  type ComposerRecipient,
  type WorkspaceRequestAssignmentScope,
  type WorkspaceRequestCompletionRule,
  type WorkspaceRequestDeliveryChannel,
  type WorkspaceRequestRecipientRole,
} from "@/lib/admin/workspace-requests";
import {
  buildWorkspaceDocumentRequestUrl,
} from "@/lib/admin/workspace-document-request-links";
import {
  sendWorkspaceDocumentAction,
  sendWorkspaceDocumentReminderAction,
  sendWorkspaceDocumentRequestAction,
  toggleGateOverrideAction,
  swapDocumentSortOrderAction,
  moveDocumentToGroupAction,
  swapGroupSortOrderAction,
  waiveDocumentAction,
  setUrgentFlagAction,
  setDocumentDeadlineAction,
  updateAdminNoteAction,
  updateOwnerNoteAction,
  markDocumentCompleteAction,
  unmarkDocumentCompleteAction,
} from "./workspace-document-actions";
import type { WorkspaceMember } from "@/lib/admin/workspace-contact-detail";
import type { DocumentGroupSetting } from "@/lib/admin/document-group-settings";
import { CustomSelect } from "@/components/admin/CustomSelect";
import { DatePickerInput } from "@/components/admin/DatePickerInput";
import styles from "./DocumentsTab.module.css";

/* ─── Re-export type so WorkspaceDocumentDrawer stays importable from this path ─── */
export type WorkspaceDocumentCard = {
  definition: DocumentLifecycleDefinition;
  document: WorkspaceDocument | undefined;
  versions: WorkspaceDocument[];
  state: "needed" | "requested" | "ready" | "expiring" | "expired";
};

/* ─── Types ─── */

type RequirementState = "needed" | "requested" | "ready" | "expiring" | "expired";

type DocumentsTabProps = {
  documents: WorkspaceDocument[];
  spineDocuments: SpineDocument[];
  groupSettings: DocumentGroupSetting[];
  workspaceId: string;
  members: WorkspaceMember[];
  owner: {
    profileId: string;
    fullName: string;
    email: string;
    phone: string | null;
  };
  properties: { id: string; label: string }[];
};

/* ─── Display groups (5 admin-facing sections) ─── */

type DisplayGroup = { key: string; title: string; keys: WorkspaceDocumentKey[] };

const DISPLAY_GROUPS: DisplayGroup[] = [
  {
    key: "owner_package",
    title: "Owner package",
    keys: ["host_rental_agreement", "w9", "identity"],
  },
  {
    key: "payment_setup",
    title: "Payment setup",
    keys: ["paid_onboarding_fee", "ach_authorization", "card_authorization"],
  },
  {
    key: "house_information",
    title: "House information",
    keys: ["property_setup", "wifi_info", "guidebook", "block_dates_calendar"],
  },
  {
    key: "compliance_and_policy",
    title: "Compliance and policy",
    keys: ["str_permit", "hoa_info", "insurance_certificate"],
  },
  {
    key: "access_and_operations",
    title: "Access and operations",
    keys: ["platform_authorization", "onboarding_inspection"],
  },
];

/* ─── Format maps ─── */

const PREVIEW_FORMAT_MAP: Record<DocumentPreviewKind, FormatFileProps> = {
  agreement: "doc",
  bank: "xls",
  card: "pdf",
  tax: "txt",
  id: "img",
  setup: "csv",
  wifi: "json",
  guidebook: "md",
  permit: "pdf",
  hoa: "doc",
  insurance: "pdf",
  platforms: "code",
  inspection: "txt",
  calendar: "xls",
  offboarding: "doc",
};

const PREVIEW_BADGE_MAP: Record<WorkspaceDocumentKey, string> = {
  host_rental_agreement: "Agree",
  card_authorization: "Card",
  ach_authorization: "ACH",
  w9: "W9",
  identity: "ID",
  paid_onboarding_fee: "Fee",
  property_setup: "Form",
  wifi_info: "Info",
  guidebook: "Guide",
  str_permit: "Permit",
  hoa_info: "HOA",
  insurance_certificate: "Policy",
  platform_authorization: "Access",
  onboarding_inspection: "Form",
  block_dates_calendar: "Dates",
  property_offboarding: "Close",
};

/* ─── Status helpers ─── */

const STATE_DOT_COLOR: Record<RequirementState, string> = {
  ready: "#15803d",
  expiring: "#d97706",
  expired: "#dc2626",
  requested: "#0c6fae",
  needed: "var(--color-warm-gray-300)",
};

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getRequirementState(doc: WorkspaceDocument | undefined): RequirementState {
  if (!doc) return "needed";
  if (doc.status === "completed" || doc.status === "signed") return "ready";
  if (doc.status === "expiring") return "expiring";
  if (doc.status === "expired" || doc.status === "declined") return "expired";
  return "requested";
}

function getRequirementLabel(state: RequirementState): string {
  if (state === "requested") return "Requested";
  if (state === "ready") return "Ready";
  if (state === "expiring") return "Expiring";
  if (state === "expired") return "Expired";
  return "Needed";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isExpiringSoon(iso: string): boolean {
  const diff = new Date(iso).getTime() - Date.now();
  return diff > 0 && diff < 60 * 24 * 60 * 60 * 1000;
}

function matchDocument(
  documentKey: WorkspaceDocumentKey,
  documents: WorkspaceDocument[],
): WorkspaceDocument | undefined {
  const definition = WORKSPACE_DOCUMENT_DEFINITIONS[documentKey];
  const names = [
    definition.label,
    definition.shortLabel,
    documentKey,
    documentKey === "w9" ? "W9 Form" : "",
    documentKey === "identity" ? "Identity Verification" : "",
    documentKey === "property_setup" ? "Property Setup Form" : "",
    documentKey === "guidebook" ? "Recommendations for Guidebook" : "",
    documentKey === "block_dates_calendar" ? "Block Dates on the Calendar" : "",
  ].filter(Boolean);
  const normalizedCandidates = names.map(normalizeName);

  return documents.find((doc) => {
    if (doc.documentKey === documentKey) return true;
    const normalizedDoc = normalizeName(doc.templateName);
    return normalizedCandidates.some((candidate) =>
      normalizedDoc.includes(candidate) || candidate.includes(normalizedDoc),
    );
  });
}

function matchVersions(
  documentKey: WorkspaceDocumentKey,
  documents: WorkspaceDocument[],
): WorkspaceDocument[] {
  const current = matchDocument(documentKey, documents);
  if (!current) return [];
  if (current.documentKey) return documents.filter((doc) => doc.documentKey === current.documentKey);
  const normalizedCurrent = normalizeName(current.templateName);
  return documents.filter((doc) => normalizeName(doc.templateName) === normalizedCurrent);
}

/* ─── Journey stepper ─── */

type JourneyKind = "signature" | "form" | "upload";

function journeyKindFor(def: DocumentLifecycleDefinition): JourneyKind {
  if (def.kind === "secure_doc" && def.sendable) return "signature";
  if (def.kind === "upload") return "upload";
  return "form";
}

const JOURNEY_STEPS: Record<JourneyKind, string[]> = {
  signature: ["Sent", "Signed", "Countersigned", "On file"],
  upload: ["Needed", "Submitted", "On file"],
  form: ["Needed", "Submitted", "On file"],
};

function activeStepIndex(kind: JourneyKind, state: RequirementState): number {
  if (kind === "signature") {
    if (state === "needed") return -1;
    if (state === "requested") return 0;
    return 3;
  }
  if (state === "needed") return -1;
  if (state === "requested") return 0;
  return 2;
}

function JourneyStepper({ kind, state }: { kind: JourneyKind; state: RequirementState }) {
  const steps = JOURNEY_STEPS[kind];
  const activeIdx = activeStepIndex(kind, state);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 20 }}>
      {steps.map((label, i) => {
        const completed = i < activeIdx + 1;
        const active = i === activeIdx;
        const isLast = i === steps.length - 1;
        return (
          <div key={label} style={{ display: "flex", alignItems: "center", flex: isLast ? "0 0 auto" : "1 1 auto", minWidth: 0 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{
                width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                backgroundColor: completed || active ? (completed && !active ? "#15803d" : "var(--color-brand)") : "var(--color-warm-gray-200)",
                border: active ? "2px solid var(--color-brand)" : "none",
              }} />
              <span style={{
                fontSize: 10, fontWeight: active ? 600 : 400, whiteSpace: "nowrap",
                color: active ? "var(--color-brand)" : completed ? "#15803d" : "var(--color-text-muted)",
              }}>
                {label}
              </span>
            </div>
            {!isLast && (
              <div style={{
                flex: 1, height: 1, marginBottom: 14,
                backgroundColor: i < activeIdx ? "#15803d" : "var(--color-warm-gray-200)",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Request modal helpers ─── */

function ownerFirstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

function buildRequestSubject(cards: WorkspaceDocumentCard[]): string {
  if (cards.length === 1) return `Action needed: ${cards[0]?.definition.label ?? "Proxy request"}`;
  return "Action needed: Proxy setup items";
}

function buildRequestCtaLabel(cards: WorkspaceDocumentCard[]): string {
  if (cards.length === 1) return `Complete ${cards[0]?.definition.label ?? "request"}`;
  return "Open requested items";
}

function buildRequestMessage(args: { ownerName: string; cards: WorkspaceDocumentCard[] }): string {
  const firstName = ownerFirstName(args.ownerName);
  const singleLabel = args.cards[0]?.definition.label;
  const requestLine = args.cards.length === 1 && singleLabel
    ? `Please complete the ${singleLabel} when you have a moment.`
    : "Please complete the requested setup items when you have a moment.";
  return [`Hi ${firstName},`, "", requestLine, "", "Thank you."].join("\n");
}

function buildTrustNote(): string {
  return "We will never ask you to email sensitive documents directly. Use the secure Proxy portal so everything stays connected to your workspace.";
}

function htmlFromPlainText(value: string): string {
  return value
    .split("\n")
    .map((line) => line.trim())
    .map((line) => line ? `<p>${escapeHtml(line)}</p>` : "<br />")
    .join("");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function roleLabel(role: WorkspaceRequestRecipientRole): string {
  if (role === "cc") return "CC";
  if (role === "notify_only") return "Notify";
  return "To";
}

function nextRole(role: WorkspaceRequestRecipientRole): WorkspaceRequestRecipientRole {
  if (role === "to") return "cc";
  if (role === "cc") return "notify_only";
  return "to";
}

function buildDefaultRecipients(
  members: WorkspaceMember[],
  owner: DocumentsTabProps["owner"],
): ComposerRecipient[] {
  const source = members.length > 0
    ? members.map((member) => ({
        contactId: member.id,
        profileId: member.profileId,
        fullName: member.fullName,
        email: member.email,
        phone: member.phone,
      }))
    : [{ contactId: owner.profileId, profileId: owner.profileId, fullName: owner.fullName, email: owner.email, phone: owner.phone }];

  return source.map((member, index) => ({
    contactId: member.contactId,
    profileId: member.profileId,
    fullName: member.fullName,
    email: member.email,
    phone: member.phone,
    role: index === 0 ? "to" : "cc",
    channels: member.email ? ["email"] : [],
  }));
}

function hasSendableDelivery(recipient: ComposerRecipient): boolean {
  if (recipient.role === "notify_only") return false;
  return (
    (recipient.channels.includes("email") && Boolean(recipient.email)) ||
    (recipient.channels.includes("sms") && Boolean(recipient.phone))
  );
}

/* ─── RequestDocumentModal ─── */

type RequestModalProps = {
  cards: WorkspaceDocumentCard[];
  members: WorkspaceMember[];
  owner: DocumentsTabProps["owner"];
  origin: string;
  workspaceId: string;
  pending: boolean;
  onClose: () => void;
  onSend: (args: {
    assignmentScope: WorkspaceRequestAssignmentScope;
    completionRule: WorkspaceRequestCompletionRule;
    recipients: ComposerRecipient[];
    selectedCards: WorkspaceDocumentCard[];
    subject: string;
    message: string;
    ctaLabel: string;
    ctaUrlOrigin: string;
    trustNote: string;
  }) => void;
  onCopy: (value: string, successMessage: string) => void;
};

function RequestDocumentModal({
  cards,
  members,
  owner,
  origin,
  workspaceId,
  pending,
  onClose,
  onSend,
  onCopy,
}: RequestModalProps) {
  const eligibleCards = cards.filter((card) => card.definition.sendable || card.definition.requestable);
  const [selectedKeys, setSelectedKeys] = useState<WorkspaceDocumentKey[]>(
    eligibleCards.map((card) => card.definition.key),
  );
  const selectedCards = cards.filter((card) => selectedKeys.includes(card.definition.key));
  const portalUrl = buildWorkspaceRequestDraftUrl(origin, workspaceId);
  const [recipients, setRecipients] = useState<ComposerRecipient[]>(() =>
    buildDefaultRecipients(members, owner),
  );
  const [assignmentScope, setAssignmentScope] = useState<WorkspaceRequestAssignmentScope>("workspace");
  const [completionRule, setCompletionRule] = useState<WorkspaceRequestCompletionRule>("any_assignee");
  const [subject, setSubject] = useState(() => buildRequestSubject(selectedCards));
  const [ctaLabel, setCtaLabel] = useState(() => buildRequestCtaLabel(selectedCards));
  const [trustNote, setTrustNote] = useState(() => buildTrustNote());
  const [message, setMessage] = useState(() =>
    buildRequestMessage({ ownerName: owner.fullName, cards: selectedCards }),
  );

  useEffect(() => {
    setSubject(buildRequestSubject(selectedCards));
    setCtaLabel(buildRequestCtaLabel(selectedCards));
    setMessage(buildRequestMessage({ ownerName: owner.fullName, cards: selectedCards }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner.fullName, selectedKeys.join("|")]);

  useEffect(() => {
    setRecipients(buildDefaultRecipients(members, owner));
  }, [members, owner]);

  const directLinks = selectedCards
    .map((card) => buildWorkspaceDocumentRequestUrl(origin, card.definition.key))
    .filter((url): url is string => Boolean(url));
  const sendableRecipients = recipients.filter(hasSendableDelivery);
  const canSend =
    selectedCards.length > 0 &&
    sendableRecipients.length > 0 &&
    subject.trim().length > 0 &&
    message.trim().length > 0 &&
    ctaLabel.trim().length > 0 &&
    trustNote.trim().length > 0;

  function toggleCard(documentKey: WorkspaceDocumentKey) {
    setSelectedKeys((current) =>
      current.includes(documentKey)
        ? current.filter((key) => key !== documentKey)
        : [...current, documentKey],
    );
  }

  function toggleRecipientChannel(contactId: string, channel: WorkspaceRequestDeliveryChannel) {
    setRecipients((current) =>
      current.map((recipient) => {
        if (recipient.contactId !== contactId) return recipient;
        const hasChannel = recipient.channels.includes(channel);
        return {
          ...recipient,
          channels: hasChannel
            ? recipient.channels.filter((item) => item !== channel)
            : [...recipient.channels, channel],
        };
      }),
    );
  }

  function rotateRecipientRole(contactId: string) {
    setRecipients((current) =>
      current.map((recipient) => {
        if (recipient.contactId !== contactId) return recipient;
        const role = nextRole(recipient.role);
        return { ...recipient, role, channels: role === "notify_only" ? [] : recipient.channels };
      }),
    );
  }

  function selectedButtonClass(active: boolean): string {
    return active ? `${styles.segmentButton} ${styles.segmentButtonActive}` : styles.segmentButton;
  }

  return (
    <div className={styles.modalLayer}>
      <button className={styles.modalBackdrop} onClick={onClose} type="button" />
      <div className={styles.requestModal} role="dialog" aria-modal="true" aria-labelledby="request-documents-title">
        <div className={styles.modalHeader}>
          <div>
            <h3 id="request-documents-title" className={styles.modalTitle}>Request package</h3>
            <p className={styles.modalSubtitle}>
              Send one Proxy portal link, choose who receives it, and keep direct item links available for a specific nudge.
            </p>
          </div>
          <button className={styles.iconButton} onClick={onClose} type="button" aria-label="Close request modal">
            <X size={16} />
          </button>
        </div>

        <section className={styles.requestChecklistCard}>
          <div>
            <span>Owner workspace</span>
            <strong>One workspace request link</strong>
            <p>
              The default is one portal link for every requested item. Direct links stay available
              for the rare single-document follow-up.
            </p>
          </div>
          <button
            className={styles.secondaryButton}
            onClick={() => onCopy(portalUrl, "Workspace request link copied.")}
            type="button"
          >
            <LinkSimple size={14} weight="bold" />
            Copy portal link
          </button>
        </section>

        <div className={styles.requestModalGrid}>
          <section className={styles.requestPanel}>
            <h4 className={styles.drawerSectionTitle}>Assignment</h4>
            <div className={styles.segmentedGroup} aria-label="Assignment scope">
              <button className={selectedButtonClass(assignmentScope === "workspace")} onClick={() => setAssignmentScope("workspace")} type="button">Workspace</button>
              <button className={selectedButtonClass(assignmentScope === "person")} onClick={() => setAssignmentScope("person")} type="button">Person</button>
              <button className={selectedButtonClass(assignmentScope === "multiple_people")} onClick={() => setAssignmentScope("multiple_people")} type="button">Multiple</button>
            </div>

            <div className={styles.segmentedGroup} aria-label="Completion rule">
              <button className={selectedButtonClass(completionRule === "any_assignee")} onClick={() => setCompletionRule("any_assignee")} type="button">Anyone can complete</button>
              <button className={selectedButtonClass(completionRule === "each_assignee")} onClick={() => setCompletionRule("each_assignee")} type="button">Each person completes</button>
            </div>

            <h4 className={styles.drawerSectionTitle}>Recipients</h4>
            <div className={styles.recipientList}>
              {recipients.map((recipient) => {
                const emailDisabled = !recipient.email || recipient.role === "notify_only";
                const smsDisabled = !recipient.phone || recipient.role === "notify_only";
                return (
                  <div key={recipient.contactId} className={styles.recipientRow}>
                    <div className={styles.recipientIdentity}>
                      <strong>{recipient.fullName}</strong>
                      <span>{recipient.email || "No email"}{recipient.phone ? ` · ${recipient.phone}` : ""}</span>
                    </div>
                    <button className={styles.roleButton} onClick={() => rotateRecipientRole(recipient.contactId)} type="button">
                      {roleLabel(recipient.role)}
                    </button>
                    <label className={emailDisabled ? styles.channelToggleDisabled : styles.channelToggle}>
                      <input checked={recipient.channels.includes("email")} disabled={emailDisabled} onChange={() => toggleRecipientChannel(recipient.contactId, "email")} type="checkbox" />
                      Email
                    </label>
                    <label className={smsDisabled ? styles.channelToggleDisabled : styles.channelToggle}>
                      <input checked={recipient.channels.includes("sms")} disabled={smsDisabled} onChange={() => toggleRecipientChannel(recipient.contactId, "sms")} type="checkbox" />
                      Text
                    </label>
                  </div>
                );
              })}
            </div>
            <p className={styles.requestDeliveryNote}>
              To sends the main request. CC keeps someone informed. Notify keeps them connected in
              the request record without sending this message.
            </p>

            <h4 className={styles.drawerSectionTitle}>Items</h4>
            <div className={styles.requestList}>
              {cards.map((card) => {
                const url = buildWorkspaceDocumentRequestUrl(origin, card.definition.key);
                const enabled = card.definition.sendable || card.definition.requestable;
                const checked = selectedKeys.includes(card.definition.key);
                return (
                  <label key={card.definition.key} className={`${styles.requestOption} ${!enabled ? styles.requestOptionDisabled : ""}`}>
                    <input checked={checked} disabled={!enabled} onChange={() => toggleCard(card.definition.key)} type="checkbox" />
                    <span>
                      <strong>{card.definition.label}</strong>
                      <small>
                        {card.definition.sendable ? "Official document request" : url ? url.replace(origin, "") : "Workspace checklist item"}
                      </small>
                    </span>
                  </label>
                );
              })}
            </div>
          </section>

          <section className={styles.requestPanel}>
            <h4 className={styles.drawerSectionTitle}>Email</h4>
            <label className={styles.requestField}>
              <span>Subject</span>
              <input className={styles.requestInput} value={subject} onChange={(e) => setSubject(e.target.value)} type="text" />
            </label>
            <label className={styles.requestField}>
              <span>Message</span>
              <textarea className={styles.requestTextarea} value={message} onChange={(e) => setMessage(e.target.value)} rows={7} />
            </label>
            <label className={styles.requestField}>
              <span>Button text</span>
              <input className={styles.requestInput} value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} type="text" />
            </label>
            <label className={styles.requestField}>
              <span>Trust note</span>
              <textarea className={styles.requestTextareaSmall} value={trustNote} onChange={(e) => setTrustNote(e.target.value)} rows={3} />
            </label>
            <textarea
              className={styles.requestPreview}
              value={`Button: ${ctaLabel}\nLink: ${portalUrl}\nFooter: Sent by Proxy. If something looks off, reply to this email and we will help.`}
              readOnly
              rows={3}
            />
            {directLinks.length > 0 ? (
              <details className={styles.directLinks}>
                <summary>Direct item links</summary>
                <div>
                  {selectedCards.map((card) => {
                    const url = buildWorkspaceDocumentRequestUrl(origin, card.definition.key);
                    if (!url) return null;
                    return (
                      <button
                        key={card.definition.key}
                        className={styles.directLinkButton}
                        onClick={() => onCopy(url, `${card.definition.label} link copied.`)}
                        type="button"
                      >
                        <span>{card.definition.label}</span>
                        <LinkSimple size={13} weight="bold" />
                      </button>
                    );
                  })}
                </div>
              </details>
            ) : null}
          </section>
        </div>

        <div className={styles.requestActions}>
          <button
            className={styles.primaryButton}
            disabled={!canSend || pending}
            onClick={() => onSend({ assignmentScope, completionRule, recipients, selectedCards, subject, message, ctaLabel, ctaUrlOrigin: origin, trustNote })}
            type="button"
          >
            <PaperPlaneTilt size={14} weight="bold" />
            {deliveryButtonLabel(sendableRecipients)}
          </button>
          <button
            className={styles.secondaryButton}
            disabled={!message.trim()}
            onClick={() => onCopy(`${message}\n\n${ctaLabel}: ${portalUrl}\n\n${trustNote}`, "Request message copied.")}
            type="button"
          >
            <Copy size={14} weight="bold" />
            Copy message
          </button>
          <button
            className={styles.secondaryButton}
            onClick={() => onCopy(portalUrl, "Workspace request link copied.")}
            type="button"
          >
            <LinkSimple size={14} weight="bold" />
            Copy portal
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main DocumentsTab component ─── */

export function DocumentsTab({ documents, spineDocuments, groupSettings, workspaceId, members, owner, properties }: DocumentsTabProps) {
  const [selectedKey, setSelectedKey] = useState<WorkspaceDocumentKey | null>(null);
  const [requestCards, setRequestCards] = useState<WorkspaceDocumentCard[] | null>(null);
  const [origin, setOrigin] = useState("https://www.myproxyhost.com");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [adminNoteValue, setAdminNoteValue] = useState("");
  const [ownerNoteValue, setOwnerNoteValue] = useState("");
  const [completionNote, setCompletionNote] = useState("");
  const [showViewer, setShowViewer] = useState(false);
  const [activePropertyFilter, setActivePropertyFilter] = useState<string | null>(null);
  const [optimisticSortOrders, setOptimisticSortOrders] = useState<Map<string, number>>(new Map());
  const [optimisticGroupOrderOverride, setOptimisticGroupOrderOverride] = useState<string[] | null>(null);

  useEffect(() => { setOrigin(window.location.origin); }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const t = window.setTimeout(() => setToastMessage(null), 5000);
    return () => window.clearTimeout(t);
  }, [toastMessage]);

  // Resolved group order — uses optimistic override during drag, then persisted DB order
  const resolvedGroupOrder = useMemo<DisplayGroup[]>(() => {
    if (optimisticGroupOrderOverride) {
      return optimisticGroupOrderOverride
        .map((k) => DISPLAY_GROUPS.find((g) => g.key === k))
        .filter((g): g is DisplayGroup => g !== undefined);
    }
    if (!groupSettings.length) return DISPLAY_GROUPS;
    const orderMap = new Map(groupSettings.map((s) => [s.groupKey, s.sortOrder]));
    return [...DISPLAY_GROUPS].sort((a, b) => {
      const aOrder = orderMap.get(a.key) ?? DISPLAY_GROUPS.findIndex((g) => g.key === a.key);
      const bOrder = orderMap.get(b.key) ?? DISPLAY_GROUPS.findIndex((g) => g.key === b.key);
      return aOrder - bOrder;
    });
  }, [groupSettings, optimisticGroupOrderOverride]);

  // Per-document group resolver: spine displayGroup override > DISPLAY_GROUPS default.
  // Memoized so it stays referentially stable across renders (it depends only on
  // the module-level DISPLAY_GROUPS constant), keeping the cards useMemo below
  // from recomputing every render.
  const resolveGroupKey = useCallback(
    (docKey: WorkspaceDocumentKey, spine: SpineDocument | undefined): string => {
      if (spine?.displayGroup) return spine.displayGroup;
      return DISPLAY_GROUPS.find((g) => (g.keys as readonly string[]).includes(docKey))?.key ?? "house_information";
    },
    [],
  );

  // Build merged card list
  const cards = useMemo<WorkspaceDocumentCard[]>(() => {
    return WORKSPACE_DOCUMENT_ORDER
      .map((key) => WORKSPACE_DOCUMENT_DEFINITIONS[key])
      .filter((def) => def.visibility === "always")
      .map((def) => {
        const document = matchDocument(def.key, documents);
        const versions = matchVersions(def.key, documents);
        return { definition: def, document, versions, state: getRequirementState(document) };
      });
  }, [documents]);

  // Property tabs — only shown when the workspace has multiple properties
  const propertyTabs = useMemo(() => {
    if (properties.length <= 1) return [];
    return [
      { id: "all", label: "All" },
      ...properties.map((p) => ({
        id: p.id,
        label: p.label,
        shortLabel: (p.label.split(",")[0] ?? p.label).trim(),
      })),
    ];
  }, [properties]);

  // Spine lookup by documentKey — respects property filter
  const spineByKey = useMemo(() => {
    const map = new Map<WorkspaceDocumentKey, SpineDocument>();
    for (const s of spineDocuments) {
      if (!s.documentKey) continue;
      const key = s.documentKey as WorkspaceDocumentKey;
      if (activePropertyFilter === null) {
        // "All" mode: prefer owner-level (null propertyId)
        if (!map.has(key) || s.propertyId === null) map.set(key, s);
      } else {
        // Specific property: prefer exact match, fall back to owner-level
        if (!map.has(key)) {
          map.set(key, s);
        } else if (s.propertyId === activePropertyFilter) {
          map.set(key, s);
        }
      }
    }
    return map;
  }, [spineDocuments, activePropertyFilter]);

  // Compute which gate steps are satisfied for "locked for owner" indicator
  const satisfiedGateGroups = useMemo(() => {
    const set = new Set<string>();
    const agreementDocs = spineDocuments.filter((d) => d.gateGroup === "agreement");
    if (agreementDocs.length === 0 || agreementDocs.every((d) => d.status === "on_file")) set.add("agreement");
    if (spineDocuments.filter((d) => d.gateGroup === "payment").every((d) => d.status === "on_file" && spineDocuments.filter((d2) => d2.gateGroup === "payment").length > 0)) set.add("payment");
    const banking = spineDocuments.filter((d) => d.gateGroup === "banking");
    if (banking.length > 0 && banking.every((d) => d.status === "on_file") && set.has("payment")) set.add("banking");
    return set;
  }, [spineDocuments]);

  function isLockedForOwner(key: WorkspaceDocumentKey): boolean {
    const spine = spineByKey.get(key);
    if (!spine) return false;
    if (spine.adminGateOverride) return false;
    const group = spine.gateGroup;
    if (!group || group === "agreement" || group === "rest") return false;
    if (group === "payment") return !satisfiedGateGroups.has("agreement");
    if (group === "banking") return !satisfiedGateGroups.has("agreement") || !satisfiedGateGroups.has("payment");
    return false;
  }

  // Sorted group cards — uses resolved group order, per-doc group overrides, and optimistic sort orders
  const groupedCards = useMemo(() => {
    return resolvedGroupOrder.map((group) => {
      const groupCards = cards
        .filter((c) => {
          const spine = spineByKey.get(c.definition.key);
          return resolveGroupKey(c.definition.key, spine) === group.key;
        })
        .map((card) => {
          const spine = spineByKey.get(card.definition.key);
          const effectiveOrder = spine && optimisticSortOrders.has(spine.id)
            ? optimisticSortOrders.get(spine.id)!
            : (spine?.displaySortOrder ?? 0);
          return { card, sortOrder: effectiveOrder };
        })
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item) => item.card);
      return { ...group, cards: groupCards };
    });
  }, [cards, spineByKey, resolvedGroupOrder, resolveGroupKey, optimisticSortOrders]);

  // Auto-select first needed card on mount
  useEffect(() => {
    if (selectedKey) return;
    for (const group of groupedCards) {
      const first = group.cards.find((c) => c.state === "needed" || c.state === "requested");
      if (first) { setSelectedKey(first.definition.key); return; }
    }
    if (groupedCards[0]?.cards[0]) setSelectedKey(groupedCards[0].cards[0].definition.key);
  }, [groupedCards, selectedKey]);

  const selectedCard = selectedKey ? cards.find((c) => c.definition.key === selectedKey) ?? null : null;
  const selectedSpine = selectedKey ? spineByKey.get(selectedKey) ?? null : null;

  // Sync note textareas and close viewer when selected doc changes.
  useEffect(() => {
    const spine = selectedKey ? spineByKey.get(selectedKey) ?? null : null;
    setAdminNoteValue(spine?.adminNote ?? "");
    setOwnerNoteValue(spine?.ownerNote ?? "");
    setCompletionNote("");
    setShowViewer(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);

  const readyCount = cards.filter((c) => c.state === "ready").length;
  const sendableNeeded = cards.filter((c) => c.state === "needed" && c.definition.sendable);
  const requestableNeeded = cards.filter((c) => c.state === "needed" && c.definition.requestable);

  function openRequestModal(cardsToRequest: WorkspaceDocumentCard[]) {
    setToastMessage(null);
    setRequestCards(cardsToRequest);
  }

  function sendOne(card: WorkspaceDocumentCard) {
    setToastMessage(null);
    startTransition(async () => {
      const result = await sendWorkspaceDocumentAction({ workspaceId, profileId: owner.profileId, email: owner.email, fullName: owner.fullName, documentKey: card.definition.key });
      setToastMessage(result.ok ? `${card.definition.label} sent.` : result.error ?? "Could not send document.");
    });
  }

  function sendReminder(card: WorkspaceDocumentCard) {
    if (!card.document?.id || !card.document.boldsignDocumentId) { openRequestModal([card]); return; }
    setToastMessage(null);
    startTransition(async () => {
      const result = await sendWorkspaceDocumentReminderAction({ workspaceId, documentId: card.document?.id ?? "", boldsignDocumentId: card.document?.boldsignDocumentId ?? "", email: owner.email });
      setToastMessage(result.ok ? `${card.definition.label} reminder sent.` : result.error ?? "Could not send reminder.");
    });
  }

  function sendRequest(args: {
    assignmentScope: WorkspaceRequestAssignmentScope;
    completionRule: WorkspaceRequestCompletionRule;
    recipients: ComposerRecipient[];
    selectedCards: WorkspaceDocumentCard[];
    subject: string;
    message: string;
    ctaLabel: string;
    ctaUrlOrigin: string;
    trustNote: string;
  }) {
    setToastMessage(null);
    startTransition(async () => {
      const result = await sendWorkspaceDocumentRequestAction({
        workspaceId, profileId: owner.profileId,
        assignmentScope: args.assignmentScope, completionRule: args.completionRule,
        recipients: args.recipients, subject: args.subject,
        body: htmlFromPlainText(args.message), ctaLabel: args.ctaLabel,
        ctaUrlOrigin: args.ctaUrlOrigin, trustNote: args.trustNote,
        documentKeys: args.selectedCards.map((c) => c.definition.key),
      });
      if (!result.ok) { setToastMessage(result.error ?? "Request could not be sent."); return; }
      setRequestCards(null);
      const sent = result.sent ?? args.selectedCards.length;
      setToastMessage(sent === 1 ? "Request sent." : `${sent} requests sent.`);
    });
  }

  function copyRequestValue(value: string, successMessage: string) {
    navigator.clipboard.writeText(value)
      .then(() => setToastMessage(successMessage))
      .catch(() => setToastMessage("Could not copy to clipboard."));
  }

  function toggleOverride(spineId: string, current: boolean) {
    startTransition(async () => {
      const result = await toggleGateOverrideAction({ documentId: spineId, override: !current, workspaceId });
      if (!result.ok) setToastMessage(result.error ?? "Could not update gate override.");
    });
  }

  function reorder(key: WorkspaceDocumentKey, direction: "up" | "down", groupCards: WorkspaceDocumentCard[]) {
    const sorted = groupCards
      .map((c) => {
        const spine = spineByKey.get(c.definition.key);
        const order = spine && optimisticSortOrders.has(spine.id)
          ? optimisticSortOrders.get(spine.id)!
          : (spine?.displaySortOrder ?? 0);
        return { key: c.definition.key, sortOrder: order, id: spine?.id };
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((c) => c.key === key);
    const adjacentIdx = direction === "up" ? idx - 1 : idx + 1;
    const adjacentItem = sorted[adjacentIdx];
    const currentItem = sorted[idx];
    if (!adjacentItem || !currentItem?.id || !adjacentItem.id) return;

    // Optimistic: swap sort orders immediately
    setOptimisticSortOrders((prev) => {
      const next = new Map(prev);
      next.set(currentItem.id!, adjacentItem.sortOrder);
      next.set(adjacentItem.id!, currentItem.sortOrder);
      return next;
    });

    startTransition(async () => {
      const result = await swapDocumentSortOrderAction({ documentIdA: currentItem.id!, documentIdB: adjacentItem.id!, workspaceId });
      if (!result.ok) {
        setOptimisticSortOrders((prev) => {
          const reverted = new Map(prev);
          reverted.delete(currentItem.id!);
          reverted.delete(adjacentItem.id!);
          return reverted;
        });
        setToastMessage(result.error ?? "Could not reorder documents.");
      } else {
        setOptimisticSortOrders((prev) => {
          const cleaned = new Map(prev);
          cleaned.delete(currentItem.id!);
          cleaned.delete(adjacentItem.id!);
          return cleaned;
        });
      }
    });
  }

  function reorderGroup(groupKey: string, direction: "up" | "down") {
    const idx = resolvedGroupOrder.findIndex((g) => g.key === groupKey);
    const adjacentIdx = direction === "up" ? idx - 1 : idx + 1;
    const adjacent = resolvedGroupOrder[adjacentIdx];
    if (!adjacent) return;

    // Optimistic: swap immediately in UI
    const newOrder = resolvedGroupOrder.map((g) => g.key);
    [newOrder[idx], newOrder[adjacentIdx]] = [newOrder[adjacentIdx]!, newOrder[idx]!];
    setOptimisticGroupOrderOverride(newOrder);

    startTransition(async () => {
      const result = await swapGroupSortOrderAction({ profileId: owner.profileId, groupKeyA: groupKey, groupKeyB: adjacent.key, workspaceId });
      if (!result.ok) {
        setOptimisticGroupOrderOverride(null);
        setToastMessage(result.error ?? "Could not reorder sections.");
      } else {
        setOptimisticGroupOrderOverride(null);
      }
    });
  }

  function moveToGroup(spineId: string, groupKey: string) {
    startTransition(async () => {
      const result = await moveDocumentToGroupAction({ documentId: spineId, groupKey, workspaceId });
      if (!result.ok) setToastMessage(result.error ?? "Could not move document.");
    });
  }

  function toggleWaived(spineId: string, current: boolean) {
    startTransition(async () => {
      const result = await waiveDocumentAction({ documentId: spineId, waived: !current, workspaceId });
      if (!result.ok) setToastMessage(result.error ?? "Could not update waived status.");
    });
  }

  function toggleUrgent(spineId: string, current: boolean) {
    startTransition(async () => {
      const result = await setUrgentFlagAction({ documentId: spineId, urgent: !current, workspaceId });
      if (!result.ok) setToastMessage(result.error ?? "Could not update urgent flag.");
    });
  }

  function updateDeadline(spineId: string, dueDate: string) {
    startTransition(async () => {
      const result = await setDocumentDeadlineAction({ documentId: spineId, dueDate: dueDate || null, workspaceId });
      if (!result.ok) setToastMessage(result.error ?? "Could not set deadline.");
    });
  }

  function saveAdminNote(spineId: string) {
    startTransition(async () => {
      const result = await updateAdminNoteAction({ documentId: spineId, note: adminNoteValue, workspaceId });
      if (!result.ok) setToastMessage(result.error ?? "Could not save admin note.");
    });
  }

  function saveOwnerNote(spineId: string) {
    startTransition(async () => {
      const result = await updateOwnerNoteAction({ documentId: spineId, note: ownerNoteValue, workspaceId });
      if (!result.ok) setToastMessage(result.error ?? "Could not save owner note.");
    });
  }

  function markComplete(spineId: string) {
    if (completionNote.trim().length < 10) return;
    startTransition(async () => {
      const result = await markDocumentCompleteAction({ documentId: spineId, note: completionNote, workspaceId });
      if (result.ok) setToastMessage("Marked as complete.");
      else setToastMessage(result.error ?? "Could not mark complete.");
    });
  }

  function unmarkComplete(spineId: string) {
    startTransition(async () => {
      const result = await unmarkDocumentCompleteAction({ documentId: spineId, workspaceId });
      if (!result.ok) setToastMessage(result.error ?? "Could not undo completion.");
    });
  }

  const messageIsError = toastMessage ? /could not|failed|missing|unavailable/i.test(toastMessage) : false;

  const hasViewer = !!(selectedCard?.document?.signedPdfUrl ?? selectedCard?.state === "requested");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Toast */}
      {toastMessage ? (
        <div className={styles.toastViewport} aria-live="polite" aria-atomic="true">
          <div className={`${styles.toast} ${messageIsError ? styles.toastError : ""}`} role="status">
            {messageIsError ? <XCircle size={16} weight="duotone" /> : <CheckCircle size={16} weight="duotone" />}
            <span>{toastMessage}</span>
            <button aria-label="Dismiss" className={styles.toastDismiss} onClick={() => setToastMessage(null)} type="button">
              <X size={13} weight="bold" />
            </button>
          </div>
        </div>
      ) : null}

      {/* Three-panel layout */}
      <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
        {/* Left nav (240px) */}
        <div style={{ width: 240, flexShrink: 0, display: "flex", flexDirection: "column", borderRight: "1px solid var(--color-warm-gray-200)", backgroundColor: "var(--color-white)", overflow: "hidden" }}>
          {/* Property filter tabs */}
          {propertyTabs.length > 0 && (
            <div className={styles.propertyTabs}>
              {propertyTabs.map((tab) => {
                const isActive = tab.id === "all" ? activePropertyFilter === null : activePropertyFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActivePropertyFilter(tab.id === "all" ? null : tab.id)}
                    type="button"
                    className={isActive ? styles.propertyTabActive : styles.propertyTab}
                  >
                    {"shortLabel" in tab ? tab.shortLabel : tab.label}
                  </button>
                );
              })}
            </div>
          )}
          {/* Progress header */}
          <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid var(--color-warm-gray-100)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Documents
              </span>
              <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                {readyCount}/{cards.length} ready
              </span>
            </div>
            <div style={{ height: 4, borderRadius: 2, backgroundColor: "var(--color-warm-gray-100)", overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 2,
                backgroundColor: "var(--color-brand)",
                width: `${cards.length > 0 ? Math.round((readyCount / cards.length) * 100) : 0}%`,
                transition: "width 0.3s ease",
              }} />
            </div>
          </div>

          {/* Group nav */}
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
            {groupedCards.map((group, groupIdx) => {
              const doneInGroup = group.cards.filter((c) => c.state === "ready").length;
              const totalInGroup = group.cards.length;
              const groupPct = totalInGroup > 0 ? Math.round((doneInGroup / totalInGroup) * 100) : 0;
              const isFirstGroup = groupIdx === 0;
              const isLastGroup = groupIdx === resolvedGroupOrder.length - 1;

              return (
                <div key={group.key}>
                  <div className={styles.navGroupHeader}>
                    <span className={styles.navGroupTitle}>{group.title}</span>
                    <span className={styles.navGroupCount}>{doneInGroup}/{totalInGroup}</span>
                    <div className={styles.navGroupReorderBtns}>
                      <button
                        className={styles.navGroupReorderBtn}
                        disabled={isFirstGroup || pending}
                        onClick={() => reorderGroup(group.key, "up")}
                        type="button"
                        aria-label={`Move ${group.title} up`}
                      >
                        <CaretUp size={10} weight="bold" />
                      </button>
                      <button
                        className={styles.navGroupReorderBtn}
                        disabled={isLastGroup || pending}
                        onClick={() => reorderGroup(group.key, "down")}
                        type="button"
                        aria-label={`Move ${group.title} down`}
                      >
                        <CaretDown size={10} weight="bold" />
                      </button>
                    </div>
                  </div>
                  <div className={styles.navGroupProgressWrap}>
                    <div className={styles.navGroupProgressFill} style={{ width: `${groupPct}%` }} />
                  </div>
                  {group.cards.map((card) => {
                    const isSelected = selectedKey === card.definition.key;
                    const lockedForOwner = isLockedForOwner(card.definition.key);
                    const spine = spineByKey.get(card.definition.key);
                    const isWaived = spine?.waived ?? false;
                    const isUrgentDoc = spine?.isUrgent ?? false;
                    const dotColor = isWaived ? "var(--color-warm-gray-300)" : STATE_DOT_COLOR[card.state];

                    return (
                      <button
                        key={card.definition.key}
                        onClick={() => setSelectedKey(card.definition.key)}
                        type="button"
                        style={{
                          display: "flex", alignItems: "center", gap: 8,
                          width: "100%", padding: "6px 16px 6px 14px",
                          textAlign: "left", background: "none", border: "none", cursor: "pointer",
                          backgroundColor: isSelected ? "var(--color-warm-gray-100)" : "transparent",
                          borderLeft: isSelected ? "2px solid var(--color-brand)" : "2px solid transparent",
                          transition: "background-color 0.1s ease",
                          opacity: isWaived ? 0.5 : 1,
                        }}
                      >
                        {/* Status dot with outer ring for non-gray states */}
                        <div style={{ position: "relative", width: 13, height: 13, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {!isWaived && card.state !== "needed" && (
                            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", backgroundColor: dotColor, opacity: 0.22 }} />
                          )}
                          <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: dotColor }} />
                        </div>
                        <span style={{
                          flex: 1, minWidth: 0, fontSize: 13, fontWeight: isSelected ? 500 : 400,
                          color: isSelected ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          textDecoration: isWaived ? "line-through" : undefined,
                        }}>
                          {card.definition.label}
                        </span>
                        {isUrgentDoc && !isWaived && (
                          <Warning size={11} weight="fill" style={{ color: "#d97706", flexShrink: 0 }} />
                        )}
                        {!isWaived && lockedForOwner && (
                          <Lock size={11} style={{ color: "var(--color-text-tertiary)", flexShrink: 0 }} />
                        )}
                        {!isWaived && card.state === "ready" && !lockedForOwner && (
                          <CheckCircle size={12} weight="fill" style={{ color: "#15803d", flexShrink: 0 }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Request all needed button */}
          <div style={{ padding: "10px 12px", borderTop: "1px solid var(--color-warm-gray-100)", flexShrink: 0 }}>
            <button
              className={styles.primaryButton}
              onClick={() => openRequestModal([...sendableNeeded, ...requestableNeeded])}
              disabled={sendableNeeded.length + requestableNeeded.length === 0 || pending}
              type="button"
              style={{ width: "100%", justifyContent: "center", fontSize: 12 }}
            >
              <PaperPlaneTilt size={13} weight="bold" />
              Request all needed
            </button>
          </div>
        </div>

        {/* Center panel (flex-1): document info + viewer */}
        <div style={{ flex: 1, minWidth: 0, overflowY: "auto", backgroundColor: "var(--color-warm-gray-50)", position: "relative" }}>
          <AnimatePresence mode="wait">
            {selectedCard ? (
              <motion.div
                key={selectedCard.definition.key}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                style={{ padding: "28px 32px", maxWidth: 720 }}
              >
                {/* Header */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 20 }}>
                  <div style={{ flexShrink: 0, filter: `drop-shadow(0 6px 14px ${selectedCard.definition.color ?? "var(--color-brand)"}33)` }}>
                    <FileCard
                      formatFile={PREVIEW_FORMAT_MAP[selectedCard.definition.preview]}
                      badgeLabel={PREVIEW_BADGE_MAP[selectedCard.definition.key]}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h2 style={{
                      margin: "0 0 6px", fontSize: 18, fontWeight: 700,
                      color: "var(--color-text-primary)", lineHeight: 1.2,
                    }}>
                      {selectedCard.definition.label}
                    </h2>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "3px 9px", borderRadius: 99, fontSize: 11, fontWeight: 600,
                        ...(selectedCard.state === "ready"
                          ? { backgroundColor: "#dcfce7", color: "#15803d" }
                          : selectedCard.state === "requested"
                          ? { backgroundColor: "#dbeafe", color: "#1d4ed8" }
                          : selectedCard.state === "expiring" || selectedCard.state === "expired"
                          ? { backgroundColor: "#fef3c7", color: "#92400e" }
                          : { backgroundColor: "var(--color-warm-gray-100)", color: "var(--color-text-muted)" }),
                      }}>
                        {selectedCard.state === "ready" && <CheckCircle size={11} weight="fill" />}
                        {selectedCard.state === "requested" && <Clock size={11} weight="fill" />}
                        {selectedCard.state === "expiring" && <Warning size={11} weight="fill" />}
                        {getRequirementLabel(selectedCard.state)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Meta row */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, fontSize: 12, color: "var(--color-text-muted)" }}>
                  <span>{selectedCard.document?.propertyLabel ?? "Account-level"}</span>
                  {selectedCard.document?.expiresAt && (
                    <>
                      <span style={{ color: "var(--color-warm-gray-300)" }}>·</span>
                      <span style={{ color: isExpiringSoon(selectedCard.document.expiresAt) ? "#d97706" : undefined, display: "flex", alignItems: "center", gap: 3 }}>
                        {isExpiringSoon(selectedCard.document.expiresAt) && <Warning size={12} weight="fill" />}
                        Expires {formatDate(selectedCard.document.expiresAt)}
                      </span>
                    </>
                  )}
                </div>

                {/* Journey stepper */}
                <JourneyStepper kind={journeyKindFor(selectedCard.definition)} state={selectedCard.state} />

                {/* Description */}
                <p style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.55, marginBottom: 24 }}>
                  {selectedCard.definition.description}
                </p>

                {/* Divider */}
                <div style={{ height: 1, backgroundColor: "var(--color-warm-gray-200)", marginBottom: 20 }} />

                {/* Admin CTA */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
                  {selectedCard.state === "ready" ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <ShieldCheck size={16} weight="fill" style={{ color: "#15803d" }} />
                      <span style={{ fontSize: 13, fontWeight: 500, color: "#15803d" }}>On file</span>
                      {selectedCard.document?.signedAt && (
                        <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                          · Completed {formatDate(selectedCard.document.signedAt)}
                        </span>
                      )}
                      {selectedCard.document?.signedPdfUrl && (
                        <a
                          href={selectedCard.document.signedPdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.secondaryButton}
                          style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12 }}
                        >
                          <DownloadSimple size={13} weight="bold" />
                          Download
                        </a>
                      )}
                    </div>
                  ) : selectedCard.definition.sendable ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      {selectedCard.state === "needed" && (
                        <button
                          className={styles.primaryButton}
                          disabled={pending}
                          onClick={() => sendOne(selectedCard)}
                          type="button"
                          style={{ fontSize: 13 }}
                        >
                          <PaperPlaneTilt size={14} weight="bold" />
                          Send for signature
                        </button>
                      )}
                      {selectedCard.state === "requested" && (
                        <button
                          className={styles.primaryButton}
                          disabled={pending}
                          onClick={() => sendReminder(selectedCard)}
                          type="button"
                          style={{ fontSize: 13 }}
                        >
                          <Bell size={14} weight="bold" />
                          Send reminder
                        </button>
                      )}
                      <button
                        className={styles.secondaryButton}
                        disabled={pending}
                        onClick={() => openRequestModal([selectedCard])}
                        type="button"
                        style={{ fontSize: 13 }}
                      >
                        <LinkSimple size={13} weight="bold" />
                        Request via portal
                      </button>
                    </div>
                  ) : selectedCard.definition.requestable ? (
                    <button
                      className={styles.primaryButton}
                      disabled={pending}
                      onClick={() => openRequestModal([selectedCard])}
                      type="button"
                      style={{ fontSize: 13 }}
                    >
                      <PaperPlaneTilt size={14} weight="bold" />
                      Request from owner
                    </button>
                  ) : null}
                </div>

                {/* View document button */}
                {hasViewer && (
                  <div style={{ marginBottom: 24 }}>
                    <button
                      className={styles.secondaryButton}
                      onClick={() => setShowViewer((v) => !v)}
                      type="button"
                      style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      <Eye size={13} weight="bold" />
                      {showViewer ? "Hide document" : "View document"}
                    </button>
                  </div>
                )}

                {/* Inline document viewer */}
                {showViewer && (
                  <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--color-warm-gray-200)", marginBottom: 24, background: "#fff" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid var(--color-warm-gray-100)" }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)" }}>{selectedCard.definition.label}</span>
                      <button onClick={() => setShowViewer(false)} type="button" className={styles.iconButton} style={{ width: 24, height: 24 }}>
                        <X size={12} weight="bold" />
                      </button>
                    </div>
                    {selectedCard.document?.signedPdfUrl ? (
                      <iframe src={selectedCard.document.signedPdfUrl} width="100%" height="480" style={{ border: "none", display: "block" }} title="Document preview" />
                    ) : (
                      <div style={{ height: 320, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: "var(--color-text-muted)" }}>
                        <FilePdf size={36} style={{ opacity: 0.25 }} />
                        <span style={{ fontSize: 13 }}>No signed document yet</span>
                        <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>The document will appear here once signed.</span>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 320, gap: 10, padding: 32 }}
              >
                <FolderSimple size={48} style={{ color: "var(--color-warm-gray-300)" }} />
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 4 }}>Select a document</div>
                  <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Use the navigator to view details and take action.</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right rail (300px): Admin controls */}
        <div style={{ width: 300, flexShrink: 0, borderLeft: "1px solid var(--color-warm-gray-200)", backgroundColor: "var(--color-white)", overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {selectedSpine ? (
            <div className={styles.adminControls}>
              <div className={styles.adminControlsHeading}>Admin controls</div>
              {(() => {
                const currentGroupKey = resolveGroupKey(selectedCard!.definition.key, selectedSpine);
                const currentGroup = groupedCards.find((g) => g.key === currentGroupKey);
                const sortedGroupCards = currentGroup?.cards ?? [];
                const sortedKeys = sortedGroupCards.map((c) => c.definition.key);
                const idxInGroup = sortedKeys.indexOf(selectedCard!.definition.key);
                return (
                  <>
                    <div className={styles.adminControlRow}>
                      <span className={styles.adminControlLabel}>Section</span>
                      <div className={styles.adminControlBody}>
                        <CustomSelect value={currentGroupKey} onChange={(newKey) => moveToGroup(selectedSpine.id, newKey)} options={DISPLAY_GROUPS.map((g) => ({ value: g.key, label: g.title }))} disabled={pending} />
                      </div>
                    </div>
                    <div className={styles.adminControlRow}>
                      <span className={styles.adminControlLabel}>Position</span>
                      <div className={styles.adminControlBody}>
                        <div className={styles.reorderBtns}>
                          <button onClick={() => reorder(selectedCard!.definition.key, "up", sortedGroupCards)} disabled={idxInGroup === 0 || pending} type="button" className={styles.secondaryButton} style={{ padding: "5px 10px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <ArrowUp size={12} weight="bold" /> Move up
                          </button>
                          <button onClick={() => reorder(selectedCard!.definition.key, "down", sortedGroupCards)} disabled={idxInGroup === sortedKeys.length - 1 || pending} type="button" className={styles.secondaryButton} style={{ padding: "5px 10px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <ArrowDown size={12} weight="bold" /> Move down
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
              <div className={styles.adminControlsDivider} />
              <div className={styles.adminControlRow}>
                <span className={styles.adminControlLabel}>Urgent</span>
                <div className={styles.adminControlBody}>
                  <label className={styles.adminCheckLabel}>
                    <input type="checkbox" checked={selectedSpine.isUrgent} onChange={() => toggleUrgent(selectedSpine.id, selectedSpine.isUrgent)} disabled={pending} />
                    <div>
                      <div className={styles.adminCheckTitle}>Flag as urgent</div>
                      <div className={styles.adminCheckDesc}>Pins to top with amber warning</div>
                    </div>
                  </label>
                </div>
              </div>
              {selectedSpine.gateGroup && selectedSpine.gateGroup !== "agreement" && selectedSpine.gateGroup !== "rest" && (
                <div className={styles.adminControlRow}>
                  <span className={styles.adminControlLabel}>Gate</span>
                  <div className={styles.adminControlBody}>
                    <label className={styles.adminCheckLabel}>
                      <input type="checkbox" checked={selectedSpine.adminGateOverride} onChange={() => toggleOverride(selectedSpine.id, selectedSpine.adminGateOverride)} disabled={pending} />
                      <div>
                        <div className={styles.adminCheckTitle}>Unlock before prerequisites</div>
                        <div className={styles.adminCheckDesc}>Shows in owner portal now</div>
                      </div>
                    </label>
                  </div>
                </div>
              )}
              <div className={styles.adminControlRow}>
                <span className={styles.adminControlLabel}>Waive</span>
                <div className={styles.adminControlBody}>
                  <label className={styles.adminCheckLabel}>
                    <input type="checkbox" checked={selectedSpine.waived} onChange={() => toggleWaived(selectedSpine.id, selectedSpine.waived)} disabled={pending} />
                    <div>
                      <div className={styles.adminCheckTitle}>Not required</div>
                      <div className={styles.adminCheckDesc}>Hides from owner portal</div>
                    </div>
                  </label>
                  {selectedSpine.waived && (
                    <div className={styles.adminWaivedWarning}>
                      <Warning size={12} weight="fill" />
                      Owner will not see this document
                    </div>
                  )}
                </div>
              </div>
              <div className={styles.adminControlsDivider} />
              <div className={styles.adminControlRow}>
                <span className={styles.adminControlLabel}>Due date</span>
                <div className={styles.adminControlBody}>
                  <DatePickerInput value={selectedSpine.customDueDate?.split("T")[0] ?? ""} onChange={(val) => updateDeadline(selectedSpine.id, val)} placeholder="No deadline" disabled={pending} />
                  {selectedSpine.customDueDate && (
                    <button onClick={() => updateDeadline(selectedSpine.id, "")} type="button" style={{ fontSize: 11, color: "var(--color-text-muted)", background: "none", border: "none", cursor: "pointer", padding: "2px 0", display: "flex", alignItems: "center", gap: 3, marginTop: 3 }} disabled={pending}>
                      <Trash size={10} /> Remove deadline
                    </button>
                  )}
                </div>
              </div>
              <div className={styles.adminControlRow} style={{ alignItems: "flex-start" }}>
                <span className={styles.adminControlLabel} style={{ paddingTop: 10 }}>Owner note</span>
                <div className={styles.adminControlBody}>
                  <textarea className={styles.adminTextarea} value={ownerNoteValue} onChange={(e) => setOwnerNoteValue(e.target.value)} onBlur={() => saveOwnerNote(selectedSpine.id)} rows={3} maxLength={500} placeholder="Shown to owner below description..." />
                  <div className={styles.adminTextareaHint}>Visible in owner portal</div>
                </div>
              </div>
              <div className={styles.adminControlRow} style={{ alignItems: "flex-start" }}>
                <span className={styles.adminControlLabel} style={{ paddingTop: 10 }}>Admin note</span>
                <div className={styles.adminControlBody}>
                  <textarea className={styles.adminTextarea} value={adminNoteValue} onChange={(e) => setAdminNoteValue(e.target.value)} onBlur={() => saveAdminNote(selectedSpine.id)} rows={3} maxLength={500} placeholder="Internal only, never shown to owner..." />
                  <div className={styles.adminTextareaHint}>Internal only</div>
                </div>
              </div>
              <div className={styles.adminDangerDivider} />
              {selectedSpine.manuallyCompletedAt ? (
                <div className={`${styles.completionCard} ${styles.completionCardDone}`}>
                  <div className={styles.completionDoneRow}>
                    <ShieldCheck size={16} weight="fill" style={{ color: "var(--color-success)", flexShrink: 0, marginTop: 1 }} />
                    <div className={styles.completionDoneText}>
                      <div className={styles.completionDoneDate}>Completed manually on {formatDate(selectedSpine.manuallyCompletedAt)}</div>
                      {selectedSpine.manuallyCompletedNote && <div className={styles.completionDoneNote}>{selectedSpine.manuallyCompletedNote}</div>}
                    </div>
                    <button onClick={() => unmarkComplete(selectedSpine.id)} disabled={pending} type="button" className={styles.secondaryButton} style={{ padding: "4px 8px", fontSize: 11, flexShrink: 0 }}>Undo</button>
                  </div>
                </div>
              ) : (
                <div className={styles.completionCard}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-tertiary)", marginBottom: 6 }}>Mark as complete</div>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 10, lineHeight: 1.45 }}>Use when handled outside the portal: paper copy, verbal confirmation, etc.</div>
                  <textarea className={styles.adminTextarea} value={completionNote} onChange={(e) => setCompletionNote(e.target.value)} rows={2} maxLength={500} placeholder="Describe how this was completed (required)..." />
                  <div style={{ marginTop: 8 }}>
                    <button onClick={() => markComplete(selectedSpine.id)} disabled={completionNote.trim().length < 10 || pending} type="button" className={styles.primaryButton} style={{ fontSize: 12, padding: "6px 12px" }}>
                      <ShieldCheck size={13} weight="bold" />
                      Mark complete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 8, color: "var(--color-text-muted)", padding: 24 }}>
              <FolderSimple size={28} style={{ opacity: 0.3 }} />
              <span style={{ fontSize: 12, textAlign: "center" }}>Select a document to view admin controls</span>
            </div>
          )}
        </div>
      </div>

      {/* Request modal */}
      {requestCards ? (
        <RequestDocumentModal
          cards={requestCards}
          members={members}
          owner={owner}
          origin={origin}
          workspaceId={workspaceId}
          pending={pending}
          onClose={() => setRequestCards(null)}
          onSend={sendRequest}
          onCopy={copyRequestValue}
        />
      ) : null}

      {/* Footer notes */}
      <div style={{ display: "flex", gap: 16, padding: "10px 16px", borderTop: "1px solid var(--color-warm-gray-100)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--color-text-tertiary)" }}>
          <Buildings size={12} weight="duotone" />
          Offboarding stays hidden until the workspace intentionally enters that process.
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--color-text-tertiary)" }}>
          <CalendarBlank size={12} weight="duotone" />
          Expiring documents will show renewal dates once expiration data is captured.
        </span>
      </div>
    </div>
  );
}
