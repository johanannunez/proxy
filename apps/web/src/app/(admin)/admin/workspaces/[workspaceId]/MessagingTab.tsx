"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  PaperPlaneRight,
  PushPin,
  User,
  Buildings,
  EnvelopeSimple,
  ChatCircleText,
  DeviceMobile,
  PhoneCall,
  Play,
  CaretDown,
  CaretUp,
  Check,
  WarningCircle,
  Clock,
  FloppyDisk,
  Sparkle,
  MagicWand,
  Notepad,
  Spinner,
  X,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  sendWorkspaceMessage,
  togglePinMessage,
  type MessageChannel,
} from "./messaging-actions";
import {
  listMessageTemplates,
  createMessageTemplate,
  type MessageTemplate,
} from "./templates-actions";
import { applyTemplateVariables } from "@/lib/channels/templates";
import type { WorkspaceThreadItem, ThreadChannel } from "@/lib/admin/workspace-messages";
import type { WorkspaceMember } from "@/lib/admin/workspace-contact-detail";
import { SafeHtml } from "@/components/messages/SafeHtml";
import styles from "./MessagingTab.module.css";

type Props = {
  contactId: string;
  workspaceId: string;
  messages: WorkspaceThreadItem[];
  members: WorkspaceMember[];
  activeContactId: string;
};

const CHANNEL_META: Record<ThreadChannel, { label: string; Icon: typeof EnvelopeSimple }> = {
  portal: { label: "Portal", Icon: ChatCircleText },
  email: { label: "Email", Icon: EnvelopeSimple },
  sms: { label: "SMS", Icon: DeviceMobile },
  call: { label: "Call", Icon: PhoneCall },
  in_app: { label: "Note", Icon: ChatCircleText },
};

type ChannelFilter = "all" | "portal" | "email" | "sms" | "call";

const CHANNEL_FILTERS: { key: ChannelFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "portal", label: "Portal" },
  { key: "email", label: "Email" },
  { key: "sms", label: "SMS" },
  { key: "call", label: "Calls" },
];

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function matchesChannel(channel: ThreadChannel, filter: ChannelFilter): boolean {
  if (filter === "portal") return channel === "portal" || channel === "in_app";
  return channel === filter;
}

function ChannelBadge({ channel }: { channel: WorkspaceThreadItem["channel"] }) {
  const meta = CHANNEL_META[channel];
  return (
    <span className={styles.channelBadge}>
      <meta.Icon size={11} weight="fill" /> {meta.label}
    </span>
  );
}

function DeliveryPills({ deliveries }: { deliveries: WorkspaceThreadItem["deliveries"] }) {
  if (deliveries.length === 0) return null;
  return (
    <div className={styles.deliveryPills}>
      {deliveries.map((d) => {
        const failed = d.status === "failed";
        return (
          <span
            key={d.channel}
            className={`${styles.deliveryPill} ${failed ? styles.deliveryPillFailed : ""}`}
            title={`${d.channel}: ${d.status}`}
          >
            {failed ? <WarningCircle size={10} weight="fill" /> : <Check size={10} weight="bold" />}
            {d.channel}
          </span>
        );
      })}
    </div>
  );
}

