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
  Check,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  sendWorkspaceMessage,
  togglePinMessage,
  type MessageChannel,
} from "./messaging-actions";
import type { WorkspaceThreadItem } from "@/lib/admin/workspace-messages";
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

const CHANNEL_META: Record<
  MessageChannel | "in_app",
  { label: string; Icon: typeof EnvelopeSimple }
> = {
  portal: { label: "Portal", Icon: ChatCircleText },
  email: { label: "Email", Icon: EnvelopeSimple },
  sms: { label: "SMS", Icon: DeviceMobile },
  in_app: { label: "Note", Icon: ChatCircleText },
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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
  const isAdmin = message.direction === "outbound";
  const canPin = message.source === "client_message";

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
        <span className={styles.timestamp}>{formatTime(message.createdAt)}</span>
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
      {isAdmin && <DeliveryPills deliveries={message.deliveries} />}
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

  const filteredMessages =
    filterContactId === "all"
      ? localMessages
      : localMessages.filter((m) => m.contactId === filterContactId);

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

  function handleSend() {
    if (!body.trim() || channels.length === 0) return;
    setError(null);
    startTransition(async () => {
      const result = await sendWorkspaceMessage(composeContactId, {
        channels,
        subject: channels.includes("email") ? subject : undefined,
        body,
      });
      if (result.ok) {
        setBody("");
        setSubject("");
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
            aria-label="Send message"
          >
            <PaperPlaneRight size={18} weight="fill" />
          </button>
        </div>
      </div>
    </div>
  );
}
