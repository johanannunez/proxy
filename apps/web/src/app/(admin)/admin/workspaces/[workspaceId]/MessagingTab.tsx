"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { PaperPlaneRight, PushPin, User, Buildings } from "@phosphor-icons/react";
import { sendWorkspaceMessage, togglePinMessage } from "./messaging-actions";
import type { WorkspaceInboxConversation, WorkspaceMessage } from "@/lib/admin/workspace-messages";
import type { WorkspaceMember } from "@/lib/admin/workspace-contact-detail";
import styles from "./MessagingTab.module.css";

type Props = {
  contactId: string;
  messages: WorkspaceMessage[];
  inboxConversations: WorkspaceInboxConversation[];
  members: WorkspaceMember[];
  activeContactId: string;
  ownerId: string | null;
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function MessageBubble({
  message,
  contactLabel,
  onPin,
}: {
  message: WorkspaceMessage;
  contactLabel?: string;
  onPin: (id: string, messageContactId: string, currentlyPinned: boolean) => void;
}) {
  const [isPinning, startPinTransition] = useTransition();
  const isAdmin = message.senderType === "admin";

  function handlePin() {
    startPinTransition(async () => {
      onPin(message.id, message.contactId, message.pinned);
    });
  }

  return (
    <div className={`${styles.bubble} ${isAdmin ? styles.bubbleAdmin : styles.bubblePerson}`}>
      <div className={styles.bubbleHeader}>
        {contactLabel && (
          <span className={styles.contactLabel}>{contactLabel}</span>
        )}
        <span className={styles.senderName}>
          {isAdmin ? (
            <><Buildings size={12} className={styles.senderIcon} /> {message.senderName}</>
          ) : (
            <><User size={12} className={styles.senderIcon} /> {message.senderName}</>
          )}
        </span>
        <span className={styles.timestamp}>{formatTime(message.createdAt)}</span>
        <button
          className={`${styles.pinBtn} ${message.pinned ? styles.pinBtnActive : ""}`}
          onClick={handlePin}
          disabled={isPinning}
          title={message.pinned ? "Unpin" : "Pin message"}
          aria-label={message.pinned ? "Unpin" : "Pin"}
        >
          <PushPin size={12} weight={message.pinned ? "fill" : "regular"} />
        </button>
      </div>
      <p className={styles.bubbleBody}>{message.body}</p>
    </div>
  );
}

export function MessagingTab({
  messages: initialMessages,
  inboxConversations,
  members,
  activeContactId,
  ownerId,
}: Props) {
  const [localMessages, setLocalMessages] = useState<WorkspaceMessage[]>(initialMessages);

  useEffect(() => {
    setLocalMessages(initialMessages);
  }, [initialMessages]);

  const [filterContactId, setFilterContactId] = useState<string | "all">(activeContactId);

  useEffect(() => {
    setFilterContactId(activeContactId);
  }, [activeContactId]);

  const [body, setBody] = useState("");
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
  const centralInboxHref = ownerId ? `/admin/inbox?owner=${encodeURIComponent(ownerId)}` : "/admin/inbox";

  function handlePin(messageId: string, messageContactId: string, currentlyPinned: boolean) {
    setLocalMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, pinned: !currentlyPinned } : m)),
    );
    togglePinMessage(messageId, messageContactId, currentlyPinned).catch(() => {
      setLocalMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, pinned: currentlyPinned } : m)),
      );
    });
  }

  function handleSend() {
    if (!body.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await sendWorkspaceMessage(composeContactId, body);
      if (result.ok) {
        setBody("");
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

      <section className={styles.globalInbox}>
        <div className={styles.globalInboxHeader}>
          <div>
            <div className={styles.globalInboxEyebrow}>Global inbox</div>
            <h3 className={styles.globalInboxTitle}>Workspace, SMS, and email history</h3>
          </div>
          <a className={styles.globalInboxLink} href={centralInboxHref}>
            Open inbox
          </a>
        </div>
        {inboxConversations.length === 0 ? (
          <p className={styles.globalInboxEmpty}>No central inbox conversations are linked to this workspace yet.</p>
        ) : (
          <div className={styles.globalInboxList}>
            {inboxConversations.slice(0, 4).map((conversation) => (
              <a
                key={conversation.id}
                className={styles.globalInboxRow}
                href={`/admin/inbox?conversation=${encodeURIComponent(conversation.id)}`}
              >
                <span className={styles.globalInboxBadge}>
                  {conversationLabel(conversation)}
                </span>
                <span className={styles.globalInboxContent}>
                  <span className={styles.globalInboxSubject}>
                    {conversation.subject ?? conversationLabel(conversation)}
                  </span>
                  {conversation.contextLabel ? (
                    <span className={styles.globalInboxContext}>
                      {conversation.contextLabel}
                    </span>
                  ) : null}
                  <span className={styles.globalInboxPreview}>
                    {conversation.lastMessageBody ? stripHtml(conversation.lastMessageBody).slice(0, 96) : "No messages yet"}
                  </span>
                </span>
                <span className={styles.globalInboxTime}>{formatShortTime(conversation.lastMessageAt)}</span>
              </a>
            ))}
          </div>
        )}
      </section>

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
              Messages sent here are private notes and in-app communications with this workspace.
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
        {filterContactId === "all" && composeContact && (
          <div className={styles.composeTarget}>
            Sending to {composeContact.firstName ?? composeContact.fullName.split(" ")[0]}
          </div>
        )}
        {error && <p className={styles.composeError}>{error}</p>}
        <div className={styles.composeRow}>
          <textarea
            ref={textareaRef}
            className={styles.composeInput}
            placeholder="Write a message (Cmd+Enter to send)"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            disabled={isPending}
          />
          <button
            className={styles.sendBtn}
            onClick={handleSend}
            disabled={isPending || !body.trim()}
            aria-label="Send message"
          >
            <PaperPlaneRight size={18} weight="fill" />
          </button>
        </div>
      </div>
    </div>
  );
}

function conversationLabel(conversation: WorkspaceInboxConversation): string {
  if (conversation.lastDeliveryMethod === "sms") return "SMS";
  if (conversation.type === "email_log" || conversation.lastDeliveryMethod === "email") return "Email";
  if (conversation.type === "announcement") return "Announcement";
  return "Workspace";
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

function formatShortTime(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
