"use client";

import { useState, useEffect, useCallback, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ChatCircle,
  EnvelopeSimple,
  Megaphone,
  MagnifyingGlass,
  PaperPlaneTilt,
  FunnelSimple,
  PlusCircle,
  Eye,
  Clock,
  DeviceMobile,
  Desktop,
  ArrowLeft,
  Lightning,
  PhoneSlash,
  WarningCircle,
  Buildings,
} from "@phosphor-icons/react";
import { RichTextEditor } from "@/components/messages/RichTextEditor";
import { SafeHtml } from "@/components/messages/SafeHtml";
import {
  sendMessage,
  sendBroadcast,
  getConversationMessages,
  getOwnerCount,
  getOrCreateDirectConversation,
} from "./actions";
import { createClient } from "@/lib/supabase/client";
import type { CommunicationsDashboardData } from "@/lib/admin/fetch-communications";
import { scopeCommunicationsDashboard } from "./insight-scope";
import { getConversationContextLabel, getConversationSearchText } from "./conversation-context";
import { getMessageDisplayParticipant } from "./message-display";
import { resolveEmailComposeSubject } from "./reply-subject";
import { conversationNeedsReply, messageNeedsReply } from "./reply-state";
import { conversationHasAttachments } from "./conversation-flags";
import { resolveInboxWorkspaceHref } from "./workspace-link";

type Conversation = {
  id: string;
  ownerId: string | null;
  subject: string | null;
  type: "direct" | "announcement" | "email_log";
  lastMessageAt: string;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  lastMessage: {
    body: string;
    senderId: string;
    senderRole: string | null;
    createdAt: string;
    deliveryMethod: string;
    metadata: Record<string, unknown>;
  } | null;
};

type Owner = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  is_system: boolean;
  delivery_method: string;
  metadata: Record<string, unknown>;
  created_at: string;
  senderName: string;
  senderRole: string;
  senderAvatarUrl: string | null;
  reads: Array<{
    readerId: string;
    firstReadAt: string;
    readCount: number;
    lastReadAt: string;
    deviceInfo: string | null;
  }>;
};

type ConversationDetail = {
  id: string;
  owner_id: string | null;
  subject: string | null;
  type: string;
  ownerProfile: { id: string; full_name: string | null; email: string; phone: string | null; workspaceId: string | null } | null;
};

type DeliveryMethod = "workspace" | "email" | "sms";

