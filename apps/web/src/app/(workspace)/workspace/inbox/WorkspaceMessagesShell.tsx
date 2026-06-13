"use client";

import { useState, useEffect, useLayoutEffect, useCallback, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChatCircle,
  EnvelopeSimple,
  MagnifyingGlass,
  PaperPlaneTilt,
  ArrowLeft,
  ArrowDown,
  Plus,
  Paperclip,
  X,
  FileText,
  SpinnerGap,
} from "@phosphor-icons/react";
import { SafeHtml } from "@/components/messages/SafeHtml";
import {
  replyToConversation,
  getConversationMessagesForOwner,
  recordMessagesRead,
  createDirectConversation,
} from "./actions";
import { analyzeAttachment } from "./upload-actions";
import { createClient } from "@/lib/supabase/client";

/* ─── Proxy Company Avatar ─── */

function ProxyAvatar({ size = 40, highlighted = false }: { size?: number; highlighted?: boolean }) {
  const imgSize = Math.round(size * 0.6);
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: highlighted ? "var(--color-brand)" : "var(--color-warm-gray-100)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/logo-mark-v2.png"
        alt="Proxy"
        width={imgSize}
        height={imgSize}
        className="object-contain"
      />
    </span>
  );
}

/* ─── Types ─── */

type Conversation = {
  id: string;
  subject: string | null;
  type: "direct" | "announcement" | "email_log";
  lastMessageAt: string;
  lastMessage: {
    body: string;
    senderId: string;
    createdAt: string;
    isSystem: boolean;
  } | null;
  unreadCount: number;
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
  senderName?: string;
  senderRole?: string;
  senderAvatarUrl?: string | null;
};

type StagedFile = {
  id: string;
  file: File;
  previewUrl: string | null;
  uploading: boolean;
  error: string | null;
};

type AttachmentData = {
  url: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  aiSummary: string | null;
  documentType: string | null;
  keyDetails: Record<string, string> | null;
};

type Tab = "messages" | "emails";

/* ─── Component ─── */

