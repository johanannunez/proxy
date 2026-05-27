export type InboxDeliveryMethod = "portal" | "email" | "sms";

export type InboxConversationForSend = {
  id: string;
  ownerId: string | null;
  type: "direct" | "announcement" | "email_log";
};

export type SendMessageConversationTarget =
  | {
      ok: true;
      conversationId: string | null;
      createDirect: boolean;
    }
  | {
      ok: false;
      error: string;
    };

export type EmailReplyMessage = {
  deliveryMethod: string;
  metadata: unknown;
};

export type EmailReplyRecipients =
  | {
      ok: true;
      to: string[];
    }
  | {
      ok: false;
      error: string;
    };

export type EmailReplyContext = {
  relatedContactId?: string;
  relatedContactName?: string;
  workspaceId?: string;
};

export type OwnerNotificationDecisionArgs = {
  deliveryMethod: InboxDeliveryMethod;
  conversationType: InboxConversationForSend["type"] | string;
  ownerEmail: string | null | undefined;
  recipients: string[];
};

const PARCEL_EMAILS = new Set([
  "hello@theparcelco.com",
  "support@theparcelco.com",
  "team@theparcelco.com",
]);

export function resolveSendMessageConversationTarget(args: {
  deliveryMethod: InboxDeliveryMethod;
  selectedConversation: InboxConversationForSend | null;
  existingDirectConversationId: string | null;
}): SendMessageConversationTarget {
  if (args.selectedConversation?.type === "announcement") {
    return { ok: false, error: "Announcements cannot receive direct replies." };
  }

  if (args.selectedConversation?.type === "email_log") {
    if (args.deliveryMethod !== "email") {
      return { ok: false, error: "Email history threads can only send email replies." };
    }

    return {
      ok: true,
      conversationId: args.selectedConversation.id,
      createDirect: false,
    };
  }

  if (args.selectedConversation?.type === "direct") {
    return {
      ok: true,
      conversationId: args.selectedConversation.id,
      createDirect: false,
    };
  }

  if (args.existingDirectConversationId) {
    return {
      ok: true,
      conversationId: args.existingDirectConversationId,
      createDirect: false,
    };
  }

  return {
    ok: true,
    conversationId: null,
    createDirect: true,
  };
}

export function resolveEmailReplyRecipients(args: {
  conversationType: InboxConversationForSend["type"] | string;
  ownerEmail: string | null | undefined;
  messages: EmailReplyMessage[];
}): EmailReplyRecipients {
  if (args.conversationType === "email_log") {
    const inboundSender = findLatestInboundExternalSender(args.messages);
    if (inboundSender) return { ok: true, to: [inboundSender] };
  }

  const ownerEmail = normalizeEmail(args.ownerEmail);
  if (ownerEmail) return { ok: true, to: [ownerEmail] };

  return { ok: false, error: "No email recipient could be resolved for this thread." };
}

export function resolveEmailReplyContext(messages: EmailReplyMessage[]): EmailReplyContext {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const metadata = messages[index].metadata;
    if (!isRecord(metadata)) continue;

    const relatedContactId = metadataString(metadata, "related_contact_id");
    const relatedContactName = metadataString(metadata, "related_contact_name");
    const workspaceId = metadataString(metadata, "workspace_id");
    if (!relatedContactId && !relatedContactName && !workspaceId) continue;

    return {
      ...(relatedContactId ? { relatedContactId } : {}),
      ...(relatedContactName ? { relatedContactName } : {}),
      ...(workspaceId ? { workspaceId } : {}),
    };
  }

  return {};
}

export function shouldNotifyOwnerForAdminMessage(args: OwnerNotificationDecisionArgs): boolean {
  if (args.deliveryMethod !== "email") return true;
  if (args.conversationType !== "email_log") return true;

  const ownerEmail = normalizeEmail(args.ownerEmail);
  if (!ownerEmail) return false;

  return args.recipients.some((recipient) => normalizeEmail(recipient) === ownerEmail);
}

function findLatestInboundExternalSender(messages: EmailReplyMessage[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.deliveryMethod !== "email") continue;

    const metadata = message.metadata;
    if (!isRecord(metadata)) continue;
    if (metadata.direction !== "inbound") continue;

    const from = normalizeEmail(metadata.from);
    if (from && !PARCEL_EMAILS.has(from)) return from;
  }

  return null;
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email && email.includes("@") ? email : null;
}

function metadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