function MessageBubble({
  message,
  contactLabel,
  onPin,
}: {
  message: WorkspaceThreadItem;
  contactLabel?: string;
  onPin: (id: string, currentlyPinned: boolean) => void;
}) {
  const [isPinning, startPinTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const isAdmin = message.direction === "outbound";
  const canPin = message.source === "client_message";
  const duration = message.channel === "call" ? formatDuration(message.durationSeconds) : "";

  return (
    <div className={`${styles.bubble} ${isAdmin ? styles.bubbleAdmin : styles.bubblePerson}`}>
      <div className={styles.bubbleHeader}>
        {contactLabel && <span className={styles.contactLabel}>{contactLabel}</span>}
        <span className={styles.senderName}>
          {isAdmin ? (
            <><Buildings size={12} className={styles.senderIcon} /> {message.senderName}</>
          ) : (
            <><User size={12} className={styles.senderIcon} /> {message.senderName}</>
          )}
        </span>
        <ChannelBadge channel={message.channel} />
        {duration && <span className={styles.duration}>{duration}</span>}
        <span className={styles.timestamp}>{formatTime(message.createdAt)}</span>
        {message.recordingUrl && (
          <a
            href={message.recordingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.recordingLink}
            onClick={(e) => e.stopPropagation()}
          >
            <Play size={11} weight="fill" /> Recording
          </a>
        )}
        {message.transcript && (
          <button
            className={styles.expandBtn}
            onClick={() => setExpanded((v) => !v)}
            aria-label="Toggle transcript"
          >
            {expanded ? <CaretUp size={13} /> : <CaretDown size={13} />}
          </button>
        )}
        {canPin && (
          <button
            className={`${styles.pinBtn} ${message.pinned ? styles.pinBtnActive : ""}`}
            onClick={() => startPinTransition(() => onPin(message.id, message.pinned))}
            disabled={isPinning}
            title={message.pinned ? "Unpin" : "Pin message"}
            aria-label={message.pinned ? "Unpin" : "Pin"}
          >
            <PushPin size={12} weight={message.pinned ? "fill" : "regular"} />
          </button>
        )}
      </div>
      {message.subject && <p className={styles.bubbleSubject}>{message.subject}</p>}
      {message.isHtml ? (
        <SafeHtml html={message.body} className={styles.bubbleBodyHtml} />
      ) : (
        <p className={styles.bubbleBody}>{message.body}</p>
      )}
      {expanded && message.transcript && (
        <div className={styles.transcript}>{message.transcript}</div>
      )}
      {isAdmin && message.source !== "comm_event" && (
        <DeliveryPills deliveries={message.deliveries} />
      )}
    </div>
  );
}

export function MessagingTab({
  workspaceId,
  messages: initialMessages,
  members,
  activeContactId,
}: Props) {
  const [localMessages, setLocalMessages] = useState<WorkspaceThreadItem[]>(initialMessages);
  useEffect(() => setLocalMessages(initialMessages), [initialMessages]);

  const [filterContactId, setFilterContactId] = useState<string | "all">(activeContactId);
  useEffect(() => setFilterContactId(activeContactId), [activeContactId]);

  const [body, setBody] = useState("");
  const [subject, setSubject] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  useEffect(() => {
    listMessageTemplates().then(setTemplates).catch(() => {});
  }, []);

  const [scheduleAt, setScheduleAt] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);

  const router = useRouter();
  const [aiBusy, setAiBusy] = useState<null | "draft" | "polish" | "summarize">(null);
  const [summary, setSummary] = useState<string | null>(null);

  // Realtime: refresh the thread when a message lands or a delivery
  // status changes (incoming portal replies, send results, etc.).
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`ws-comm-${workspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () =>
        router.refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_deliveries" },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, router]);

  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");

  const byContact =
    filterContactId === "all"
      ? localMessages
      : localMessages.filter((m) => m.contactId === filterContactId);

  const filteredMessages =
    channelFilter === "all"
      ? byContact
      : byContact.filter((m) => matchesChannel(m.channel, channelFilter));

  const pinned = filteredMessages.filter((m) => m.pinned);
  const thread = filteredMessages.filter((m) => !m.pinned);

  const composeContactId = filterContactId === "all" ? activeContactId : filterContactId;
  const composeContact = members.find((m) => m.id === composeContactId);

  // Which channels can this contact actually receive on.
  const available = useMemo(
    () => ({
      portal: !!composeContact?.portalAccess,
      email: !!composeContact?.email,
      sms: !!composeContact?.phone,
    }),
    [composeContact],
  );

  const [channels, setChannels] = useState<MessageChannel[]>([]);

  // Reset channel selection to a sensible default when switching contacts.
  useEffect(() => {
    const next: MessageChannel = available.portal
      ? "portal"
      : available.email
        ? "email"
        : available.sms
          ? "sms"
          : "portal";
    setChannels([next]);
  }, [composeContactId, available.portal, available.email, available.sms]);

  function toggleChannel(channel: MessageChannel) {
    setChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel],
    );
  }

  function handlePin(messageId: string, currentlyPinned: boolean) {
    setLocalMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, pinned: !currentlyPinned } : m)),
    );
    togglePinMessage(messageId, workspaceId, currentlyPinned).catch(() => {
      setLocalMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, pinned: currentlyPinned } : m)),
      );
    });
  }

  function applyTemplate(templateId: string) {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    const vars = {
      first_name: composeContact?.firstName ?? composeContact?.fullName.split(" ")[0] ?? null,
      full_name: composeContact?.fullName ?? null,
    };
    if (tpl.subject) setSubject(applyTemplateVariables(tpl.subject, vars));
    setBody(applyTemplateVariables(tpl.body, vars));
    textareaRef.current?.focus();
  }

  function handleSaveTemplate() {
    if (!body.trim()) return;
    const name = window.prompt("Template name");
    if (!name?.trim()) return;
    createMessageTemplate({
      name: name.trim(),
      channel: "any",
      subject: subject || undefined,
      body,
    }).then((res) => {
      if (res.ok) listMessageTemplates().then(setTemplates).catch(() => {});
      else setError(res.message);
    });
  }

  function buildTranscript(): string {
    return filteredMessages
      .slice(-20)
      .map(
        (m) =>
          `${m.direction === "inbound" ? "Contact" : "Parcel"}: ${m.body
            .replace(/<[^>]*>/g, "")
            .replace(/\s+/g, " ")
            .trim()}`,
      )
      .join("\n");
  }

  async function callAssist(
    mode: "rephrase" | "custom",
    text: string,
    instruction?: string,
  ): Promise<string> {
    const res = await fetch("/api/ai/assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, text, instruction }),
    });
    if (!res.ok) throw new Error("AI request failed");
    const data = (await res.json()) as { output?: string };
    return data.output ?? "";
  }

  function handleDraft() {
    setAiBusy("draft");
    setError(null);
    callAssist(
      "custom",
      buildTranscript() || "(no prior messages)",
      "You are a property manager at The Parcel Company. Draft a warm, concise reply to the most recent message in this conversation. Output only the reply text — no preamble.",
    )
      .then((out) => out && setBody(out))
      .catch(() => setError("AI draft failed."))
      .finally(() => setAiBusy(null));
  }

  function handlePolish() {
    if (!body.trim()) return;
    setAiBusy("polish");
    setError(null);
    callAssist("rephrase", body)
      .then((out) => out && setBody(out))
      .catch(() => setError("AI polish failed."))
      .finally(() => setAiBusy(null));
  }

  function handleSummarize() {
    setAiBusy("summarize");
    setError(null);
    callAssist(
      "custom",
      buildTranscript() || "(no messages yet)",
      "Summarize this conversation in 2-3 sentences for an internal admin note. Be specific about any open requests or commitments.",
    )
      .then((out) => setSummary(out || "No summary available."))
      .catch(() => setError("AI summary failed."))
      .finally(() => setAiBusy(null));
  }

  function handleSend() {
    if (!body.trim() || channels.length === 0) return;
    setError(null);
    const scheduledAt = showSchedule && scheduleAt ? new Date(scheduleAt).toISOString() : undefined;
    startTransition(async () => {
      const result = await sendWorkspaceMessage(composeContactId, {
        channels,
        subject: channels.includes("email") ? subject : undefined,
        body,
        scheduledAt,
      });
      if (result.ok) {
        setBody("");
        setSubject("");
        setScheduleAt("");
        setShowSchedule(false);
        textareaRef.current?.focus();
      } else {
        setError(result.message);
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  }

  const noChannelAvailable = !available.portal && !available.email && !available.sms;

  return (
    <div className={styles.root}>
      {members.length > 1 && (
        <div className={styles.filterBar}>
          <button
            type="button"
            className={`${styles.filterBtn} ${filterContactId === "all" ? styles.filterBtnActive : ""}`}
            onClick={() => setFilterContactId("all")}
          >
            All
          </button>
          {members.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`${styles.filterBtn} ${filterContactId === m.id ? styles.filterBtnActive : ""}`}
              onClick={() => setFilterContactId(m.id)}
            >
              {m.firstName ?? m.fullName.split(" ")[0]}
            </button>
          ))}
        </div>
      )}

      {pinned.length > 0 && (
        <div className={styles.pinnedSection}>
          <div className={styles.pinnedLabel}>
            <PushPin size={13} weight="fill" />
            Pinned
          </div>
          {pinned.map((m) => {
            const contact =
              filterContactId === "all"
                ? members.find((mem) => mem.id === m.contactId)
                : undefined;
            return (
              <MessageBubble
                key={m.id}
                message={m}
                contactLabel={contact ? (contact.firstName ?? contact.fullName.split(" ")[0]) : undefined}
                onPin={handlePin}
              />
            );
          })}
        </div>
      )}

      <div className={styles.channelFilterBar}>
        {CHANNEL_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`${styles.channelFilterBtn} ${channelFilter === f.key ? styles.channelFilterBtnActive : ""}`}
            onClick={() => setChannelFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className={styles.thread}>
        {thread.length === 0 && pinned.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>No messages yet</p>
            <p className={styles.emptyBody}>
              Reach this contact by portal, email, or SMS — replies thread back here.
            </p>
          </div>
        ) : (
          thread.map((m) => {
            const contact =
              filterContactId === "all"
                ? members.find((mem) => mem.id === m.contactId)
                : undefined;
            return (
              <MessageBubble
                key={m.id}
                message={m}
                contactLabel={contact ? (contact.firstName ?? contact.fullName.split(" ")[0]) : undefined}
                onPin={handlePin}
              />
            );
          })
        )}
      </div>

      <div className={styles.compose}>
        {summary && (
          <div className={styles.summaryBanner}>
            <Notepad size={15} weight="fill" className={styles.summaryIcon} />
            <p className={styles.summaryText}>{summary}</p>
            <button
              type="button"
              className={styles.summaryClose}
              onClick={() => setSummary(null)}
              aria-label="Dismiss summary"
            >
              <X size={13} />
            </button>
          </div>
        )}
        <div className={styles.composeMeta}>
          {filterContactId === "all" && composeContact && (
            <span className={styles.composeTarget}>
              To {composeContact.firstName ?? composeContact.fullName.split(" ")[0]}
            </span>
          )}
          <div className={styles.channelChips}>
            {(["portal", "email", "sms"] as MessageChannel[]).map((c) => {
              const meta = CHANNEL_META[c];
              const enabled = available[c];
              const active = channels.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  className={`${styles.channelChip} ${active ? styles.channelChipActive : ""}`}
                  onClick={() => toggleChannel(c)}
                  disabled={!enabled || isPending}
                  title={enabled ? `Send via ${meta.label}` : `${meta.label} unavailable for this contact`}
                >
                  <meta.Icon size={13} weight={active ? "fill" : "regular"} /> {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.composerToolbar}>
          <select
            className={styles.templateSelect}
            value=""
            onChange={(e) => {
              if (e.target.value) applyTemplate(e.target.value);
            }}
            disabled={isPending || templates.length === 0}
            title={templates.length ? "Insert a template" : "No templates yet"}
          >
            <option value="">{templates.length ? "Templates…" : "No templates"}</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={styles.toolBtn}
            onClick={handleSaveTemplate}
            disabled={isPending || !body.trim()}
            title="Save current message as a template"
          >
            <FloppyDisk size={14} /> Save
          </button>
          <span className={styles.toolDivider} />
          <button
            type="button"
            className={styles.toolBtn}
            onClick={handleDraft}
            disabled={isPending || aiBusy !== null}
            title="AI: draft a reply from the conversation"
          >
            {aiBusy === "draft" ? <Spinner size={14} className={styles.spin} /> : <Sparkle size={14} />} Draft
          </button>
          <button
            type="button"
            className={styles.toolBtn}
            onClick={handlePolish}
            disabled={isPending || aiBusy !== null || !body.trim()}
            title="AI: polish the current draft"
          >
            {aiBusy === "polish" ? <Spinner size={14} className={styles.spin} /> : <MagicWand size={14} />} Polish
          </button>
          <button
            type="button"
            className={styles.toolBtn}
            onClick={handleSummarize}
            disabled={isPending || aiBusy !== null}
            title="AI: summarize the conversation"
          >
            {aiBusy === "summarize" ? <Spinner size={14} className={styles.spin} /> : <Notepad size={14} />} Summarize
          </button>
          {available.portal && (
            <button
              type="button"
              className={`${styles.toolBtn} ${showSchedule ? styles.toolBtnActive : ""}`}
              onClick={() => setShowSchedule((v) => !v)}
              disabled={isPending}
              title="Schedule this message"
            >
              <Clock size={14} /> Schedule
            </button>
          )}
          {showSchedule && (
            <input
              type="datetime-local"
              className={styles.scheduleInput}
              value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)}
              disabled={isPending}
            />
          )}
        </div>

        {noChannelAvailable && (
          <p className={styles.composeError}>
            This contact has no portal access, email, or phone on file.
          </p>
        )}
        {error && <p className={styles.composeError}>{error}</p>}

        {channels.includes("email") && (
          <input
            className={styles.subjectInput}
            placeholder="Email subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={isPending}
          />
        )}

        <div className={styles.composeRow}>
          <textarea
            ref={textareaRef}
            className={styles.composeInput}
            placeholder="Write a message (Cmd+Enter to send)"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            disabled={isPending || noChannelAvailable}
          />
          <button
            className={styles.sendBtn}
            onClick={handleSend}
            disabled={isPending || !body.trim() || channels.length === 0}
            aria-label={showSchedule && scheduleAt ? "Schedule message" : "Send message"}
          >
            {showSchedule && scheduleAt ? (
              <Clock size={18} weight="fill" />
            ) : (
              <PaperPlaneRight size={18} weight="fill" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