export function WorkspaceMessagesShell({
  conversations,
  emailConversations,
  currentUserId,
}: {
  conversations: Conversation[];
  emailConversations: Conversation[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<Tab>("messages");
  const [search, setSearch] = useState("");
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  // Track conversations the user has opened this session (optimistic unread clear)
  const [readConvIds, setReadConvIds] = useState<Set<string>>(new Set());

  const filtered = conversations.map((c) => ({
    ...c,
    unreadCount: readConvIds.has(c.id) ? 0 : c.unreadCount,
  })).filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.subject?.toLowerCase().includes(q) ||
      c.lastMessage?.body?.toLowerCase().includes(q)
    );
  });

  const filteredEmails = emailConversations.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.subject?.toLowerCase().includes(q) ||
      c.lastMessage?.body?.toLowerCase().includes(q)
    );
  });

  const loadConversation = useCallback(
    async (convId: string) => {
      setSelectedConvId(convId);
      // Optimistically clear unread badge immediately
      setReadConvIds((prev) => new Set([...prev, convId]));
      const result = await getConversationMessagesForOwner(convId);
      if (result.error) return;
      setMessages(result.messages as Message[]);

      // Record reads in a single bulk call (not N individual round-trips)
      const unreadIds = (result.messages ?? [])
        .filter((m) => m.sender_id !== currentUserId)
        .map((m) => m.id);
      if (unreadIds.length > 0) {
        const device = typeof navigator !== "undefined" ? navigator.userAgent : null;
        recordMessagesRead({ messageIds: unreadIds, deviceInfo: device ?? undefined });
      }
    },
    [currentUserId],
  );

  // Auto-select first conversation if only one exists
  useEffect(() => {
    if (conversations.length === 1 && !selectedConvId) {
       
      loadConversation(conversations[0].id);
    }
  }, [conversations, selectedConvId, loadConversation]);

  // Scroll handled inside ChatThread via useLayoutEffect

  // Real-time
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`owner-messages-${currentUserId}`)
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
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        (payload) => {
          // Re-fetch when AI analysis updates message metadata
          if (selectedConvId && payload.new.conversation_id === selectedConvId) {
            loadConversation(selectedConvId);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConvId, currentUserId, loadConversation, router]);

  const handleReply = async () => {
    if ((!replyText.trim() && stagedFiles.length === 0) || !selectedConvId) return;
    setSending(true);

    // Upload files directly from browser to Supabase Storage (no server hop)
    const supabase = createClient();
    const attachments: AttachmentData[] = [];
    for (const staged of stagedFiles) {
      const timestamp = Date.now();
      const safeName = staged.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${currentUserId}/${selectedConvId}/${timestamp}-${safeName}`;

      const { error: uploadErr } = await supabase.storage
        .from("message-attachments")
        .upload(path, staged.file, { contentType: staged.file.type, upsert: false });

      if (uploadErr) continue;

      const { data: urlData } = supabase.storage
        .from("message-attachments")
        .getPublicUrl(path);

      attachments.push({
        url: urlData.publicUrl,
        fileName: staged.file.name,
        fileType: staged.file.type,
        fileSize: staged.file.size,
        aiSummary: null,
        documentType: null,
        keyDetails: null,
      });
    }

    // Build message body with inline attachments
    let body = replyText.trim();
    if (attachments.length > 0) {
      const attachmentHtml = attachments.map((a) => {
        if (a.fileType.startsWith("image/")) {
          return `<img src="${a.url}" alt="${a.fileName}" width="300" />`;
        }
        return `<a href="${a.url}" target="_blank" rel="noopener noreferrer">${a.fileName}</a>`;
      }).join("<br/>");
      body = body ? `${body}<br/>${attachmentHtml}` : attachmentHtml;
    }

    const metadata = attachments.length > 0 ? { attachments } : undefined;

    const result = await replyToConversation({
      conversationId: selectedConvId,
      body,
      metadata,
    });
    setSending(false);
    if (result.error) return;

    // Fire AI analysis in the background (non-blocking)
    if (result.messageId && attachments.length > 0) {
      for (const att of attachments) {
        analyzeAttachment({
          messageId: result.messageId,
          fileUrl: att.url,
          fileName: att.fileName,
          fileType: att.fileType,
        }).catch(() => {});
      }
    }

    setReplyText("");
    setStagedFiles([]);
    loadConversation(selectedConvId);
  };

  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

  const handleFilesSelected = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newStaged: StagedFile[] = fileArray
      .filter((f) => f.size <= 10 * 1024 * 1024 && ALLOWED_TYPES.includes(f.type))
      .map((f) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file: f,
        previewUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
        uploading: false,
        error: null,
      }));
    // Deduplicate by filename to prevent double-drops
    setStagedFiles((prev) => {
      const existingNames = new Set(prev.map((sf) => sf.file.name));
      const unique = newStaged.filter((sf) => !existingNames.has(sf.file.name));
      return [...prev, ...unique];
    });
  };

  const removeStagedFile = (id: string) => {
    setStagedFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file?.previewUrl) URL.revokeObjectURL(file.previewUrl);
      return prev.filter((f) => f.id !== id);
    });
  };

  const handleBack = () => {
    setSelectedConvId(null);
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* ─── Left Panel: Tabs + Search + List ─── */}
      <div
        className={`flex shrink-0 flex-col border-r ${
          selectedConvId ? "hidden md:flex" : "flex"
        } w-full md:w-[320px] lg:w-[340px]`}
        style={{
          borderColor: "var(--color-warm-gray-200)",
          backgroundColor: "var(--color-warm-gray-50)",
        }}
      >
        {/* Tab switcher */}
        <div
          className="flex items-center gap-1 border-b px-3 pt-3 pb-0"
          style={{ borderColor: "var(--color-warm-gray-200)" }}
        >
          <TabButton
            active={activeTab === "messages"}
            onClick={() => { setActiveTab("messages"); setSearch(""); }}
            label="Messages"
            count={conversations.reduce((sum, c) => sum + (readConvIds.has(c.id) ? 0 : c.unreadCount), 0)}
          />
          <TabButton
            active={activeTab === "emails"}
            onClick={() => { setActiveTab("emails"); setSearch(""); }}
            label="Emails"
          />
          {activeTab === "messages" ? (
            <button
              type="button"
              className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[var(--color-warm-gray-100)]"
              style={{ color: "var(--color-brand)" }}
              title="New message"
              aria-label="New message"
              onClick={async () => {
                // Check if a direct conversation already exists locally
                const existingDirect = conversations.find((c) => c.type === "direct");
                if (existingDirect) {
                  loadConversation(existingDirect.id);
                  return;
                }
                // Create one via server action
                const result = await createDirectConversation();
                if (result.conversationId) {
                  loadConversation(result.conversationId);
                  startTransition(() => router.refresh());
                }
              }}
            >
              <Plus size={18} weight="bold" />
            </button>
          ) : null}
        </div>

        {/* Search */}
        <div
          className="border-b px-3 py-2.5"
          style={{ borderColor: "var(--color-warm-gray-200)" }}
        >
          <div
            className="flex items-center gap-2 rounded-lg border px-3 py-2"
            style={{
              backgroundColor: "var(--color-white)",
              borderColor: "var(--color-warm-gray-200)",
            }}
          >
            <MagnifyingGlass size={14} style={{ color: "var(--color-text-tertiary)" }} />
            <input
              type="text"
              placeholder={activeTab === "messages" ? "Search messages..." : "Search emails..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm focus:outline-none"
              style={{ color: "var(--color-text-primary)" }}
            />
          </div>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "messages" ? (
            <ConversationList
              conversations={filtered}
              selectedConvId={selectedConvId}
              onSelect={loadConversation}
            />
          ) : (
            <EmailList
              emails={filteredEmails}
              selectedConvId={selectedConvId}
              onSelect={loadConversation}
            />
          )}
        </div>
      </div>

      {/* ─── Right Panel: Thread or Activity Detail ─── */}
      <div
        className={`flex min-w-0 flex-1 flex-col ${
          selectedConvId ? "flex" : "hidden md:flex"
        }`}
        style={{ backgroundColor: "var(--color-white)" }}
      >
        {selectedConvId ? (
          <ChatThread
            messages={messages}
            currentUserId={currentUserId}
            replyText={replyText}
            setReplyText={setReplyText}
            sending={sending}
            onReply={handleReply}
            onBack={handleBack}
            messagesEndRef={messagesEndRef}
            stagedFiles={stagedFiles}
            onFilesSelected={handleFilesSelected}
            onRemoveFile={removeStagedFile}
          />
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}

/* ─── Tab Button ─── */

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative px-3 pb-2.5 pt-1.5 text-sm font-semibold transition-colors"
      style={{
        color: active ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
      }}
    >
      <span className="flex items-center gap-1.5">
        {label}
        {count && count > 0 ? (
          <span
            className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
            style={{ backgroundColor: "var(--color-brand)" }}
          >
            {count}
          </span>
        ) : null}
      </span>
      {active ? (
        <span
          className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full"
          style={{ backgroundColor: "var(--color-brand)" }}
        />
      ) : null}
    </button>
  );
}

/* ─── Conversation List ─── */

function ConversationList({
  conversations,
  selectedConvId,
  onSelect,
}: {
  conversations: Conversation[];
  selectedConvId: string | null;
  onSelect: (id: string) => void;
}) {
  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16">
        <ChatCircle
          size={40}
          weight="duotone"
          style={{ color: "var(--color-warm-gray-200)" }}
        />
        <p
          className="mt-3 text-sm font-medium"
          style={{ color: "var(--color-text-secondary)" }}
        >
          No conversations yet
        </p>
        <p
          className="mt-1 text-center text-xs leading-relaxed"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          Messages from Proxy will appear here.
        </p>
      </div>
    );
  }

  return (
    <ul>
      {conversations.map((c) => {
        const isSelected = selectedConvId === c.id;
        return (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              className="relative flex w-full gap-3 border-b px-4 py-3.5 text-left transition-colors"
              style={{
                borderColor: "var(--color-warm-gray-200)",
                backgroundColor: isSelected ? "var(--color-white)" : "transparent",
              }}
              onMouseEnter={(e) => {
                if (!isSelected) e.currentTarget.style.backgroundColor = "var(--color-warm-gray-100)";
              }}
              onMouseLeave={(e) => {
                if (!isSelected) e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              {/* Active indicator */}
              {isSelected ? (
                <span
                  className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full"
                  style={{ backgroundColor: "var(--color-brand)" }}
                />
              ) : null}

              <ProxyAvatar size={40} highlighted={isSelected} />

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span
                    className="truncate text-sm font-semibold"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {c.type === "announcement" ? c.subject ?? "Announcement" : "Proxy"}
                  </span>
                  <span className="shrink-0 text-[10px]" style={{ color: "var(--color-text-tertiary)" }}>
                    {formatRelative(c.lastMessageAt)}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="truncate text-xs" style={{ color: "var(--color-text-secondary)" }}>
                    {c.lastMessage ? stripHtml(c.lastMessage.body).slice(0, 60) : "Start a conversation"}
                  </span>
                  {c.unreadCount > 0 ? (
                    <span
                      className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                      style={{ backgroundColor: "var(--color-brand)" }}
                    >
                      {c.unreadCount}
                    </span>
                  ) : null}
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}


/* ─── Email List ─── */

function EmailList({
  emails,
  selectedConvId,
  onSelect,
}: {
  emails: Conversation[];
  selectedConvId: string | null;
  onSelect: (id: string) => void;
}) {
  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16">
        <EnvelopeSimple
          size={40}
          weight="duotone"
          style={{ color: "var(--color-warm-gray-200)" }}
        />
        <p
          className="mt-3 text-sm font-medium"
          style={{ color: "var(--color-text-secondary)" }}
        >
          No emails yet
        </p>
        <p
          className="mt-1 text-center text-xs leading-relaxed"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          Email threads from Proxy will appear here.
        </p>
      </div>
    );
  }

  return (
    <ul>
      {emails.map((c) => {
        const isSelected = selectedConvId === c.id;
        return (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              className="relative flex w-full gap-3 border-b px-4 py-3.5 text-left transition-colors"
              style={{
                borderColor: "var(--color-warm-gray-200)",
                backgroundColor: isSelected ? "var(--color-white)" : "transparent",
              }}
              onMouseEnter={(e) => {
                if (!isSelected) e.currentTarget.style.backgroundColor = "var(--color-warm-gray-100)";
              }}
              onMouseLeave={(e) => {
                if (!isSelected) e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              {isSelected ? (
                <span
                  className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full"
                  style={{ backgroundColor: "var(--color-brand)" }}
                />
              ) : null}
              <ProxyAvatar size={36} highlighted={isSelected} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className="truncate text-sm font-semibold"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {c.subject ?? "Email"}
                  </span>
                  <span className="shrink-0 text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>
                    {formatRelative(c.lastMessageAt)}
                  </span>
                </div>
                {c.lastMessage ? (
                  <p className="mt-0.5 truncate text-xs" style={{ color: "var(--color-text-secondary)" }}>
                    {c.lastMessage.body}
                  </p>
                ) : null}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ─── Chat Thread ─── */

function ChatThread({
  messages,
  currentUserId,
  replyText,
  setReplyText,
  sending,
  onReply,
  onBack,
  messagesEndRef,
  stagedFiles,
  onFilesSelected,
  onRemoveFile,
}: {
  messages: Message[];
  currentUserId: string;
  replyText: string;
  setReplyText: (v: string) => void;
  sending: boolean;
  onReply: () => void;
  onBack: () => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  stagedFiles: StagedFile[];
  onFilesSelected: (files: FileList | File[]) => void;
  onRemoveFile: (id: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [newMsgCount, setNewMsgCount] = useState(0);
  const prevMessageCountRef = useRef(messages.length);

  // Scroll to bottom on initial load, or when new messages arrive and user is near bottom
  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      // First render: always snap to bottom
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
      return;
    }
    const distFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    // Only auto-scroll if this is the first load or user is near the bottom
    if (prevMessageCountRef.current === 0 || distFromBottom <= 150) {
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [messages, messagesEndRef]);

  // Track scroll position to show/hide the floating button
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const distFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    setShowScrollBtn(distFromBottom > 100);
    if (distFromBottom <= 100) {
      setNewMsgCount(0);
    }
  }, []);

  // When new messages arrive while scrolled up, increment new message count
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current && showScrollBtn) {
      setNewMsgCount((c) => c + (messages.length - prevMessageCountRef.current));
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length, showScrollBtn]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setNewMsgCount(0);
  }, [messagesEndRef]);

  // Counter to dismiss drag overlay when leaving nested elements
  const dragCounterRef = useRef(0);

  return (
    <div
      className="relative flex flex-1 flex-col overflow-hidden"
      onDragEnter={(e) => {
        e.preventDefault();
        dragCounterRef.current++;
        setDragOver(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        e.preventDefault();
        dragCounterRef.current--;
        if (dragCounterRef.current <= 0) {
          dragCounterRef.current = 0;
          setDragOver(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current = 0;
        setDragOver(false);
        if (e.dataTransfer.files.length > 0) {
          onFilesSelected(e.dataTransfer.files);
        }
      }}
    >
      {/* Full-chat drag overlay (pointer-events-none so drops pass to parent) */}
      {dragOver ? (
        <div
          className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-3"
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.92)",
            backdropFilter: "blur(4px)",
            border: "3px dashed var(--color-brand)",
            borderRadius: "12px",
            margin: "8px",
          }}
        >
          <div
            className="flex h-20 w-20 items-center justify-center rounded-2xl"
            style={{ backgroundColor: "rgba(2, 170, 235, 0.12)" }}
          >
            <Paperclip size={36} weight="duotone" style={{ color: "var(--color-brand)" }} />
          </div>
          <p className="text-base font-semibold" style={{ color: "var(--color-brand)" }}>
            Drop to attach
          </p>
          <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
            Images and PDFs up to 10MB
          </p>
        </div>
      ) : null}

      {/* Chat Header */}
      <div
        className="flex shrink-0 items-center gap-3 border-b px-4 py-3.5 md:px-6"
        style={{ borderColor: "var(--color-warm-gray-200)" }}
      >
        <button
          type="button"
          onClick={onBack}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg md:hidden"
          style={{ color: "var(--color-brand)" }}
          aria-label="Back to conversations"
        >
          <ArrowLeft size={18} weight="bold" />
        </button>
        <ProxyAvatar size={36} highlighted />
        <div>
          <div className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Proxy
          </div>
          <div className="text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>
            Direct message
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="relative flex-1 overflow-y-auto px-4 py-5 md:px-6"
        style={{ backgroundColor: "var(--color-off-white)" }}
      >
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {messages.map((m, idx) => {
            const isOwner = m.sender_id === currentUserId;
            const msgDate = new Date(m.created_at);
            const prevDate = idx > 0 ? new Date(messages[idx - 1].created_at) : null;
            const showDateSeparator =
              idx === 0 ||
              (prevDate &&
                msgDate.toDateString() !== prevDate.toDateString());

            return (
              <div key={m.id}>
                {showDateSeparator ? (
                  <div className="flex items-center gap-3 py-3">
                    <span
                      className="h-px flex-1"
                      style={{ backgroundColor: "var(--color-warm-gray-200)" }}
                    />
                    <span
                      className="shrink-0 text-[11px] font-medium"
                      style={{ color: "var(--color-text-tertiary)" }}
                    >
                      {formatDateSeparator(msgDate)}
                    </span>
                    <span
                      className="h-px flex-1"
                      style={{ backgroundColor: "var(--color-warm-gray-200)" }}
                    />
                  </div>
                ) : null}
              <div className={`flex items-end gap-2 ${isOwner ? "flex-row-reverse" : "flex-row"}`}>
                {!isOwner ? (
                  m.senderAvatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.senderAvatarUrl}
                      alt={m.senderName ?? "Proxy"}
                      className="h-7 w-7 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <ProxyAvatar size={28} highlighted />
                  )
                ) : null}

                <div className="flex max-w-[70%] flex-col">
                  {!isOwner && m.senderName ? (
                    <span
                      className="mb-1 text-[10px] font-medium text-left"
                      style={{ color: "var(--color-text-tertiary)" }}
                    >
                      {m.senderName}
                    </span>
                  ) : null}
                  <div
                    className="rounded-2xl px-4 py-2.5"
                    style={{
                      backgroundColor: isOwner ? "var(--color-brand)" : "var(--color-white)",
                      borderBottomRightRadius: isOwner ? "6px" : undefined,
                      borderBottomLeftRadius: !isOwner ? "6px" : undefined,
                      boxShadow: isOwner ? "none" : "0 1px 2px rgba(0,0,0,0.04)",
                    }}
                  >
                    {m.delivery_method === "email" ? (
                      <div
                        className="mb-1 flex items-center gap-1 text-[10px]"
                        style={{ color: isOwner ? "rgba(255,255,255,0.7)" : "var(--color-text-tertiary)" }}
                      >
                        <EnvelopeSimple size={10} />
                        Sent via email
                      </div>
                    ) : null}
                    <SafeHtml
                      html={m.body}
                      className="text-sm leading-relaxed [&_a]:underline [&_img]:max-w-[240px] [&_img]:rounded-lg"
                      style={{ color: isOwner ? "#ffffff" : "var(--color-text-primary)" }}
                    />
                    {/* Attachment metadata rendering */}
                    {(m.metadata as Record<string, unknown>)?.attachments ? (
                      <MessageAttachments
                        attachments={(m.metadata as { attachments: AttachmentData[] }).attachments}
                        isOwner={isOwner}
                      />
                    ) : null}
                  </div>
                  <span
                    className={`mt-1 text-[10px] ${isOwner ? "text-right" : "text-left"}`}
                    style={{ color: "var(--color-text-tertiary)" }}
                  >
                    {new Date(m.created_at).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Floating scroll-to-bottom button */}
        {showScrollBtn ? (
          <button
            type="button"
            onClick={scrollToBottom}
            className="absolute bottom-4 right-4 flex h-9 w-9 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105"
            style={{
              backgroundColor: "var(--color-white)",
              border: "1px solid var(--color-warm-gray-200)",
              color: "var(--color-text-secondary)",
            }}
            aria-label="Scroll to latest message"
          >
            <ArrowDown size={16} weight="bold" />
            {newMsgCount > 0 ? (
              <span
                className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold"
                style={{ backgroundColor: "var(--color-brand)", color: "#ffffff" }}
              >
                {newMsgCount}
              </span>
            ) : null}
          </button>
        ) : null}
      </div>

      {/* Reply Input */}
      <div
        className="relative shrink-0 border-t px-4 py-3 md:px-6"
        style={{
          borderColor: "var(--color-warm-gray-200)",
          backgroundColor: "var(--color-white)",
          paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))",
        }}
      >
        {/* Staged file previews */}
        {stagedFiles.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {stagedFiles.map((sf) => (
              <div
                key={sf.id}
                className="relative flex items-center gap-2 rounded-lg border px-2.5 py-1.5"
                style={{
                  borderColor: "var(--color-warm-gray-200)",
                  backgroundColor: "var(--color-warm-gray-50)",
                }}
              >
                {sf.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={sf.previewUrl}
                    alt={sf.file.name}
                    className="h-9 w-9 rounded object-cover"
                  />
                ) : (
                  <FileText size={20} style={{ color: "var(--color-text-tertiary)" }} />
                )}
                <span
                  className="max-w-[120px] truncate text-xs"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {sf.file.name}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveFile(sf.id)}
                  className="flex h-5 w-5 items-center justify-center rounded-full transition-colors hover:bg-[var(--color-warm-gray-200)]"
                  style={{ color: "var(--color-text-tertiary)" }}
                  aria-label={`Remove ${sf.file.name}`}
                >
                  <X size={12} weight="bold" />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex items-end gap-2">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                onFilesSelected(e.target.files);
                e.target.value = "";
              }
            }}
          />

          {/* Attachment button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[var(--color-warm-gray-100)]"
            style={{ color: "var(--color-text-tertiary)" }}
            aria-label="Attach file"
          >
            <Paperclip size={18} />
          </button>

          <div
            className="flex flex-1 items-center rounded-full border px-4 transition-colors focus-within:border-[var(--color-brand)]"
            style={{
              borderColor: "var(--color-warm-gray-200)",
              backgroundColor: "var(--color-warm-gray-50)",
            }}
          >
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Type a message..."
              rows={1}
              className="flex-1 resize-none bg-transparent py-2.5 text-sm focus:outline-none"
              style={{ color: "var(--color-text-primary)" }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onReply();
                }
              }}
            />
          </div>
          <button
            type="button"
            onClick={onReply}
            disabled={sending || (!replyText.trim() && stagedFiles.length === 0)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition-opacity disabled:opacity-40"
            style={{ backgroundColor: "var(--color-brand)" }}
          >
            {sending ? (
              <SpinnerGap size={16} weight="bold" className="animate-spin" />
            ) : (
              <PaperPlaneTilt size={16} weight="bold" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Message Attachments ─── */

function MessageAttachments({
  attachments,
  isOwner,
}: {
  attachments: AttachmentData[];
  isOwner: boolean;
}) {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="mt-2 flex flex-col gap-2">
      {attachments.map((att, idx) => (
        <div key={idx}>
          {att.fileType.startsWith("image/") ? (
            <a href={att.url} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={att.url}
                alt={att.fileName}
                className="max-w-[240px] rounded-lg"
              />
            </a>
          ) : (
            <a
              href={att.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors hover:opacity-80"
              style={{
                borderColor: isOwner ? "rgba(255,255,255,0.3)" : "var(--color-warm-gray-200)",
                color: isOwner ? "#ffffff" : "var(--color-text-primary)",
              }}
            >
              <FileText size={16} />
              {att.fileName}
            </a>
          )}
          {att.aiSummary ? (
            <div
              className="mt-1.5 rounded-lg px-3 py-2"
              style={{
                backgroundColor: isOwner ? "rgba(255,255,255,0.12)" : "var(--color-warm-gray-50)",
              }}
            >
              {att.documentType ? (
                <span
                  className="mb-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
                  style={{
                    backgroundColor: isOwner ? "rgba(255,255,255,0.2)" : "var(--color-warm-gray-200)",
                    color: isOwner ? "#ffffff" : "var(--color-text-secondary)",
                  }}
                >
                  {att.documentType}
                </span>
              ) : null}
              <p
                className="text-xs leading-relaxed"
                style={{ color: isOwner ? "rgba(255,255,255,0.85)" : "var(--color-text-secondary)" }}
              >
                {att.aiSummary}
              </p>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/* ─── Empty State ─── */

function EmptyState() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center">
        <ChatCircle
          size={48}
          weight="duotone"
          className="mx-auto"
          style={{ color: "var(--color-warm-gray-200)" }}
        />
        <p
          className="mt-3 text-sm font-medium"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Select a conversation
        </p>
        <p
          className="mt-1 text-xs"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          Choose a conversation from the left to view messages.
        </p>
      </div>
    </div>
  );
}

/* ─── Helpers ─── */

function formatDateSeparator(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, "").trim();
}

function formatRelative(dateStr: string) {
  if (!dateStr) return "";
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
