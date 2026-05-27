export type ConversationContextInput = {
  type: string;
  ownerEmail: string | null;
  ownerPhone: string | null;
  lastMessage: {
    deliveryMethod: string;
    metadata: Record<string, unknown>;
  } | null;
};

const PARCEL_EMAILS = new Set([
  "hello@theparcelco.com",
  "support@theparcelco.com",
  "team@theparcelco.com",
]);

export function getConversationContextLabel(conversation: ConversationContextInput): string | null {
  const message = conversation.lastMessage;
  if (!message) return null;

  if (conversation.type === "email_log" || message.deliveryMethod === "email") {
    const contactName = metadataString(message.metadata, "related_contact_name");
    if (contactName) return `Contact: ${contactName}`;

    const externalFrom = externalEmail(metadataString(message.metadata, "from"));
    if (externalFrom && externalFrom !== normalizeEmail(conversation.ownerEmail)) {
      return `From: ${externalFrom}`;
    }

    const externalTo = metadataStringArray(message.metadata, "to")
      .map(normalizeEmail)
      .find((email): email is string => Boolean(email && !PARCEL_EMAILS.has(email)));
    if (externalTo && externalTo !== normalizeEmail(conversation.ownerEmail)) {
      return `To: ${externalTo}`;
    }
  }

  if (message.deliveryMethod === "sms") {
    const phone =
      metadataString(message.metadata, "phone_from") ??
      metadataString(message.metadata, "phone_to") ??
      metadataString(message.metadata, "sms_to") ??
      conversation.ownerPhone;
    return phone ? `SMS: ${phone}` : "SMS";
  }

  return null;
}

export function getConversationSearchText(conversation: ConversationContextInput): string {
  const metadata = conversation.lastMessage?.metadata ?? {};
  return [
    getConversationContextLabel(conversation),
    metadataString(metadata, "related_contact_name"),
    metadataString(metadata, "from"),
    ...metadataStringArray(metadata, "to"),
    metadataString(metadata, "phone_from"),
    metadataString(metadata, "phone_to"),
    metadataString(metadata, "sms_to"),
  ]
    .filter((item): item is string => Boolean(item))
    .join(" ")
    .toLowerCase();
}

function externalEmail(value: string | null): string | null {
  const email = normalizeEmail(value);
  if (!email || PARCEL_EMAILS.has(email)) return null;
  return email;
}

function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const email = value.trim().toLowerCase();
  return email.includes("@") ? email : null;
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