const FILTERS = [
  { key: "all", label: "All messages" },
  { key: "unread", label: "Unread" },
  { key: "sent", label: "Sent" },
  { key: "sms", label: "SMS" },
  { key: "email", label: "Email" },
  { key: "attachments", label: "Files" },
  { key: "announcements", label: "Announcements" },
  { key: "email_logs", label: "Email logs" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

export function AdminMessagesShell({
  conversations: initialConversations,
  allOwners,
  selectedOwnerId,
  selectedConversationId,
  initialFilter,
  communicationsDashboard,
}: {
  conversations: Conversation[];
  allOwners: Owner[];
  selectedOwnerId: string | null;
  selectedConversationId: string | null;
  initialFilter: string;
  communicationsDashboard: CommunicationsDashboardData;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [filter, setFilter] = useState<FilterKey>(
    (initialFilter as FilterKey) || "all",
  );
  const [search, setSearch] = useState("");
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationDetail, setConversationDetail] =
    useState<ConversationDetail | null>(null);
  const [composeBody, setComposeBody] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("workspace");
  const [emailSubject, setEmailSubject] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [showOwnerPicker, setShowOwnerPicker] = useState(false);
  const [ownerSearch, setOwnerSearch] = useState("");
  const [expandedReads, setExpandedReads] = useState<Set<string>>(new Set());
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastSubject, setBroadcastSubject] = useState("");
  const [broadcastBody, setBroadcastBody] = useState("");
  const [broadcastDelivery, setBroadcastDelivery] = useState<"workspace" | "workspace_email">("workspace");
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [ownerCount, setOwnerCount] = useState<number | null>(0);
  const selectedOwner = selectedOwnerId
    ? allOwners.find((owner) => owner.id === selectedOwnerId) ?? null
    : null;
  const scopedConversations = selectedOwnerId
    ? initialConversations.filter((conversation) => conversation.ownerId === selectedOwnerId)
    : initialConversations;

  // Filter conversations
  const filtered = scopedConversations.filter((c) => {
    if (filter === "announcements" && c.type !== "announcement") return false;
    if (filter === "email_logs" && c.type !== "email_log") return false;
    if (filter === "unread" && !conversationNeedsReply(c)) return false;
    if (filter === "sent" && !conversationWasLastSentByAdmin(c)) return false;
    if (filter === "sms" && !conversationIsSms(c)) return false;
    if (filter === "email" && !conversationIsEmail(c)) return false;
    if (filter === "attachments" && !conversationHasAttachments(c)) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchesName = c.ownerName?.toLowerCase().includes(q);
      const matchesEmail = c.ownerEmail?.toLowerCase().includes(q);
      const matchesSubject = c.subject?.toLowerCase().includes(q);
      const matchesBody = c.lastMessage?.body?.toLowerCase().includes(q);
      const matchesContext = getConversationSearchText(c).includes(q);
      if (!matchesName && !matchesEmail && !matchesSubject && !matchesBody && !matchesContext)
        return false;
    }
    return true;
  });

  // Load conversation messages when selected
  const loadConversation = useCallback(async (convId: string) => {
    setSelectedConvId(convId);
    const result = await getConversationMessages(convId);
    if (result.error) return;
    setMessages(result.messages as Message[]);
    setConversationDetail(result.conversation as ConversationDetail);
  }, []);

  // Auto-select conversation from deep link or owner filter.
  useEffect(() => {
    if (selectedConversationId) {
      const conv = initialConversations.find((c) => c.id === selectedConversationId);
      if (conv) loadConversation(conv.id);
      return;
    }

    if (selectedOwnerId) {
      const ownerConversations = initialConversations.filter((c) => c.ownerId === selectedOwnerId);
      const conv =
        ownerConversations.find((c) => c.type === "direct") ??
        ownerConversations.find((c) => c.type === "email_log") ??
        ownerConversations[0];
       
      if (conv) loadConversation(conv.id);
    }
  }, [selectedConversationId, selectedOwnerId, initialConversations, loadConversation]);

  // Real-time subscription for new messages
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("admin-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          if (selectedConvId && payload.new.conversation_id === selectedConvId) {
            loadConversation(selectedConvId);
          }
          startTransition(() => router.refresh());
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConvId, loadConversation, router]);

  const handleSend = async () => {
    if (!composeBody.trim() || !conversationDetail?.owner_id) return;
    const effectiveDeliveryMethod = conversationDetail.type === "email_log" ? "email" : deliveryMethod;
    const resolvedSubject = effectiveDeliveryMethod === "email"
      ? resolveEmailComposeSubject({
          conversationType: conversationDetail.type,
          typedSubject: emailSubject,
          messages: messages.map((message) => ({
            deliveryMethod: message.delivery_method,
            metadata: message.metadata,
          })),
        })
      : null;
    if (resolvedSubject && !resolvedSubject.ok) {
      setSendError(resolvedSubject.error);
      return;
    }
    if (effectiveDeliveryMethod === "sms" && !conversationDetail.ownerProfile?.phone) return;
    setSending(true);
    setSendError(null);
    const result = await sendMessage({
      ownerId: conversationDetail.owner_id,
      body: composeBody,
      deliveryMethod: effectiveDeliveryMethod,
      subject: resolvedSubject?.ok ? resolvedSubject.subject : undefined,
      conversationId: selectedConvId ?? undefined,
    });
    setSending(false);
    if (result.error) {
      setSendError(result.error);
      return;
    }
    setComposeBody("");
    setEmailSubject("");
    setDeliveryMethod(conversationDetail.type === "email_log" ? "email" : "workspace");
    if (result.conversationId) loadConversation(result.conversationId);
  };

  const handleBroadcast = async () => {
    if (!broadcastSubject.trim() || !broadcastBody.trim()) return;
    setBroadcastSending(true);
    const result = await sendBroadcast({
      subject: broadcastSubject,
      body: broadcastBody,
      deliveryMethod: broadcastDelivery,
    });
    setBroadcastSending(false);
    if (result.error) return;
    setBroadcastSubject("");
    setBroadcastBody("");
    setBroadcastDelivery("workspace");
    setShowBroadcast(false);
    startTransition(() => router.refresh());
  };

  const openBroadcast = async () => {
    const count = await getOwnerCount();
    setOwnerCount(count);
    setShowBroadcast(true);
  };

  const handleNewMessage = async (ownerId: string) => {
    setShowOwnerPicker(false);
    setOwnerSearch("");
    const existing = initialConversations.find(
      (c) => c.ownerId === ownerId && c.type === "direct",
    );
    if (existing) {
      loadConversation(existing.id);
      return;
    }
    const result = await getOrCreateDirectConversation(ownerId);
    if (result.conversationId) {
      startTransition(() => router.refresh());
      loadConversation(result.conversationId);
    }
  };

  const toggleReads = (messageId: string) => {
    setExpandedReads((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  };

  const filteredOwners = allOwners.filter((o) => {
    if (!ownerSearch) return true;
    const q = ownerSearch.toLowerCase();
    return o.name.toLowerCase().includes(q) || o.email.toLowerCase().includes(q);
  });

  const scopedDashboard = scopeCommunicationsDashboard({
    dashboard: communicationsDashboard,
    selectedOwnerId,
    selectedOwnerPhone: selectedOwner?.phone ?? null,
  });
  const insightStats = buildInsightStats(scopedConversations, scopedDashboard);
  const composeDeliveryMethod = conversationDetail?.type === "email_log" ? "email" : deliveryMethod;
  const emailSubjectResult = conversationDetail && composeDeliveryMethod === "email"
    ? resolveEmailComposeSubject({
        conversationType: conversationDetail.type,
        typedSubject: emailSubject,
        messages: messages.map((message) => ({
          deliveryMethod: message.delivery_method,
          metadata: message.metadata,
        })),
      })
    : null;
  const emailSubjectPlaceholder =
    emailSubjectResult?.ok && emailSubjectResult.inherited
      ? emailSubjectResult.subject
      : "Email subject...";
  const workspaceHref = conversationDetail
    ? resolveInboxWorkspaceHref({
        ownerWorkspaceId: conversationDetail.ownerProfile?.workspaceId,
        messages: messages.map((message) => ({ metadata: message.metadata })),
      })
    : null;

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left Panel: Filters (hidden on mobile) */}
      <div
        className="hidden w-[220px] shrink-0 flex-col border-r lg:flex"
        style={{
          borderColor: "var(--color-warm-gray-200)",
          backgroundColor: "var(--color-warm-gray-50)",
        }}
      >
        <div className="px-4 pb-3 pt-6">
          <h2 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>Messages</h2>
          {selectedOwner ? (
            <div className="mt-1 flex items-center gap-1.5 text-[10px]" style={{ color: "var(--color-text-tertiary)" }}>
              <span className="truncate">Owner view: {selectedOwner.name}</span>
            </div>
          ) : null}
        </div>

        <div className="px-3 pb-3">
          <div
            className="rounded-lg border p-3"
            style={{
              borderColor: "var(--color-warm-gray-200)",
              backgroundColor: "var(--color-white)",
            }}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--color-text-primary)" }}>
                <Lightning size={13} weight="fill" style={{ color: "var(--color-brand)" }} />
                Command center
              </span>
              {insightStats.needsAttention > 0 ? (
                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: "#fef3c7", color: "#92400e" }}>
                  {insightStats.needsAttention}
                </span>
              ) : null}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <InsightMetric label="Total" value={insightStats.total} />
              <InsightMetric label="SMS" value={insightStats.sms} />
              <InsightMetric label="Email" value={insightStats.email} />
              <InsightMetric
                label="Reply"
                value={insightStats.needsReply}
                tone={insightStats.needsReply > 0 ? "attention" : "neutral"}
              />
            </div>
          </div>
        </div>

        <nav className="flex-1 px-2">
          <ul className="flex flex-col gap-0.5">
            {FILTERS.map((f) => {
              const count =
                f.key === "all"
                  ? scopedConversations.length
                  : f.key === "unread"
                    ? scopedConversations.filter(conversationNeedsReply).length
                  : f.key === "sent"
                    ? scopedConversations.filter(conversationWasLastSentByAdmin).length
                  : f.key === "sms"
                    ? scopedConversations.filter(conversationIsSms).length
                  : f.key === "email"
                    ? scopedConversations.filter(conversationIsEmail).length
                  : f.key === "attachments"
                    ? scopedConversations.filter(conversationHasAttachments).length
                  : f.key === "announcements"
                    ? scopedConversations.filter((c) => c.type === "announcement").length
                    : f.key === "email_logs"
                      ? scopedConversations.filter((c) => c.type === "email_log").length
                      : 0;
              return (
                <li key={f.key}>
                  <button
                    type="button"
                    onClick={() => setFilter(f.key)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                    style={{
                      color: filter === f.key ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                      backgroundColor:
                        filter === f.key ? "var(--color-warm-gray-100)" : "transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (filter !== f.key)
                        e.currentTarget.style.backgroundColor = "var(--color-warm-gray-100)";
                    }}
                    onMouseLeave={(e) => {
                      if (filter !== f.key)
                        e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <FilterIcon filterKey={f.key} />
                      {f.label}
                    </span>
                    {count > 0 ? (
                      <span className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                        {count}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex flex-col gap-2 border-t p-3" style={{ borderColor: "var(--color-warm-gray-200)" }}>
          <button
            type="button"
            onClick={() => setShowOwnerPicker(true)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            style={{ color: "var(--color-brand-light)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--color-warm-gray-100)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <PlusCircle size={16} weight="bold" />
            New message
          </button>
          <button
            type="button"
            onClick={openBroadcast}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            style={{ color: "#f59e0b" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--color-warm-gray-100)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <Megaphone size={16} weight="bold" />
            New announcement
          </button>
        </div>
      </div>

      {/* Middle Panel: Conversation List */}
      <div
        className={`flex shrink-0 flex-col border-r ${
          selectedConvId ? "hidden md:flex" : "flex"
        } w-full md:w-[320px]`}
        style={{ borderColor: "var(--color-warm-gray-200)" }}
      >
        <div className="border-b px-3 py-3" style={{ borderColor: "var(--color-warm-gray-200)" }}>
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2"
            style={{ backgroundColor: "var(--color-warm-gray-100)" }}
          >
            <MagnifyingGlass size={14} style={{ color: "var(--color-text-tertiary)" }} />
            <input
              type="text"
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm focus:outline-none"
              style={{ color: "var(--color-text-primary)" }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--color-text-tertiary)" }}>
              No conversations found.
            </div>
          ) : (
            <ul>
              {filtered.map((c) => {
                const contextLabel = getConversationContextLabel(c);
                return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => loadConversation(c.id)}
                    className="flex w-full gap-3 border-b px-4 py-3 text-left transition-colors"
                    style={{
                      borderColor: "var(--color-warm-gray-100)",
                      backgroundColor: selectedConvId === c.id ? "var(--color-warm-gray-100)" : "transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (selectedConvId !== c.id)
                        e.currentTarget.style.backgroundColor = "var(--color-warm-gray-50)";
                    }}
                    onMouseLeave={(e) => {
                      if (selectedConvId !== c.id)
                        e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <div className="shrink-0 pt-0.5">
                      {c.type === "announcement" ? (
                        <span
                          className="flex h-9 w-9 items-center justify-center rounded-full"
                          style={{ backgroundColor: "rgba(2, 170, 235, 0.12)", color: "var(--color-brand)" }}
                        >
                          <Megaphone size={16} weight="duotone" />
                        </span>
                      ) : c.type === "email_log" ? (
                        <span
                          className="flex h-9 w-9 items-center justify-center rounded-full"
                          style={{ backgroundColor: "var(--color-warm-gray-100)", color: "var(--color-text-tertiary)" }}
                        >
                          <EnvelopeSimple size={16} weight="duotone" />
                        </span>
                      ) : (
                        <span
                          className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold"
                          style={{ backgroundColor: "var(--color-warm-gray-100)", color: "var(--color-text-secondary)" }}
                        >
                          {buildInitials(c.ownerName ?? "")}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                          {c.type === "announcement" ? (c.subject ?? "Announcement") : (c.ownerName ?? "Unknown")}
                        </span>
                        <span className="shrink-0 text-[10px]" style={{ color: "var(--color-text-tertiary)" }}>
                          {formatRelative(c.lastMessageAt)}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-xs" style={{ color: "var(--color-text-secondary)" }}>
                        {c.lastMessage ? stripHtml(c.lastMessage.body).slice(0, 80) : "No messages yet"}
                      </div>
                      {contextLabel ? (
                        <div className="mt-1 truncate text-[10px]" style={{ color: "var(--color-text-tertiary)" }}>
                          {contextLabel}
                        </div>
                      ) : null}
                      {c.lastMessage?.deliveryMethod === "email" ? (
                        <span className="mt-1 inline-flex items-center gap-1 text-[10px]" style={{ color: "var(--color-text-tertiary)" }}>
                          <EnvelopeSimple size={10} />
                          Email
                        </span>
                      ) : c.lastMessage?.deliveryMethod === "sms" ? (
                        <span className="mt-1 inline-flex items-center gap-1 text-[10px]" style={{ color: "var(--color-text-tertiary)" }}>
                          <DeviceMobile size={10} />
                          SMS
                        </span>
                      ) : null}
                      {conversationNeedsReply(c) ? (
                        <span className="ml-2 mt-1 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: "#fef3c7", color: "#92400e" }}>
                          Needs reply
                        </span>
                      ) : null}
                    </div>
                  </button>
                </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Right Panel: Thread + Compose */}
      <div
        className={`flex min-w-0 flex-1 flex-col ${
          selectedConvId ? "flex" : "hidden md:flex"
        }`}
      >
        {!selectedConvId || !conversationDetail ? (
          <div className="flex flex-1 items-center justify-center overflow-y-auto px-6 py-8">
            <div className="w-full max-w-3xl">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>
                    {selectedOwner ? `${selectedOwner.name} communications` : "Communications command center"}
                  </h2>
                  <p className="mt-1 text-sm" style={{ color: "var(--color-text-tertiary)" }}>
                    {selectedOwner
                      ? "Review portal, SMS, and email history for this workspace owner."
                      : "Select a conversation, or review what needs attention now."}
                  </p>
                </div>
                <ChatCircle size={34} weight="duotone" style={{ color: "var(--color-brand)" }} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <CommandMetric icon={<ChatCircle size={16} weight="duotone" />} label="Conversations" value={insightStats.total} />
                <CommandMetric icon={<DeviceMobile size={16} weight="duotone" />} label="SMS threads" value={insightStats.sms} />
                <CommandMetric icon={<EnvelopeSimple size={16} weight="duotone" />} label="Email logs" value={insightStats.email} />
                <CommandMetric
                  icon={<WarningCircle size={16} weight="duotone" />}
                  label="Needs reply"
                  value={insightStats.needsReply}
                  tone={insightStats.needsReply > 0 ? "attention" : "neutral"}
                />
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <CommandList
                  title="Unresolved callers"
                  empty="No unresolved callers."
                  items={scopedDashboard.unresolvedCallers.slice(0, 4).map((caller) => ({
                    id: caller.phone,
                    icon: <PhoneSlash size={14} weight="duotone" />,
                    title: caller.phone,
                    body: caller.claudeSummary ?? "Matched phone number needed.",
                    date: caller.createdAt,
                  }))}
                />
                <CommandList
                  title="Action items"
                  empty="No open communication actions."
                  items={scopedDashboard.recentActionItems.slice(0, 4).map((item) => ({
                    id: item.id,
                    icon: <Lightning size={14} weight="duotone" />,
                    title: item.title,
                    body: item.body,
                    date: item.createdAt,
                  }))}
                />
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Thread Header */}
            <div className="flex items-center gap-3 border-b px-4 py-4 md:px-6" style={{ borderColor: "var(--color-warm-gray-200)" }}>
              {/* Mobile back button */}
              <button
                type="button"
                onClick={() => { setSelectedConvId(null); setConversationDetail(null); }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg md:hidden"
                style={{ color: "var(--color-brand)" }}
                aria-label="Back to conversations"
              >
                <ArrowLeft size={18} weight="bold" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  {conversationDetail.type === "announcement"
                    ? (conversationDetail.subject ?? "Announcement")
                    : (conversationDetail.ownerProfile?.full_name?.trim() ??
                      conversationDetail.ownerProfile?.email ??
                      "Unknown")}
                </div>
                {conversationDetail.ownerProfile?.email ? (
                  <div className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                    {conversationDetail.ownerProfile.email}
                    {conversationDetail.ownerProfile.phone ? ` · ${conversationDetail.ownerProfile.phone}` : ""}
                  </div>
                ) : null}
              </div>
              {workspaceHref ? (
                <a
                  href={workspaceHref}
                  className="ml-auto hidden items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold md:flex"
                  style={{ borderColor: "var(--color-warm-gray-200)", color: "var(--color-brand)" }}
                >
                  <Buildings size={13} weight="duotone" />
                  Open workspace
                </a>
              ) : null}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="mx-auto flex max-w-3xl flex-col gap-4">
                <ThreadInsightStrip messages={messages} conversation={conversationDetail} />
                {messages.map((m) => {
                  const isAdmin = m.senderRole === "admin";
                  const isSystem = m.is_system;
                  const communicationMeta = getCommunicationMeta(m);
                  const participant = getMessageDisplayParticipant({
                    senderName: m.senderName,
                    senderRole: m.senderRole,
                    deliveryMethod: m.delivery_method,
                    metadata: m.metadata,
                  });
                  return (
                    <div key={m.id}>
                      <div className={`flex items-end gap-2 ${isAdmin ? "flex-row-reverse" : "flex-row"}`}>
                        {/* Sender Avatar */}
                        {isSystem ? (
                          <span
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                            style={{ backgroundColor: "rgba(2, 170, 235, 0.12)", color: "var(--color-brand-light)" }}
                          >
                            <Megaphone size={12} weight="bold" />
                          </span>
                        ) : m.senderAvatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.senderAvatarUrl}
                            alt={participant.name}
                            className="h-7 w-7 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <span
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                            style={{
                              backgroundColor: isAdmin ? "var(--color-brand)" : "var(--color-warm-gray-200)",
                              color: isAdmin ? "white" : "var(--color-text-primary)",
                            }}
                          >
                            {buildInitials(participant.name)}
                          </span>
                        )}

                        <div
                          className="max-w-[70%] rounded-xl px-4 py-3"
                          style={{
                            backgroundColor: isSystem
                              ? "rgba(2, 170, 235, 0.08)"
                              : isAdmin
                                ? "var(--color-brand)"
                                : "var(--color-warm-gray-100)",
                          }}
                        >
                          {isSystem ? (
                            <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase" style={{ color: "var(--color-brand-light)" }}>
                              <Megaphone size={10} />
                              Announcement
                            </div>
                          ) : null}
                          {!isSystem ? (
                            <div
                              className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold"
                              style={{ color: isAdmin ? "rgba(255,255,255,0.82)" : "var(--color-text-secondary)" }}
                            >
                              <span>{participant.name}</span>
                              {participant.detail ? (
                                <span
                                  className="truncate font-medium"
                                  style={{ color: isAdmin ? "rgba(255,255,255,0.62)" : "var(--color-text-tertiary)" }}
                                >
                                  {participant.detail}
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                          {m.delivery_method === "email" ? (
                            <div
                              className="mb-1 flex items-center gap-1 text-[10px]"
                              style={{ color: isAdmin ? "rgba(255,255,255,0.8)" : "var(--color-text-tertiary)" }}
                            >
                              <EnvelopeSimple size={10} />
                              Sent via email
                            </div>
                          ) : m.delivery_method === "sms" ? (
                            <div
                              className="mb-1 flex items-center gap-1 text-[10px]"
                              style={{ color: isAdmin ? "rgba(255,255,255,0.8)" : "var(--color-text-tertiary)" }}
                            >
                              <DeviceMobile size={10} />
                              Sent via SMS
                            </div>
                          ) : null}
                          {communicationMeta ? (
                            <CommunicationMetaBlock meta={communicationMeta} isAdmin={isAdmin} />
                          ) : null}
                          <SafeHtml
                            html={m.body}
                            className="prose prose-sm max-w-none text-sm [&_a]:underline [&_img]:rounded-lg"
                            style={{ color: isAdmin ? "white" : "var(--color-text-primary)" }}
                          />
                          <div
                            className="mt-2 text-[10px]"
                            style={{ color: isAdmin ? "rgba(255,255,255,0.7)" : "var(--color-text-tertiary)" }}
                          >
                            {new Date(m.created_at).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Read tracking */}
                      {isAdmin && m.reads.length > 0 ? (
                        <div className={`mt-1 flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                          <button
                            type="button"
                            onClick={() => toggleReads(m.id)}
                            className="flex items-center gap-1 text-[10px] transition-colors"
                            style={{ color: "var(--color-text-tertiary)" }}
                          >
                            <Eye size={10} />
                            Read by {m.reads.length} {m.reads.length === 1 ? "person" : "people"}
                          </button>
                        </div>
                      ) : null}
                      {isAdmin && expandedReads.has(m.id) ? (
                        <div className={`mt-1 flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                          <div
                            className="rounded-lg p-3 text-[10px]"
                            style={{ backgroundColor: "var(--color-warm-gray-50)", color: "var(--color-text-secondary)" }}
                          >
                            {m.reads.map((r) => (
                              <div key={r.readerId} className="flex items-center gap-3 py-1">
                                <span className="flex items-center gap-1">
                                  <Clock size={10} />
                                  First: {new Date(r.firstReadAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                                </span>
                                <span>Opens: {r.readCount}</span>
                                {r.deviceInfo ? (
                                  <span className="flex items-center gap-1">
                                    {r.deviceInfo.includes("Mobile") ? <DeviceMobile size={10} /> : <Desktop size={10} />}
                                    {r.deviceInfo.includes("Mobile") ? "Mobile" : "Desktop"}
                                  </span>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Compose */}
            {conversationDetail.type === "direct" || conversationDetail.type === "email_log" ? (
              <div className="border-t p-4" style={{ borderColor: "var(--color-warm-gray-200)" }}>
                <RichTextEditor dark={false} content="" onChange={setComposeBody} placeholder="Write a message..." />
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Delivery Toggle */}
                    <div
                      className="flex overflow-hidden rounded-lg border"
                      style={{ borderColor: "var(--color-warm-gray-200)" }}
                    >
                      <button
                        type="button"
                        onClick={() => setDeliveryMethod("workspace")}
                        disabled={conversationDetail.type === "email_log"}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors"
                        style={{
                          backgroundColor: composeDeliveryMethod === "workspace" ? "var(--color-warm-gray-100)" : "transparent",
                          color: composeDeliveryMethod === "workspace" ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                        }}
                      >
                        <ChatCircle size={12} weight="bold" />
                        Workspace
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeliveryMethod("email")}
                        className="flex items-center gap-1.5 border-l px-3 py-1.5 text-xs font-medium transition-colors"
                        style={{
                          borderColor: "var(--color-warm-gray-200)",
                          backgroundColor: composeDeliveryMethod === "email" ? "var(--color-warm-gray-100)" : "transparent",
                          color: composeDeliveryMethod === "email" ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                        }}
                      >
                        <EnvelopeSimple size={12} weight="bold" />
                        Email
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeliveryMethod("sms")}
                        disabled={conversationDetail.type === "email_log" || !conversationDetail.ownerProfile?.phone}
                        className="flex items-center gap-1.5 border-l px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40"
                        style={{
                          borderColor: "var(--color-warm-gray-200)",
                          backgroundColor: composeDeliveryMethod === "sms" ? "var(--color-warm-gray-100)" : "transparent",
                          color: composeDeliveryMethod === "sms" ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                        }}
                      >
                        <DeviceMobile size={12} weight="bold" />
                        SMS
                      </button>
                    </div>

                    {/* Subject field (email only) */}
                    {composeDeliveryMethod === "email" ? (
                      <input
                        type="text"
                        placeholder={emailSubjectPlaceholder}
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        className="rounded-lg border bg-transparent px-3 py-1.5 text-xs focus:outline-none"
                        style={{ borderColor: "var(--color-warm-gray-200)", color: "var(--color-text-primary)", minWidth: "200px" }}
                      />
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={
                      sending ||
                      !composeBody.trim() ||
                      (composeDeliveryMethod === "email" && !emailSubjectResult?.ok) ||
                      (composeDeliveryMethod === "sms" && !conversationDetail.ownerProfile?.phone)
                    }
                    className="flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
                    style={{ backgroundColor: "var(--color-brand)" }}
                  >
                    <PaperPlaneTilt size={16} weight="bold" />
                    {sending ? "Sending..." : composeDeliveryMethod === "email" ? "Send email" : composeDeliveryMethod === "sms" ? "Send SMS" : "Send"}
                  </button>
                </div>
                {sendError ? (
                  <div className="mt-2 text-xs" style={{ color: "#dc2626" }}>
                    {sendError}
                  </div>
                ) : composeDeliveryMethod === "sms" && !conversationDetail.ownerProfile?.phone ? (
                  <div className="mt-2 text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                    Add a phone number to this owner before sending SMS.
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* Broadcast Modal */}
      {showBroadcast ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div
            className="w-[600px] rounded-xl border p-6"
            style={{ backgroundColor: "var(--color-white)", borderColor: "var(--color-warm-gray-200)" }}
          >
            <div className="mb-4 flex items-center gap-2">
              <Megaphone size={18} weight="duotone" style={{ color: "#d97706" }} />
              <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>New announcement</h3>
            </div>

            <input
              type="text"
              placeholder="Subject line..."
              value={broadcastSubject}
              onChange={(e) => setBroadcastSubject(e.target.value)}
              className="mb-3 w-full rounded-lg border bg-transparent px-4 py-2.5 text-sm focus:outline-none"
              style={{ borderColor: "var(--color-warm-gray-200)", color: "var(--color-text-primary)" }}
              autoFocus
            />

            <RichTextEditor dark={false} content="" onChange={setBroadcastBody} placeholder="Write your announcement..." />

            {/* Delivery method */}
            <div className="mt-4 flex items-center gap-4">
              <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>Deliver via:</span>
              <div className="flex overflow-hidden rounded-lg border" style={{ borderColor: "var(--color-warm-gray-200)" }}>
                <button
                  type="button"
                  onClick={() => setBroadcastDelivery("workspace")}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: broadcastDelivery === "workspace" ? "var(--color-warm-gray-100)" : "transparent",
                    color: broadcastDelivery === "workspace" ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                  }}
                >
                  Workspace only
                </button>
                <button
                  type="button"
                  onClick={() => setBroadcastDelivery("workspace_email")}
                  className="flex items-center gap-1.5 border-l px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{
                    borderColor: "var(--color-warm-gray-200)",
                    backgroundColor: broadcastDelivery === "workspace_email" ? "var(--color-warm-gray-100)" : "transparent",
                    color: broadcastDelivery === "workspace_email" ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                  }}
                >
                  Workspace + Email
                </button>
              </div>
            </div>

            {/* Owner count preview */}
            <div
              className="mt-3 rounded-lg px-3 py-2 text-xs"
              style={{ backgroundColor: "var(--color-warm-gray-50)", color: "var(--color-text-secondary)" }}
            >
              {ownerCount === null
                ? "Could not load owner count."
                : <>This will be sent to <strong style={{ color: "var(--color-text-primary)" }}>{ownerCount}</strong> owner{ownerCount !== 1 ? "s" : ""}
              {broadcastDelivery === "workspace_email" ? " (portal + email)" : " (portal only)"}.</>
              }
            </div>

            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowBroadcast(false); setBroadcastSubject(""); setBroadcastBody(""); }}
                className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                style={{ color: "var(--color-text-secondary)" }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-warm-gray-100)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBroadcast}
                disabled={broadcastSending || !broadcastSubject.trim() || !broadcastBody.trim()}
                className="flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
                style={{ backgroundColor: "#f59e0b" }}
              >
                <Megaphone size={14} weight="bold" />
                {broadcastSending ? "Sending..." : "Send announcement"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Owner Picker Modal */}
      {showOwnerPicker ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div
            className="w-[400px] rounded-xl border p-6"
            style={{ backgroundColor: "var(--color-white)", borderColor: "var(--color-warm-gray-200)" }}
          >
            <h3 className="mb-4 text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>New message</h3>
            <div className="mb-3 flex items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: "var(--color-warm-gray-100)" }}>
              <MagnifyingGlass size={14} style={{ color: "var(--color-text-tertiary)" }} />
              <input
                type="text"
                placeholder="Search owners..."
                value={ownerSearch}
                onChange={(e) => setOwnerSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm focus:outline-none"
                style={{ color: "var(--color-text-primary)" }}
                autoFocus
              />
            </div>
            <ul className="max-h-[300px] overflow-y-auto">
              {filteredOwners.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => handleNewMessage(o.id)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors"
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-warm-gray-100)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                      style={{ backgroundColor: "var(--color-warm-gray-100)", color: "var(--color-text-secondary)" }}
                    >
                      {buildInitials(o.name)}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>{o.name}</div>
                      <div className="truncate text-xs" style={{ color: "var(--color-text-tertiary)" }}>{o.email}</div>
                      {o.phone ? (
                        <div className="truncate text-xs" style={{ color: "var(--color-text-tertiary)" }}>{o.phone}</div>
                      ) : null}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => { setShowOwnerPicker(false); setOwnerSearch(""); }}
              className="mt-4 w-full rounded-lg py-2 text-sm font-medium transition-colors"
              style={{ color: "var(--color-text-secondary)" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-warm-gray-100)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type InboxInsightStats = {
  total: number;
  sms: number;
  email: number;
  needsReply: number;
  needsAttention: number;
};

type CommandListItem = {
  id: string;
  icon: ReactNode;
  title: string;
  body: string;
  date: string;
};

type CommunicationMeta = {
  channel: "email" | "sms";
  title: string;
  rows: Array<{ label: string; value: string }>;
};

function buildInsightStats(
  conversations: Conversation[],
  dashboard: CommunicationsDashboardData,
): InboxInsightStats {
  const sms = conversations.filter((c) => c.lastMessage?.deliveryMethod === "sms").length;
  const email = conversations.filter(
    (c) => c.type === "email_log" || c.lastMessage?.deliveryMethod === "email",
  ).length;
  const needsReply = conversations.filter(conversationNeedsReply).length;

  return {
    total: conversations.length,
    sms,
    email,
    needsReply,
    needsAttention: needsReply + dashboard.recentActionItems.length + dashboard.unresolvedCallers.length,
  };
}

function conversationWasLastSentByAdmin(conversation: Conversation): boolean {
  return conversation.lastMessage?.senderRole === "admin";
}

function conversationIsSms(conversation: Conversation): boolean {
  return conversation.lastMessage?.deliveryMethod === "sms";
}

function conversationIsEmail(conversation: Conversation): boolean {
  return conversation.type === "email_log" || conversation.lastMessage?.deliveryMethod === "email";
}

function InsightMetric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "attention";
}) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase" style={{ color: "var(--color-text-tertiary)" }}>
        {label}
      </div>
      <div
        className="mt-0.5 text-sm font-semibold"
        style={{ color: tone === "attention" ? "#92400e" : "var(--color-text-primary)" }}
      >
        {value}
      </div>
    </div>
  );
}

function CommandMetric({
  icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone?: "neutral" | "attention";
}) {
  return (
    <div
      className="rounded-lg border p-4"
      style={{
        borderColor: tone === "attention" ? "#fde68a" : "var(--color-warm-gray-200)",
        backgroundColor: tone === "attention" ? "#fffbeb" : "var(--color-white)",
      }}
    >
      <div className="flex items-center justify-between">
        <span style={{ color: tone === "attention" ? "#b45309" : "var(--color-brand)" }}>{icon}</span>
        <span className="text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>
          {value}
        </span>
      </div>
      <div className="mt-3 text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
        {label}
      </div>
    </div>
  );
}

function CommandList({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: CommandListItem[];
}) {
  return (
    <div
      className="rounded-lg border p-4"
      style={{ borderColor: "var(--color-warm-gray-200)", backgroundColor: "var(--color-white)" }}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
          {title}
        </h3>
        <span className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <div className="rounded-lg px-3 py-4 text-sm" style={{ backgroundColor: "var(--color-warm-gray-50)", color: "var(--color-text-tertiary)" }}>
          {empty}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <div key={item.id} className="flex gap-3">
              <span
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: "rgba(2, 170, 235, 0.12)", color: "var(--color-brand)" }}
              >
                {item.icon}
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                  {item.title}
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                  {item.body}
                </p>
                <div className="mt-1 text-[10px]" style={{ color: "var(--color-text-tertiary)" }}>
                  {formatCommandDate(item.date)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ThreadInsightStrip({
  messages,
  conversation,
}: {
  messages: Message[];
  conversation: ConversationDetail;
}) {
  const smsCount = messages.filter((message) => message.delivery_method === "sms").length;
  const emailCount = messages.filter((message) => message.delivery_method === "email").length;
  const lastMessage = messages[messages.length - 1] ?? null;
  const needsReply = lastMessage
    ? messageNeedsReply({
        ownerId: conversation.owner_id,
        senderId: lastMessage.sender_id,
        senderRole: lastMessage.senderRole,
        deliveryMethod: lastMessage.delivery_method,
        metadata: lastMessage.metadata,
      })
    : false;
  const lastTouch = lastMessage ? formatRelative(lastMessage.created_at) : "No messages";
  const contactMethods = [
    conversation.ownerProfile?.email ? "Email" : null,
    conversation.ownerProfile?.phone ? "SMS" : null,
    conversation.type === "direct" ? "Workspace" : null,
  ].filter((method): method is string => Boolean(method));

  return (
    <div
      className="grid gap-2 rounded-xl border p-2 sm:grid-cols-4"
      style={{
        borderColor: "var(--color-warm-gray-200)",
        backgroundColor: "var(--color-warm-gray-50)",
      }}
    >
      <ThreadInsightTile
        icon={<ChatCircle size={13} weight="duotone" />}
        label="Last touch"
        value={lastTouch}
      />
      <ThreadInsightTile
        icon={<EnvelopeSimple size={13} weight="duotone" />}
        label="Email"
        value={String(emailCount)}
      />
      <ThreadInsightTile
        icon={<DeviceMobile size={13} weight="duotone" />}
        label="SMS"
        value={String(smsCount)}
      />
      <ThreadInsightTile
        icon={<WarningCircle size={13} weight="duotone" />}
        label="Reply"
        value={needsReply ? "Needed" : "Clear"}
        tone={needsReply ? "attention" : "neutral"}
        detail={contactMethods.length > 0 ? contactMethods.join(", ") : "No channels"}
      />
    </div>
  );
}

function ThreadInsightTile({
  icon,
  label,
  value,
  detail,
  tone = "neutral",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail?: string;
  tone?: "neutral" | "attention";
}) {
  return (
    <div
      className="min-w-0 rounded-lg border px-3 py-2"
      style={{
        borderColor: tone === "attention" ? "#fde68a" : "var(--color-warm-gray-200)",
        backgroundColor: tone === "attention" ? "#fffbeb" : "var(--color-white)",
      }}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase" style={{ color: "var(--color-text-tertiary)" }}>
        {icon}
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
        {value}
      </div>
      {detail ? (
        <div className="mt-0.5 truncate text-[10px]" style={{ color: "var(--color-text-tertiary)" }}>
          {detail}
        </div>
      ) : null}
    </div>
  );
}

function formatCommandDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getCommunicationMeta(message: Message): CommunicationMeta | null {
  if (message.delivery_method === "email") {
    const subject = metadataString(message.metadata, "subject");
    const direction = metadataString(message.metadata, "direction");
    const from = metadataString(message.metadata, "from");
    const to = metadataStringArray(message.metadata, "to").join(", ");
    const relatedContact = metadataString(message.metadata, "related_contact_name");
    const attachmentNames = metadataAttachmentNames(message.metadata).join(", ");
    const attachmentCount = metadataNumber(message.metadata, "attachment_count");
    const rows = [
      subject ? { label: "Subject", value: subject } : null,
      direction ? { label: "Direction", value: titleCase(direction) } : null,
      relatedContact ? { label: "Contact", value: relatedContact } : null,
      from ? { label: "From", value: from } : null,
      to ? { label: "To", value: to } : null,
      attachmentNames
        ? { label: "Files", value: attachmentNames }
        : attachmentCount
          ? { label: "Files", value: String(attachmentCount) }
          : null,
    ].filter((row): row is { label: string; value: string } => Boolean(row));

    if (rows.length === 0) return null;
    return { channel: "email", title: "Email details", rows };
  }

  if (message.delivery_method === "sms") {
    const direction = metadataString(message.metadata, "direction");
    const phoneFrom = metadataString(message.metadata, "phone_from");
    const phoneTo = metadataString(message.metadata, "phone_to") ?? metadataString(message.metadata, "sms_to");
    const rows = [
      direction ? { label: "Direction", value: titleCase(direction) } : null,
      phoneFrom ? { label: "From", value: phoneFrom } : null,
      phoneTo ? { label: "To", value: phoneTo } : null,
    ].filter((row): row is { label: string; value: string } => Boolean(row));

    if (rows.length === 0) return null;
    return { channel: "sms", title: "SMS details", rows };
  }

  return null;
}

function CommunicationMetaBlock({ meta, isAdmin }: { meta: CommunicationMeta; isAdmin: boolean }) {
  const foreground = isAdmin ? "rgba(255,255,255,0.82)" : "var(--color-text-secondary)";
  const muted = isAdmin ? "rgba(255,255,255,0.62)" : "var(--color-text-tertiary)";
  const border = isAdmin ? "rgba(255,255,255,0.22)" : "var(--color-warm-gray-200)";
  const background = isAdmin ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.64)";

  return (
    <div className="mb-2 rounded-lg border px-3 py-2" style={{ borderColor: border, backgroundColor: background }}>
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase" style={{ color: muted }}>
        {meta.channel === "email" ? <EnvelopeSimple size={10} /> : <DeviceMobile size={10} />}
        {meta.title}
      </div>
      <div className="grid gap-1">
        {meta.rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[64px_minmax(0,1fr)] gap-2 text-[10px]">
            <span style={{ color: muted }}>{row.label}</span>
            <span className="truncate" title={row.value} style={{ color: foreground }}>
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function metadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function metadataStringArray(metadata: Record<string, unknown>, key: string): string[] {
  const value = metadata[key];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }
  const single = metadataString(metadata, key);
  return single ? [single] : [];
}

function metadataNumber(metadata: Record<string, unknown>, key: string): number | null {
  const value = metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function metadataAttachmentNames(metadata: Record<string, unknown>): string[] {
  const value = metadata.attachments;
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const filename = (item as Record<string, unknown>).filename;
    return typeof filename === "string" && filename.trim() ? [filename.trim()] : [];
  });
}

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function FilterIcon({ filterKey }: { filterKey: FilterKey }) {
  const size = 16;
  const weight = "duotone" as const;
  switch (filterKey) {
    case "all": return <ChatCircle size={size} weight={weight} />;
    case "unread": return <ChatCircle size={size} weight="fill" />;
    case "sent": return <PaperPlaneTilt size={size} weight={weight} />;
    case "sms": return <DeviceMobile size={size} weight={weight} />;
    case "email": return <EnvelopeSimple size={size} weight={weight} />;
    case "attachments": return <EnvelopeSimple size={size} weight={weight} />;
    case "announcements": return <Megaphone size={size} weight={weight} />;
    case "email_logs": return <EnvelopeSimple size={size} weight={weight} />;
    default: return <FunnelSimple size={size} weight={weight} />;
  }
}

function buildInitials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, "").trim();
}

function formatRelative(dateStr: string) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
